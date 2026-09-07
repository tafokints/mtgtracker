import type { Redis } from '@upstash/redis';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryInputError, ORPHAN_GRACE_MS, readStorageInventory } from '@/lib/storage-inventory';
import { evidenceKey, type EvidenceAsset } from '@/lib/evidence-store';
import { evidenceUrl } from '@/lib/evidence-policy';
import { createInitialTrackerCards, getTrackerSlotId } from '@/lib/tracker-data';
import { generatedTrackers, getTracker } from '@/lib/trackers';

const NOW = Date.parse('2026-09-06T12:00:00Z');
const id = '11111111-1111-4111-8111-111111111111';
const reportId = '22222222-2222-4222-8222-222222222222';
const tracker = getTracker('one-ring')!;
function asset(overrides: Partial<EvidenceAsset> = {}): EvidenceAsset {
  return { id, tracker: tracker.slug, cardId: 7, submissionId: reportId,
    pathname: `quarantine/one-ring/${id}.webp`, sha256: 'a'.repeat(64), size: 1024, width: 20, height: 30,
    createdAt: new Date(NOW - ORPHAN_GRACE_MS - 7200000).toISOString(), sessionExpiresAt: NOW - ORPHAN_GRACE_MS - 3600000,
    scan: { status: 'pending', reason: 'awaiting-checks', policyVersion: 1 }, ...overrides };
}
function report(status: string) {
  return { id: reportId, cardId: 7, serialNumber: '007', status, submittedAt: '2026-08-01T00:00:00Z', evidenceImages: [] };
}

describe('read-only storage inventory', () => {
  const store = new Map<string, unknown>();
  const redis = {
    scan: vi.fn(async () => ['0', [...store.keys()].filter((key) => key.startsWith('evidence:v1:'))]),
    eval: vi.fn(async (_script: string, keys: string[], args: number[]) => {
      let remaining = args[0];
      return keys.map((key) => {
        if (!store.has(key)) return { state: 'missing' };
        const raw = JSON.stringify(store.get(key));
        if (Buffer.byteLength(raw) > remaining) return { state: 'unavailable' };
        remaining -= Buffer.byteLength(raw);
        return { state: 'present', raw };
      });
    }),
  };
  const read = (cursor?: unknown) => readStorageInventory(redis as unknown as Redis, cursor, NOW);
  beforeEach(() => { store.clear(); vi.clearAllMocks(); store.set(evidenceKey(id), asset()); });

  it('flags only old unreferenced metadata without writing or exposing storage locations', async () => {
    const before = structuredClone(store);
    const page = await read();
    expect(page.rows).toEqual([{ id, tracker: 'one-ring', card: 'The One Ring 007/100', createdAt: asset().createdAt, bytes: 1024, status: 'candidate' }]);
    expect(page.nextCursor).toBeNull();
    expect(JSON.stringify(page)).not.toMatch(/quarantine|sha256|submissionId|22222222|awaiting-checks/);
    expect(store).toEqual(before);
  });

  it.each(['pending', 'approved', 'rejected', 'revoked', 'needs-more-info', 'duplicate', 'cannot-verify'])('retains every owning report, including %s and detached images', async (status) => {
    store.set(tracker.storage.submissionsKey, [report(status)]);
    expect((await read()).rows[0].status).toBe('retained');
  });

  it('retains shared-view and legacy references even if the report is missing', async () => {
    const poster = getTracker('lotr-poster-cards')!;
    const slotId = getTrackerSlotId(poster, 'the-one-ring', 7)!;
    const cards = createInitialTrackerCards(poster);
    cards[slotId - 1].image = evidenceUrl(id);
    store.set(poster.storage.cardsKey, [cards[slotId - 1]]);
    expect((await read()).rows[0].status).toBe('retained');
    store.delete(poster.storage.cardsKey);
    const ownerCards = createInitialTrackerCards(tracker);
    ownerCards[6].evidenceImages = [{ url: evidenceUrl(id), assetId: id }];
    store.set(tracker.storage.legacyCardsKeys![0], [ownerCards[6]]);
    expect((await read()).rows[0].status).toBe('retained');
  });

  it('keeps expired uploads through the entire seven-day grace period', async () => {
    store.set(evidenceKey(id), asset({ sessionExpiresAt: NOW - ORPHAN_GRACE_MS + 1 }));
    expect((await read()).rows[0].status).toBe('recent');
    expect(redis.eval).toHaveBeenCalledTimes(1);
    store.set(evidenceKey(id), asset({ sessionExpiresAt: NOW + 3600000 }));
    expect((await read()).rows[0].status).toBe('recent');
  });

  it.each([
    { pathname: 'quarantine/other/file.webp' }, { tracker: 'missing' }, { cardId: 101 },
    { createdAt: 'bad-date' }, { sessionExpiresAt: 0 }, { size: -1 }, { submissionId: 'invalid' },
  ])('never flags invalid metadata for cleanup: %j', async (overrides) => {
    store.set(evidenceKey(id), asset(overrides));
    expect((await read()).rows[0]).toEqual({ id, status: 'unknown' });
  });

  it.each([{}, [{}], 'invalid', 'x'.repeat(2 * 1024 * 1024)])('treats malformed or oversized references as unknown', async (value) => {
    store.set(tracker.storage.submissionsKey, value);
    expect((await read()).rows[0].status).toBe('unknown');
  });

  it('preserves surplus SCAN results in bounded pages without truncation', async () => {
    for (let i = 2; i <= 25; i++) {
      const nextId = `${String(i).padStart(8, '0')}-1111-4111-8111-111111111111`;
      store.set(evidenceKey(nextId), asset({ id: nextId, pathname: `quarantine/one-ring/${nextId}.webp` }));
    }
    const first = await read();
    expect(first.rows).toHaveLength(20);
    const last = await read(first.nextCursor);
    expect(last.rows).toHaveLength(5);
    expect(last.nextCursor).toBeNull();
    expect(redis.scan).toHaveBeenCalledTimes(1);
    expect(new Set([...first.rows, ...last.rows].map((row) => row.id)).size).toBe(25);
  });

  it('bounds tracker group reads rather than declaring unchecked assets abandoned', async () => {
    store.clear();
    for (const item of generatedTrackers.slice(0, 10)) {
      const nextId = crypto.randomUUID();
      store.set(evidenceKey(nextId), asset({ id: nextId, tracker: item.slug, pathname: `quarantine/${item.slug}/${nextId}.webp` }));
    }
    const page = await read();
    expect(page.rows.filter((row) => row.status === 'candidate')).toHaveLength(8);
    expect(page.rows.filter((row) => row.status === 'unknown')).toHaveLength(2);
    expect(redis.eval).toHaveBeenCalledTimes(18);
  });

  it.each([null, {}, 'bad', 'a'.repeat(12001), Buffer.from(JSON.stringify({ scan: '0', pending: ['auth:secret'], done: true })).toString('base64url')])('rejects invalid cursors before storage reads', async (cursor) => {
    await expect(read(cursor)).rejects.toBeInstanceOf(InventoryInputError);
    expect(redis.scan).not.toHaveBeenCalled(); expect(redis.eval).not.toHaveBeenCalled();
  });
});

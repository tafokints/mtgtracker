import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { readAdminInbox } from '@/lib/admin-inbox';
import { allTrackers, getTracker } from '@/lib/trackers';
import { GET as inbox } from '@/app/api/admin/inbox/route';
import { GET as configuration } from '@/app/api/admin/configuration/route';

const fixture = vi.hoisted(() => ({ get: vi.fn(), smembers: vi.fn(), auth: vi.fn(), configured: vi.fn() }));
vi.mock('@/lib/redis', () => ({ getRedis: () => fixture, getRedisEnvStatus: () => ({ provider: 'missing' }) }));
vi.mock('@/lib/admin-auth', () => ({ requireAdmin: fixture.auth, isAdminConfigured: fixture.configured }));
const ring = getTracker('one-ring')!;
const posters = getTracker('lotr-poster-cards')!;
const generated = allTrackers.filter((tracker) => tracker.status === 'live' && tracker.catalogGenerated);
const report = (id: string, extra = {}) => ({ id, cardId: 7, serialNumber: '007', status: 'pending', submittedAt: '2026-09-05T10:00:00.000Z', notes: 'private note', payloadHash: 'private hash', link: 'https://example.com/private', evidenceImages: [], ...extra });
const params = (options = {}) => new URLSearchParams(options);
const read = (query = params()) => readAdminInbox(fixture as never, query);

describe('owner inbox and configuration', () => {
  beforeEach(() => { vi.resetAllMocks(); fixture.get.mockResolvedValue(null); fixture.smembers.mockResolvedValue([]); fixture.auth.mockResolvedValue(null); });
  it('denies anonymous reads before storage or configuration and never caches errors', async () => {
    fixture.auth.mockResolvedValue(NextResponse.json({ message: 'Unauthorized' }, { status: 401 }));
    for (const handler of [inbox, configuration]) {
      const response = await handler(new Request('https://mtgtrackers.com/api/admin/inbox'));
      expect(response.status).toBe(401); expect(response.headers.get('cache-control')).toContain('no-store');
    }
    expect(fixture.get).not.toHaveBeenCalled(); expect(fixture.smembers).not.toHaveBeenCalled(); expect(fixture.configured).not.toHaveBeenCalled();
  });
  it('reads active generated trackers and original shared-view queues without card initialization', async () => {
    fixture.smembers.mockResolvedValue([generated[0].slug, 'unknown-attacker-slug']);
    fixture.get.mockImplementation(async (key: string) => key === ring.storage.submissionsKey ? [report('ring')] : key === posters.storage.submissionsKey ? [report('poster')] : key === generated[0].storage.submissionsKey ? [report('printing')] : null);
    const page = await read();
    expect(page.rows.map((row) => row.id).sort()).toEqual(['poster', 'printing', 'ring']);
    expect(page.rows.find((row) => row.id === 'poster')?.tracker).toBe(posters.slug);
    expect(fixture.get.mock.calls.every(([key]) => key.endsWith('submissions'))).toBe(true);
    expect(fixture.get.mock.calls.length).toBeLessThan(8);
    expect(JSON.stringify(page)).not.toMatch(/private note|private hash|example\.com/);
  });
  it('has stable keyset pagination when an earlier row changes status between pages', async () => {
    let reports = Array.from({ length: 25 }, (_, i) => report(`id-${String(i).padStart(3, '0')}`));
    fixture.get.mockImplementation(async () => reports);
    const first = await read(params({ tracker: ring.slug }));
    expect(first.rows).toHaveLength(20); expect(first.nextCursor).toBeTruthy();
    reports = reports.slice(1);
    const second = await read(params({ tracker: ring.slug, cursor: first.nextCursor! }));
    expect(second.rows.map((row) => row.id)).toEqual(['id-020', 'id-021', 'id-022', 'id-023', 'id-024']);
    expect(second.nextCursor).toBeNull();
  });
  it('caps sparse queue scans and reaches later active printings through continuation', async () => {
    fixture.smembers.mockResolvedValue(generated.slice(0, 18).map((tracker) => tracker.slug));
    let page = await read(); expect(fixture.get).toHaveBeenCalledTimes(8);
    let pages = 1;
    while (page.nextCursor) { page = await read(params({ cursor: page.nextCursor })); pages++; expect(pages).toBeLessThan(10); }
    expect(fixture.get).toHaveBeenCalledTimes(18 + allTrackers.filter((tracker) => tracker.status === 'live' && !tracker.catalogGenerated).length);
  });
  it('does not miss the first report when a page boundary crosses trackers', async () => {
    fixture.get.mockImplementation(async (key: string) => key === posters.storage.submissionsKey ? Array.from({ length: 20 }, (_, i) => report(`poster-${i}`)) : key === ring.storage.submissionsKey ? [report('ring-last')] : null);
    const first = await read(); const second = await read(params({ cursor: first.nextCursor! }));
    expect(first.rows).toHaveLength(20); expect(second.rows.map((row) => row.id)).toEqual(['ring-last']);
  });
  it('supports status and tracker filters including inactive generated trackers', async () => {
    fixture.get.mockResolvedValue([report('pending'), report('approved', { status: 'approved' })]);
    expect((await read(params({ tracker: generated[2].slug, status: 'approved' }))).rows.map((row) => row.id)).toEqual(['approved']);
    expect(fixture.smembers).not.toHaveBeenCalled();
  });
  it('rejects invalid/mismatched filters and cursors before reading reports', async () => {
    for (const query of [params({ tracker: '../../secrets' }), params({ status: 'invented' }), params({ cursor: 'x'.repeat(1801) }), params({ cursor: 'bad' }), params({ cursor: Buffer.from(JSON.stringify({ tracker: ring.slug, after: '', filter: 'approved:' })).toString('base64url') })]) await expect(read(query)).rejects.toThrow();
    expect(fixture.get).not.toHaveBeenCalled();
  });
  it('reports corrupted data or provider errors without internal details or a false empty queue', async () => {
    fixture.get.mockRejectedValue(new Error('private credentials'));
    const failed = await inbox(new Request('https://mtgtrackers.com/api/admin/inbox'));
    expect(failed.status).toBe(503); expect(await failed.text()).not.toContain('private credentials');
    fixture.get.mockResolvedValue([report('bad', { originTrackerSlug: 'another-tracker' })]);
    await expect(read(params({ tracker: ring.slug }))).rejects.toThrow('Invalid report origin');
  });
  it('exposes only configuration booleans, never credentials or claims of provider verification', async () => {
    vi.stubEnv('CLOUDMERSIVE_API_KEY', 'do-not-expose-this');
    try {
      const response = await configuration(new Request('https://mtgtrackers.com/api/admin/configuration'));
      const data = await response.json();
      expect(data.services.find((service: { name: string }) => service.name === 'Malware scanner')).toEqual({ name: 'Malware scanner', configured: true });
      expect(JSON.stringify(data)).not.toContain('do-not-expose-this');
      expect(Object.keys(data)).toEqual(['services']); expect(response.headers.get('cache-control')).toContain('no-store');
    } finally { vi.unstubAllEnvs(); }
  });
  it('recognizes a connected Blob store without exposing its ID or requiring a static token', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', ''); vi.stubEnv('BLOB_STORE_ID', 'store_private-fixture-id');
    try {
      const response = await configuration(new Request('https://mtgtrackers.com/api/admin/configuration'));
      const data = await response.json();
      expect(data.services.find((service: { name: string }) => service.name === 'Private image storage')).toEqual({ name: 'Private image storage', configured: true });
      expect(JSON.stringify(data)).not.toContain('store_private-fixture-id');
    } finally { vi.unstubAllEnvs(); }
  });
});

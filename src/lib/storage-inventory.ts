import type { Redis } from '@upstash/redis';
import { EVIDENCE_ID, evidenceUrl } from './evidence-policy';
import { evidenceKey, type EvidenceAsset } from './evidence-store';
import { getTracker } from './trackers';
import { getTrackerCardSlot } from './tracker-data';
import { relatedTrackers } from './tracker-relationships';
import { validBackupCard, validBackupSubmission } from './backup-validation';

export type InventoryStatus = 'retained' | 'recent' | 'candidate' | 'unknown';
export interface InventoryRow {
  id: string; tracker?: string; card?: string; createdAt?: string; bytes?: number; status: InventoryStatus;
}
export interface StorageInventoryPage { rows: InventoryRow[]; nextCursor: string | null; checkedAt: string }
type Cursor = { scan: string; pending: string[]; done: boolean };
export class InventoryInputError extends Error {}
export const ORPHAN_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 20;

export const READ_INVENTORY_RECORDS = `
-- bounded read-only storage inventory snapshot
local values = {}
local remaining = tonumber(ARGV[1])
for _, key in ipairs(KEYS) do
  local kind = redis.call('TYPE', key)
  if type(kind) == 'table' then kind = kind.ok end
  if kind == 'none' then
    table.insert(values, { state = 'missing' })
  elseif kind ~= 'string' or redis.call('STRLEN', key) > remaining then
    table.insert(values, { state = 'unavailable' })
  else
    local raw = redis.call('GET', key)
    remaining = remaining - #raw
    table.insert(values, { state = 'present', raw = raw })
  end
end
return cjson.encode(values)
`;

async function readRecords(redis: Redis, keys: string[], budget: number): Promise<unknown[]> {
  const result = await redis.eval(READ_INVENTORY_RECORDS, keys, [budget]) as Array<{ state: string; raw?: string }>;
  if (!Array.isArray(result) || result.length !== keys.length) throw new Error('Invalid inventory snapshot');
  return result.map((item) => {
    if (item.state === 'missing') return null;
    if (item.state !== 'present' || typeof item.raw !== 'string') throw new Error('Inventory record unavailable');
    return JSON.parse(item.raw);
  });
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function referencesAsset(records: unknown[], asset: EvidenceAsset) {
  const queue = [...records];
  let visited = 0;
  while (queue.length) {
    if (++visited > 100000) throw new Error('Inventory reference budget exceeded');
    const value = queue.pop();
    if (value === asset.id || value === evidenceUrl(asset.id) || value === asset.submissionId) return true;
    if (Array.isArray(value)) queue.push(...value);
    else if (record(value)) queue.push(...Object.values(value));
  }
  return false;
}

function decodeCursor(value?: unknown): Cursor {
  if (value === undefined) return { scan: '0', pending: [], done: false };
  try {
    if (typeof value !== 'string' || value.length > 12000 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString()) as Cursor;
    if (!cursor || typeof cursor.scan !== 'string' || !/^\d{1,20}$/.test(cursor.scan) || BigInt(cursor.scan) > BigInt('18446744073709551615') ||
      typeof cursor.done !== 'boolean' || !Array.isArray(cursor.pending) || cursor.pending.length > 100 ||
      cursor.pending.some((id) => typeof id !== 'string' || !EVIDENCE_ID.test(id))) throw new Error();
    return cursor;
  } catch { throw new InventoryInputError('Invalid inventory cursor'); }
}

export async function readStorageInventory(redis: Redis, cursorValue?: unknown, now = Date.now()): Promise<StorageInventoryPage> {
  const cursor = decodeCursor(cursorValue);
  if (!cursor.pending.length && !cursor.done) {
    const [next, keys] = await redis.scan(cursor.scan, { match: 'evidence:v1:*', count: PAGE_SIZE });
    // SCAN COUNT is a hint, so explicitly bound an unexpectedly large batch.
    if (keys.length > 100) throw new Error('Inventory scan budget exceeded');
    cursor.scan = String(next);
    cursor.done = cursor.scan === '0';
    cursor.pending = [...new Set(keys.map((key) => key.slice('evidence:v1:'.length)).filter((id) => EVIDENCE_ID.test(id)))];
  }
  const ids = cursor.pending.splice(0, PAGE_SIZE);
  const rows: InventoryRow[] = [];
  const references = new Map<string, Promise<unknown[]>>();
  for (const id of ids) {
    const row: InventoryRow = { id, status: 'unknown' };
    rows.push(row);
    try {
      const [value] = await readRecords(redis, [evidenceKey(id)], 16 * 1024);
      if (!record(value) || value.id !== id || typeof value.tracker !== 'string' || typeof value.submissionId !== 'string' || !EVIDENCE_ID.test(value.submissionId)) continue;
      const asset = value as unknown as EvidenceAsset;
      const tracker = getTracker(asset.tracker);
      const slot = tracker && Number.isSafeInteger(asset.cardId) ? getTrackerCardSlot(tracker, asset.cardId) : undefined;
      const created = Date.parse(asset.createdAt);
      if (!tracker || tracker.status !== 'live' || !slot || !Number.isFinite(created) || !Number.isFinite(asset.sessionExpiresAt) ||
        asset.sessionExpiresAt < created || asset.pathname !== `quarantine/${tracker.slug}/${id}.webp` ||
        !Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > 4 * 1024 * 1024) continue;
      Object.assign(row, { tracker: tracker.slug, card: slot.name, createdAt: asset.createdAt, bytes: asset.size });
      if (now < Math.max(created, asset.sessionExpiresAt) + ORPHAN_GRACE_MS) { row.status = 'recent'; continue; }
      const related = relatedTrackers(tracker);
      const group = related.map((item) => item.slug).sort().join(':');
      if (!references.has(group)) {
        if (references.size === 8) continue;
        const sources = related.flatMap((tracker) => [
          { key: tracker.storage.cardsKey, tracker, validate: validBackupCard },
          { key: tracker.storage.submissionsKey, tracker, validate: validBackupSubmission },
          ...(tracker.storage.legacyCardsKeys || []).map((key) => ({ key, tracker, validate: validBackupCard })),
        ]);
        references.set(group, readRecords(redis, sources.map((source) => source.key), 2 * 1024 * 1024).then((records) => {
          if (records.some((value, index) => value !== null && (!Array.isArray(value) || value.some((item) => !sources[index].validate(item, sources[index].tracker))))) throw new Error('Invalid tracker records');
          return records;
        }));
      }
      row.status = referencesAsset(await references.get(group)!, asset) ? 'retained' : 'candidate';
    } catch { /* Missing, corrupt, oversized or unreadable records are never cleanup candidates. */ }
  }
  return {
    rows, checkedAt: new Date(now).toISOString(),
    nextCursor: cursor.pending.length || !cursor.done ? Buffer.from(JSON.stringify(cursor)).toString('base64url') : null,
  };
}

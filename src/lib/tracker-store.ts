import type { Redis } from '@upstash/redis';
import type { DiscoverySubmission, SerializedRingCard } from './types';
import type { TrackerSummary } from './trackers';
import { getTrackerCards, normalizeTrackerCard } from './tracker-data';

// Wrap raw values in JSON so the SDK preserves the exact bytes needed for CAS.
export const READ_TRACKER_STATE = `
return cjson.encode({
  cards = redis.call('GET', KEYS[1]) or cjson.null,
  submissions = redis.call('GET', KEYS[2]) or cjson.null
})
`;

export const COMMIT_TRACKER_STATE = `
if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1]
  or (redis.call('GET', KEYS[2]) or '') ~= ARGV[2] then
  return 0
end
if KEYS[3] then
  local kind = redis.call('TYPE', KEYS[3]).ok
  if kind ~= 'none' and kind ~= 'set' then return redis.error_reply('Invalid tracker activity index') end
end
redis.call('MSET', KEYS[1], ARGV[3], KEYS[2], ARGV[4])
if KEYS[3] then redis.call('SADD', KEYS[3], ARGV[5]) end
return 1
`;

export const ACTIVE_PRINTING_TRACKERS_KEY = 'mtgtrackers:active-printing-trackers';
export const RESTORE_PRINTING_STATE = `
-- restore printing and its derived activity index atomically
local kind = redis.call('TYPE', KEYS[3]).ok
if kind ~= 'none' and kind ~= 'set' then return redis.error_reply('Invalid tracker activity index') end
redis.call('MSET', KEYS[1], ARGV[1], KEYS[2], ARGV[2])
redis.call('SADD', KEYS[3], ARGV[3])
return 1
`;

interface RawTrackerState {
  cards: string | null;
  submissions: string | null;
}

export interface TrackerState {
  cards: SerializedRingCard[];
  submissions: DiscoverySubmission[];
}

export class TrackerStoreError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

function keys(tracker: TrackerSummary) {
  return [tracker.storage.cardsKey, tracker.storage.submissionsKey];
}

function decodeState(raw: RawTrackerState, tracker: TrackerSummary): TrackerState {
  const cards = JSON.parse(raw.cards || '[]');
  const submissions = JSON.parse(raw.submissions || '[]');
  if (!Array.isArray(cards) || !Array.isArray(submissions)) {
    throw new Error('Invalid stored tracker data');
  }
  return { cards: cards.map((card) => normalizeTrackerCard(tracker, card)), submissions };
}

export async function getTrackerState(redis: Redis, tracker: TrackerSummary): Promise<TrackerState> {
  const raw = await readInitializedState(redis, tracker);
  return decodeState(raw, tracker);
}

async function readInitializedState(redis: Redis, tracker: TrackerSummary) {
  let raw = await redis.eval<[], RawTrackerState>(READ_TRACKER_STATE, keys(tracker), []);
  if (raw.cards === null) {
    await getTrackerCards(redis, tracker);
    raw = await redis.eval<[], RawTrackerState>(READ_TRACKER_STATE, keys(tracker), []);
  }
  return raw;
}

export async function restoreTrackerState(redis: Redis, tracker: TrackerSummary, state: TrackerState) {
  if (tracker.catalogGenerated) {
    await redis.eval(RESTORE_PRINTING_STATE, [...keys(tracker), ACTIVE_PRINTING_TRACKERS_KEY], [JSON.stringify(state.cards), JSON.stringify(state.submissions), tracker.slug]);
    return;
  }
  await redis.mset({
    [tracker.storage.cardsKey]: state.cards,
    [tracker.storage.submissionsKey]: state.submissions,
  });
}

// The synchronous callback may run again after a conflict; keep side effects outside it.
export async function mutateTrackerState<T>(
  redis: Redis,
  tracker: TrackerSummary,
  update: (state: TrackerState) => T,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const raw = await readInitializedState(redis, tracker);
    const state = decodeState(raw, tracker);
    const result = update(state);
    const committed = await redis.eval<string[], number>(COMMIT_TRACKER_STATE, [...keys(tracker), ...(tracker.catalogGenerated ? [ACTIVE_PRINTING_TRACKERS_KEY] : [])], [
      raw.cards || '', raw.submissions || '',
      JSON.stringify(state.cards), JSON.stringify(state.submissions),
      ...(tracker.catalogGenerated ? [tracker.slug] : []),
    ]);
    if (committed === 1) return result;
  }

  throw new TrackerStoreError('Tracker changed during this update. Please retry.', 409);
}

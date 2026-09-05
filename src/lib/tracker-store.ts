import type { Redis } from '@upstash/redis';
import type { DiscoverySubmission, SerializedRingCard } from './types';
import type { TrackerSummary } from './trackers';
import { getTrackerCards, normalizeTrackerCard } from './tracker-data';
import { cardOwner, hasRecordedFacts, persistRelatedProjection, projectRelatedState, relatedTrackers } from './tracker-relationships';

export const READ_RELATED_STATE = `
-- read related tracker records
local values = {}
for i, key in ipairs(KEYS) do values[i] = redis.call('GET', key) or '' end
return cjson.encode(values)
`;

export const COMMIT_RELATED_STATE = `
-- commit related tracker records
local n = #KEYS
for i, key in ipairs(KEYS) do
  if (redis.call('GET', key) or '') ~= ARGV[i] then return 0 end
end
local values = {}
for i, key in ipairs(KEYS) do
  table.insert(values, key)
  table.insert(values, ARGV[n + i])
end
redis.call('MSET', unpack(values))
return 1
`;

// Wrap raw values in JSON so the SDK preserves the exact bytes needed for CAS.
export const READ_TRACKER_STATE = `
return cjson.encode({
  cards = redis.call('GET', KEYS[1]) or '',
  submissions = redis.call('GET', KEYS[2]) or ''
})
`;

export const COMMIT_TRACKER_STATE = `
if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1]
  or (redis.call('GET', KEYS[2]) or '') ~= ARGV[2] then
  return 0
end
if KEYS[3] then
  local kind = redis.call('TYPE', KEYS[3])
  if type(kind) == 'table' then kind = kind.ok end
  if kind ~= 'none' and kind ~= 'set' then return redis.error_reply('Invalid tracker activity index') end
end
redis.call('MSET', KEYS[1], ARGV[3], KEYS[2], ARGV[4])
if KEYS[3] then redis.call('SADD', KEYS[3], ARGV[5]) end
return 1
`;

export const ACTIVE_PRINTING_TRACKERS_KEY = 'mtgtrackers:active-printing-trackers';
export const RESTORE_PRINTING_STATE = `
-- restore printing and its derived activity index atomically
local kind = redis.call('TYPE', KEYS[3])
if type(kind) == 'table' then kind = kind.ok end
if kind ~= 'none' and kind ~= 'set' then return redis.error_reply('Invalid tracker activity index') end
redis.call('MSET', KEYS[1], ARGV[1], KEYS[2], ARGV[2])
redis.call('SADD', KEYS[3], ARGV[3])
return 1
`;

interface RawTrackerState {
  cards?: string | null;
  submissions?: string | null;
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
  if (!Array.isArray(cards) || cards.length === 0 || !Array.isArray(submissions)) {
    throw new Error('Invalid stored tracker data');
  }
  return { cards: cards.map((card) => normalizeTrackerCard(tracker, card)), submissions };
}

export async function getTrackerState(redis: Redis, tracker: TrackerSummary): Promise<TrackerState> {
  if (relatedTrackers(tracker).length > 1) {
    const snapshot = await readRelatedState(redis, tracker);
    return projectRelatedState(tracker, snapshot.states);
  }
  const raw = await readInitializedState(redis, tracker);
  return decodeState(raw, tracker);
}

async function readInitializedState(redis: Redis, tracker: TrackerSummary) {
  let raw = await redis.eval<[], RawTrackerState>(READ_TRACKER_STATE, keys(tracker), []);
  if (raw.cards === null || raw.cards === undefined || raw.cards === '') {
    await getTrackerCards(redis, tracker);
    raw = await redis.eval<[], RawTrackerState>(READ_TRACKER_STATE, keys(tracker), []);
  }
  return raw;
}

export async function restoreTrackerState(redis: Redis, tracker: TrackerSummary, state: TrackerState) {
  if (relatedTrackers(tracker).length > 1) {
    await mutateRelatedState(redis, tracker, (view) => {
      view.cards = state.cards;
      view.submissions = state.submissions;
    }, state);
    return;
  }
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
  if (relatedTrackers(tracker).length > 1) return mutateRelatedState(redis, tracker, update);
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

async function readRelatedState(redis: Redis, tracker: TrackerSummary, replacement?: TrackerState) {
  const related = relatedTrackers(tracker);
  const storageKeys = related.flatMap(keys);
  let raw = await redis.eval<string[], string[]>(READ_RELATED_STATE, storageKeys, []);
  for (let i = 0; i < related.length; i++) {
    if (!raw[i * 2] && !(replacement && related[i].slug === tracker.slug)) await getTrackerCards(redis, related[i]);
  }
  raw = await redis.eval<string[], string[]>(READ_RELATED_STATE, storageKeys, []);
  const states = new Map(related.map((candidate, i) => [candidate.slug, replacement && candidate.slug === tracker.slug ? structuredClone(replacement) : decodeState({ cards: raw[i * 2], submissions: raw[i * 2 + 1] }, candidate)]));
  for (const candidate of related) {
    for (const card of states.get(candidate.slug)!.cards) {
      if (!(replacement && candidate.slug === tracker.slug) && cardOwner(candidate, card).slug !== candidate.slug && hasRecordedFacts(card)) {
        throw new TrackerStoreError('Legacy shared-card records require an explicit reconciliation before this tracker can be changed or published.', 409);
      }
    }
  }
  return { related, storageKeys, raw, states };
}

async function mutateRelatedState<T>(redis: Redis, tracker: TrackerSummary, update: (state: TrackerState) => T, replacement?: TrackerState): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const snapshot = await readRelatedState(redis, tracker, replacement);
    const view = replacement ? structuredClone(replacement) : projectRelatedState(tracker, snapshot.states);
    const result = update(view);
    persistRelatedProjection(tracker, view, snapshot.states);
    if (replacement) {
      // Alias slots carry layout only; their facts were restored into the owner.
      const own = snapshot.states.get(tracker.slug)!;
      const { createInitialTrackerCards } = await import('./tracker-data');
      const slots = createInitialTrackerCards(tracker);
      own.cards = own.cards.map((card) => cardOwner(tracker, card).slug === tracker.slug ? card : slots.find((slot) => slot.id === card.id)!);
    }
    const next = snapshot.related.flatMap((candidate) => {
      const state = snapshot.states.get(candidate.slug)!;
      return [JSON.stringify(state.cards), JSON.stringify(state.submissions)];
    });
    if (await redis.eval(COMMIT_RELATED_STATE, snapshot.storageKeys, [...snapshot.raw.map((raw) => raw || ''), ...next]) === 1) return result;
  }
  throw new TrackerStoreError('A related tracker changed during this update. Please retry.', 409);
}

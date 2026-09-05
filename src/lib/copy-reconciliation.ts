import { createHash, randomUUID } from 'node:crypto';
import type { Redis } from '@upstash/redis';
import { getTracker, type TrackerSummary } from './trackers';
import { createInitialTrackerCards } from './tracker-data';
import { cardOwner, decodeRelatedCards, hasRecordedFacts, projectRelatedState, relatedTrackers } from './tracker-relationships';
import { READ_RELATED_STATE, TrackerStoreError } from './tracker-store';
import { appendCardEvent } from './card-history';
import type { DiscoverySubmission } from './types';

export const COMMIT_COPY_RECONCILIATION = `
-- reconcile legacy shared copies and retain the original snapshot
local n = #KEYS - 1
if redis.call('EXISTS', KEYS[n + 1]) ~= 0 then return 0 end
for i = 1, n do
  if (redis.call('GET', KEYS[i]) or '') ~= ARGV[i] then return 0 end
end
local values = {}
for i = 1, n do table.insert(values, KEYS[i]); table.insert(values, ARGV[n + i]) end
table.insert(values, KEYS[n + 1]); table.insert(values, ARGV[n * 2 + 1])
redis.call('MSET', unpack(values))
return 1
`;

async function snapshot(redis: Redis, tracker: TrackerSummary) {
  const related = relatedTrackers(tracker);
  const keys = related.flatMap((item) => [item.storage.cardsKey, item.storage.submissionsKey]);
  const raw = await redis.eval<string[], string[]>(READ_RELATED_STATE, keys, []);
  for (let i = 0; i < related.length; i++) {
    if (!raw[i * 2]) {
      for (const key of related[i].storage.legacyCardsKeys || []) {
        if (await redis.get(key) != null) throw new TrackerStoreError('Initialize the tracker from its legacy storage before previewing reconciliation', 409);
      }
    }
  }
  const states = new Map(related.map((candidate, i) => {
    const cards = decodeRelatedCards(candidate, raw[i * 2] ? JSON.parse(raw[i * 2]) : null);
    const submissions = raw[i * 2 + 1] ? JSON.parse(raw[i * 2 + 1]) : [];
    if (!Array.isArray(submissions)) throw new TrackerStoreError('Invalid legacy reports; restore them before reconciliation', 409);
    return [candidate.slug, { cards, submissions: submissions as DiscoverySubmission[] }];
  }));
  const candidates = related.flatMap((candidate) => states.get(candidate.slug)!.cards.flatMap((card) => {
    const owner = cardOwner(candidate, card);
    if (owner.slug === candidate.slug || !hasRecordedFacts(card)) return [];
    const canonical = states.get(owner.slug)!.cards.find((item) => item.copyId === card.copyId);
    if (!canonical) throw new TrackerStoreError('Canonical card is missing', 409);
    return [{ copyId: card.copyId!, aliasTracker: candidate.slug, aliasCard: card, ownerTracker: owner.slug, canonicalCard: canonical }];
  }));
  return { related, keys, raw, states, candidates, revision: createHash('sha256').update(JSON.stringify(raw)).digest('hex') };
}

export async function previewCopyReconciliation(redis: Redis, tracker: TrackerSummary) {
  const state = await snapshot(redis, tracker);
  return { revision: state.revision, candidates: state.candidates };
}

export async function reconcileCopies(redis: Redis, tracker: TrackerSummary, revision: string, decisions: Array<{ copyId: string; choice: 'keep-canonical' | 'adopt-legacy' }>) {
  const state = await snapshot(redis, tracker);
  if (state.revision !== revision) throw new TrackerStoreError('Records changed since the preview. Preview them again.', 409);
  if (!state.candidates.length || decisions.length !== state.candidates.length || new Set(decisions.map((item) => item.copyId)).size !== decisions.length) throw new TrackerStoreError('An explicit decision is required for every conflicting copy', 400);
  const id = randomUUID();
  const at = new Date().toISOString();
  for (const candidate of state.candidates) {
    const choice = decisions.find((item) => item.copyId === candidate.copyId)?.choice;
    if (!choice || !['keep-canonical', 'adopt-legacy'].includes(choice)) throw new TrackerStoreError('Invalid reconciliation choice', 400);
    const owner = state.states.get(candidate.ownerTracker)!;
    const index = owner.cards.findIndex((card) => card.copyId === candidate.copyId);
    const slot = owner.cards[index];
    if (choice === 'adopt-legacy') owner.cards[index] = { ...candidate.aliasCard, id: slot.id, cardSlug: slot.cardSlug, cardTitle: slot.cardTitle, name: slot.name };
    appendCardEvent(owner.cards[index], { id: `reconciliation:${id}:${candidate.copyId}`, kind: 'correction', recordedAt: at, facts: {} });
    const alias = state.states.get(candidate.aliasTracker)!;
    const initial = createInitialTrackerCards(getTracker(candidate.aliasTracker)!);
    alias.cards = alias.cards.map((card) => card.copyId === candidate.copyId ? initial.find((item) => item.id === card.id)! : card);
  }
  projectRelatedState(tracker, state.states);
  const values = state.related.flatMap((candidate) => {
    const data = state.states.get(candidate.slug)!;
    return [JSON.stringify(data.cards), JSON.stringify(data.submissions)];
  });
  const archiveKey = `copy-reconciliation:v1:${id}`;
  const archive = JSON.stringify({ id, at, actor: 'admin', decisions, keys: state.keys, originals: state.raw });
  const committed = await redis.eval(COMMIT_COPY_RECONCILIATION, [...state.keys, archiveKey], [...state.raw.map((value) => value || ''), ...values, archive]);
  if (committed !== 1) throw new TrackerStoreError('Records changed during reconciliation. Preview them again.', 409);
  return { archiveKey, reconciledCopies: decisions.length };
}

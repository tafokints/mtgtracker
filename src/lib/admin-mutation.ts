import { createHash, randomUUID } from 'node:crypto';
import type { Redis } from '@upstash/redis';
import { getAdminPrincipal } from './admin-auth';
import { appendCardEvent } from './card-history';
import { EVIDENCE_ID } from './evidence-policy';
import { getTrackerCardSlot } from './tracker-data';
import { getTrackerState, mutateTrackerState, TrackerStoreError } from './tracker-store';
import type { TrackerSummary } from './trackers';
import type { CardHistoryEvent, DiscoverySubmission, SerializedRingCard } from './types';

type Receipt = NonNullable<CardHistoryEvent['adminMutation']>;
type Edit = Pick<CardHistoryEvent, 'facts' | 'price' | 'grading' | 'sourceSubmissionId'>;

function wasRecorded(card: SerializedRingCard, receipt: Receipt) {
  const previous = card.history?.find((event) => event.adminMutation?.id === receipt.id)?.adminMutation;
  if (!previous) return false;
  if (previous.payloadHash !== receipt.payloadHash || previous.actorId !== receipt.actorId) {
    throw new TrackerStoreError('This request ID was already used for a different edit. Refresh and try again.', 409);
  }
  return true;
}

export async function recordAdminMutation(options: {
  request: Request; redis: Redis; tracker: TrackerSummary; cardId: number;
  kind: 'price' | 'grading' | 'image'; payload: unknown;
  check?: () => Promise<unknown>;
  edit: (card: SerializedRingCard, submissions: DiscoverySubmission[], event: { id: string; recordedAt: string }) => Edit;
}) {
  const { request, redis, tracker, cardId, kind } = options;
  const id = request.headers.get('Idempotency-Key');
  if (!id || !EVIDENCE_ID.test(id)) throw new TrackerStoreError('A valid save request ID is required. Refresh the page and try again.', 400);
  const principal = await getAdminPrincipal(request);
  if (!principal) throw new TrackerStoreError('Unauthorized', 401);
  const slot = getTrackerCardSlot(tracker, cardId);
  if (!slot) throw new TrackerStoreError('Card not found', 404);
  const receipt: Receipt = {
    id, actorId: principal.id,
    payloadHash: createHash('sha256').update(JSON.stringify([slot.copyId, kind, options.payload])).digest('hex'),
  };
  const current = (await getTrackerState(redis, tracker)).cards.find((card) => card.id === cardId);
  if (!current) throw new TrackerStoreError('Card not found', 404);
  // A committed retry is a read, even after later edits/retractions or provider outages.
  if (wasRecorded(current, receipt)) return { card: current, replayed: true };
  if (!current.found) throw new TrackerStoreError('Approve a discovery before editing its history', 409);
  await options.check?.();
  const event = { id: randomUUID(), recordedAt: new Date().toISOString() };
  return mutateTrackerState(redis, tracker, ({ cards, submissions }) => {
    const card = cards.find((item) => item.id === cardId);
    if (!card) throw new TrackerStoreError('Card not found', 404);
    if (wasRecorded(card, receipt)) return { card, replayed: true };
    if (!card.found) throw new TrackerStoreError('Approve a discovery before editing its history', 409);
    appendCardEvent(card, { ...event, kind, ...options.edit(card, submissions, event), adminMutation: receipt });
    return { card, replayed: false };
  });
}

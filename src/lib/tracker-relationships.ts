import { allTrackers, getTracker, type TrackerSummary } from './trackers';
import { createInitialTrackerCards, normalizeTrackerCard } from './tracker-data';
import type { DiscoverySubmission, SerializedRingCard } from './types';

export interface RelatedState { cards: SerializedRingCard[]; submissions: DiscoverySubmission[] }

export function relatedTrackers(tracker: TrackerSummary) {
  const owners = new Set([tracker.slug, ...(tracker.cardDefinitions || []).flatMap((card) => card.canonicalTrackerSlug || [])]);
  return allTrackers.filter((candidate) => owners.has(candidate.slug) || candidate.cardDefinitions?.some((card) => card.canonicalTrackerSlug && owners.has(card.canonicalTrackerSlug)));
}

export function cardOwner(tracker: TrackerSummary, card: SerializedRingCard) {
  const alias = tracker.cardDefinitions?.find((definition) => definition.slug === card.cardSlug)?.canonicalTrackerSlug;
  return alias ? getTracker(alias)! : tracker;
}

export function hasRecordedFacts(card: SerializedRingCard) {
  return Boolean(card.found || card.history?.length || card.priceHistory?.length || card.grading || card.evidenceImages?.length || card.notes || card.link || card.foundBy || card.dateFound || card.price !== undefined);
}

export function projectRelatedState(tracker: TrackerSummary, states: Map<string, RelatedState>): RelatedState {
  const own = states.get(tracker.slug)!;
  const cards = own.cards.map((slot) => {
    const owner = cardOwner(tracker, slot);
    if (owner.slug === tracker.slug) return slot;
    const canonical = states.get(owner.slug)?.cards.find((card) => card.copyId === slot.copyId);
    if (!canonical) throw new Error('Canonical copy is missing');
    return { ...canonical, id: slot.id, cardSlug: slot.cardSlug, cardTitle: slot.cardTitle, name: slot.name };
  });
  const byCopy = new Map(cards.map((card) => [card.copyId, card]));
  const submissions: DiscoverySubmission[] = [];
  const seen = new Set<string>();
  for (const [origin, state] of states) {
    for (const report of state.submissions) {
      const copyId = state.cards.find((card) => card.id === report.cardId)?.copyId;
      const slot = byCopy.get(copyId);
      if (!slot) continue;
      if (seen.has(report.id)) throw new Error('Duplicate report identity across trackers requires reconciliation');
      seen.add(report.id);
      submissions.push({ ...report, cardId: slot.id, cardSlug: slot.cardSlug, cardTitle: slot.cardTitle, serialNumber: slot.serialNumber, serialTotal: slot.serialTotal, copyId, originTrackerSlug: origin, originCardId: report.cardId });
    }
  }
  return { cards, submissions };
}

export function persistRelatedProjection(tracker: TrackerSummary, view: RelatedState, states: Map<string, RelatedState>) {
  const visibleCopies = new Set(view.cards.map((card) => card.copyId));
  for (const card of view.cards) {
    const owner = cardOwner(tracker, card);
    const target = states.get(owner.slug)!;
    const index = target.cards.findIndex((slot) => slot.copyId === card.copyId);
    const slot = target.cards[index];
    if (!slot) throw new Error('Canonical copy is missing');
    target.cards[index] = { ...card, id: slot.id, cardSlug: slot.cardSlug, cardTitle: slot.cardTitle, name: slot.name };
  }
  for (const [origin, state] of states) {
    state.submissions = state.submissions.filter((report) => !visibleCopies.has(state.cards.find((card) => card.id === report.cardId)?.copyId));
    for (const report of view.submissions) {
      if ((report.originTrackerSlug || tracker.slug) !== origin) continue;
      const slot = state.cards.find((card) => card.copyId === (report.copyId || view.cards.find((card) => card.id === report.cardId)?.copyId));
      if (!slot) throw new Error('Report copy identity is invalid');
      state.submissions.push({ ...report, cardId: slot.id, cardSlug: slot.cardSlug, cardTitle: slot.cardTitle, serialNumber: slot.serialNumber, serialTotal: slot.serialTotal, copyId: slot.copyId, originTrackerSlug: origin, originCardId: slot.id });
    }
  }
}

export function decodeRelatedCards(tracker: TrackerSummary, stored: unknown) {
  if (stored == null) return createInitialTrackerCards(tracker);
  if (!Array.isArray(stored) || !stored.length) throw new Error('Invalid stored tracker cards');
  return stored.map((card) => normalizeTrackerCard(tracker, card));
}

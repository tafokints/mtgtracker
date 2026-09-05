import { describe, expect, it } from 'vitest';
import { appendCardEvent, retractReportEvents } from '@/lib/card-history';
import { applyApprovedSubmission, createInitialTrackerCards, getRecentTrackerDiscoveriesSnapshot, getTrackerSlotId, normalizeTrackerCard, getTrackerCardDefinitions } from '@/lib/tracker-data';
import { allTrackers, getTracker } from '@/lib/trackers';
import { parseGradingInfo, parsePriceObservation } from '@/lib/history-validation';
import { validBackupCard, validBackupSubmission } from '@/lib/backup-validation';
import type { DiscoverySubmission } from '@/lib/types';

const ring = getTracker('one-ring')!;
const posters = getTracker('lotr-poster-cards')!;
const at = '2026-09-05T12:00:00.000Z';
function report(overrides: Partial<DiscoverySubmission> = {}): DiscoverySubmission {
  return { id: 'first', cardId: 7, serialNumber: '007', submittedAt: at, status: 'pending', foundBy: 'Original finder', dateFound: '2025-01-01', sourceType: 'marketplace', requestedVerificationStatus: 'confirmed', evidenceImages: [], notes: 'Original opening', link: 'https://www.ebay.com/itm/123456789012', ...overrides };
}

describe('one copy with many historical observations', () => {
  it('assigns every live printing one explicit canonical owner across the catalog', () => {
    const owners = new Map<string, string>();
    for (const tracker of allTrackers.filter((tracker) => tracker.status === 'live')) {
      for (const definition of getTrackerCardDefinitions(tracker)) {
        expect(definition.printingId, `${tracker.slug}/${definition.slug}`).toBeTruthy();
        const owner = definition.canonicalTrackerSlug || tracker.slug;
        if (owners.has(definition.printingId!)) expect(owners.get(definition.printingId!)).toBe(owner);
        owners.set(definition.printingId!, owner);
      }
    }
  });
  it('uses the same permanent identity in standalone and set views', () => {
    const slot = getTrackerSlotId(posters, 'the-one-ring', 7)!;
    expect(createInitialTrackerCards(ring)[6].copyId).toBe(createInitialTrackerCards(posters)[slot - 1].copyId);
  });

  it('preserves original discovery and stronger verification on a later sighting', () => {
    const cards = createInitialTrackerCards(ring);
    applyApprovedSubmission(ring, cards, report(), {});
    applyApprovedSubmission(ring, cards, report({ id: 'second', kind: 'sighting', foundBy: 'Later observer', dateFound: '2026-09-05', link: undefined, notes: undefined, requestedVerificationStatus: 'unverified' }), {});
    expect(cards[6]).toMatchObject({ foundBy: 'Original finder', dateFound: '2025-01-01', verificationStatus: 'confirmed', notes: 'Original opening', link: 'https://www.ebay.com/itm/123456789012' });
    expect(cards[6].history).toHaveLength(2);
    expect(cards[6].history![1].facts?.dateFound).toBe('2026-09-05');
  });

  it('requires an explicit correction and can retract it without losing the original', () => {
    const cards = createInitialTrackerCards(ring);
    applyApprovedSubmission(ring, cards, report(), {});
    applyApprovedSubmission(ring, cards, report({ id: 'correction', kind: 'correction', foundBy: 'Corrected finder' }), { applyCorrection: true });
    expect(cards[6].foundBy).toBe('Corrected finder');
    retractReportEvents(cards[6], 'correction', 'retract', at);
    expect(cards[6].foundBy).toBe('Original finder');
    expect(cards[6].history).toHaveLength(3);
  });

  it('does not publish private moderator notes', () => {
    const cards = createInitialTrackerCards(ring);
    applyApprovedSubmission(ring, cards, report(), { reviewNotes: 'Private investigation note' });
    expect(JSON.stringify(cards[6])).not.toContain('Private investigation');
  });

  it('deduplicates source-backed transactions, not unrelated sightings', () => {
    const cards = createInitialTrackerCards(ring);
    const sale = { price: 1000, priceKind: 'completed-sale' as const, currency: 'USD', priceDate: '2026-08-01' };
    applyApprovedSubmission(ring, cards, report(sale), {});
    applyApprovedSubmission(ring, cards, report({ ...sale, id: 'duplicate-sale' }), {});
    expect(cards[6].priceHistory).toHaveLength(1);
    expect(cards[6].priceHistory[0].soldBy).toBeUndefined();
    retractReportEvents(cards[6], 'first', 'retract-first', at);
    expect(cards[6].priceHistory).toHaveLength(1);
    expect(cards[6].priceHistory[0].sourceSubmissionId).toBe('duplicate-sale');
  });

  it('keeps asking, non-USD and unclassified prices out of USD sale statistics', () => {
    const cards = createInitialTrackerCards(ring);
    applyApprovedSubmission(ring, cards, report({ price: 5000 }), {});
    appendCardEvent(cards[6], { id: 'asking', kind: 'price', recordedAt: at, price: { price: 7000, date: '2026-09-01', kind: 'asking-price', currency: 'USD' } });
    appendCardEvent(cards[6], { id: 'eur', kind: 'price', recordedAt: at, price: { price: 4000, date: '2026-09-02', kind: 'completed-sale', currency: 'EUR' } });
    expect(cards[6].priceHistory).toHaveLength(3);
    expect(cards[6].price).toBeUndefined();
    expect(cards[6].priceHistory.find((entry) => entry.kind === 'unknown')?.date).toBe('');
  });

  it('does not replace a recent sale with a backfilled older transaction', () => {
    const card = createInitialTrackerCards(ring)[6];
    for (const [id, date, price] of [['recent', '2026-09-01', 2000], ['older', '2025-01-01', 500]] as const) appendCardEvent(card, { id, kind: 'price', recordedAt: at, price: { price, date, kind: 'completed-sale', currency: 'USD' } });
    expect(card.price).toBe(2000);
    expect(card.priceHistory).toHaveLength(2);
  });

  it('preserves legacy prices without treating their currency or sale type as known', () => {
    const legacy = { ...createInitialTrackerCards(ring)[6], price: 1200, priceDate: '2025-01-01', grading: { service: 'PSA', grade: 9 } };
    const normalized = normalizeTrackerCard(ring, legacy);
    expect(normalized.price).toBeUndefined();
    expect(normalized.priceHistory).toEqual([{ id: 'legacy-price', price: 1200, date: '2025-01-01', kind: 'unknown' }]);
    expect(legacy.price).toBe(1200);
    expect(normalized.gradingHistory).toHaveLength(1);
    expect(validBackupCard(normalized, ring)).toBe(true);
  });

  it('preserves regrades, certificates and later observations of an ungraded card', () => {
    const card = createInitialTrackerCards(ring)[6];
    appendCardEvent(card, { id: 'psa', kind: 'grading', recordedAt: at, grading: { id: 'psa', status: 'graded', occurredOn: '2026-01-01', recordedAt: at, grading: { service: 'PSA', grade: 9, certificateNumber: '123' } } });
    appendCardEvent(card, { id: 'bgs', kind: 'grading', recordedAt: at, grading: { id: 'bgs', status: 'graded', occurredOn: '2026-03-01', recordedAt: at, grading: { service: 'BGS', grade: 9.5, certificateNumber: '456' } } });
    expect(card.grading?.service).toBe('BGS');
    appendCardEvent(card, { id: 'raw', kind: 'grading', recordedAt: at, grading: { id: 'raw', status: 'ungraded', occurredOn: '2026-04-01', recordedAt: at } });
    expect(card.grading).toBeUndefined();
    expect(card.gradingHistory).toHaveLength(3);
    expect(card.found).toBe(false);
    expect(card.verificationStatus).toBe('unverified');
  });

  it('can reapprove after retraction even at an identical timestamp', () => {
    const cards = createInitialTrackerCards(ring);
    applyApprovedSubmission(ring, cards, report(), { eventId: 'review-1' });
    retractReportEvents(cards[6], 'first', 'retract', at);
    expect(cards[6].found).toBe(false);
    applyApprovedSubmission(ring, cards, report(), { eventId: 'review-2' });
    expect(cards[6].found).toBe(true);
    expect(cards[6].history).toHaveLength(3);
  });

  it('preserves merged observations and retracts them with their parent approval', () => {
    const cards = createInitialTrackerCards(ring);
    applyApprovedSubmission(ring, cards, report(), { mergedEvidenceSubmissions: [report({ id: 'merged', price: 2000, currency: 'USD', priceKind: 'completed-sale', priceDate: '2026-09-01', grading: { service: 'PSA', grade: 9 } })] });
    expect(cards[6].price).toBe(2000);
    expect(cards[6].grading?.service).toBe('PSA');
    expect(cards[6].history).toHaveLength(2);
    retractReportEvents(cards[6], 'first', 'withdraw', at);
    expect(cards[6].price).toBeUndefined();
    expect(cards[6].grading).toBeUndefined();
  });

  it('publishes a shared discovery only once in aggregate feeds', async () => {
    const cards = createInitialTrackerCards(ring);
    applyApprovedSubmission(ring, cards, report(), {});
    const store = new Map<string, unknown>([[ring.storage.cardsKey, cards], [posters.storage.cardsKey, createInitialTrackerCards(posters)]]);
    const feed = await getRecentTrackerDiscoveriesSnapshot({ get: async (key: string) => store.get(key) }, [ring, posters], 10);
    expect(feed).toHaveLength(1);
    expect(feed[0].trackerSlug).toBe('one-ring');
  });

  it('validates journals and origins during restore', () => {
    const cards = createInitialTrackerCards(ring);
    applyApprovedSubmission(ring, cards, report({ price: 700 }), {});
    expect(validBackupCard(cards[6], ring)).toBe(true);
    const forged = structuredClone(cards[6]);
    forged.history![0].facts!.link = 'javascript:alert(1)';
    expect(validBackupCard(forged, ring)).toBe(false);
    expect(validBackupSubmission(report({ originTrackerSlug: 'edgar-markov', originCardId: 7 }), ring)).toBe(false);
  });

  it('rejects incomplete transaction classification and malformed grading', () => {
    expect(() => parsePriceObservation({ price: 10, kind: 'completed-sale' })).toThrow();
    expect(() => parsePriceObservation({ price: 10, kind: 'completed-sale', date: '2026-02-30', currency: 'USD' })).toThrow();
    expect(() => parseGradingInfo({ service: 'PSA', grade: 11 })).toThrow();
  });
});

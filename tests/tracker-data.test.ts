import { describe, expect, it } from 'vitest';
import { DiscoverySubmission } from '@/lib/types';
import { getTracker } from '@/lib/trackers';
import {
  applyApprovedSubmission,
  createInitialTrackerCards,
  formatTrackerSerial,
  withPendingReportCounts,
} from '@/lib/tracker-data';

const tracker = getTracker('one-ring');

if (!tracker) {
  throw new Error('one-ring tracker fixture is missing');
}

function submission(overrides: Partial<DiscoverySubmission> = {}): DiscoverySubmission {
  return {
    id: 'submission-1',
    cardId: 7,
    serialNumber: '007',
    foundBy: 'Collector',
    dateFound: '2026-06-30',
    link: 'https://example.com/source',
    sourceType: 'marketplace',
    requestedVerificationStatus: 'source-linked',
    price: 1000,
    imageUrl: 'https://example.com/card.jpg',
    evidenceImages: [{ url: 'https://example.com/evidence.jpg' }],
    notes: 'Submitted note',
    status: 'pending',
    submittedAt: '2026-06-30T00:00:00.000Z',
    ...overrides,
  };
}

describe('tracker data helpers', () => {
  it('formats and initializes serialized tracker cards', () => {
    const cards = createInitialTrackerCards(tracker);

    expect(formatTrackerSerial(tracker, 7)).toBe('007');
    expect(cards).toHaveLength(100);
    expect(cards[6]).toMatchObject({
      id: 7,
      serialNumber: '007',
      found: false,
      verificationStatus: 'unverified',
      image: tracker.referenceImage,
    });
  });

  it('adds pending report counts without mutating source cards', () => {
    const cards = createInitialTrackerCards(tracker).slice(0, 3);
    const counted = withPendingReportCounts(cards, [
      submission({ id: 'a', cardId: 1, status: 'pending' }),
      submission({ id: 'b', cardId: 1, status: 'pending' }),
      submission({ id: 'c', cardId: 2, status: 'approved' }),
    ]);

    expect(counted.map((card) => card.pendingReports)).toEqual([2, 0, 0]);
    expect(cards[0].pendingReports).toBeUndefined();
  });

  it('applies approved submissions to cards with selected evidence and price history', () => {
    const cards = createInitialTrackerCards(tracker);
    const applied = applyApprovedSubmission(tracker, cards, submission(), {
      imageUrl: 'https://example.com/admin-selected.jpg',
      verificationStatus: 'confirmed',
      reviewNotes: 'Admin verified.',
    });

    expect(applied).toBe(true);
    expect(cards[6]).toMatchObject({
      found: true,
      foundBy: 'Collector',
      dateFound: '2026-06-30',
      link: 'https://example.com/source',
      sourceType: 'marketplace',
      verificationStatus: 'confirmed',
      notes: 'Submitted note\n\nAdmin verified.',
      image: 'https://example.com/admin-selected.jpg',
      price: 1000,
      priceDate: '2026-06-30',
    });
    expect(cards[6].priceHistory[0]).toEqual({
      price: 1000,
      date: '2026-06-30',
      soldBy: 'Collector',
    });
  });

  it('returns false when approval targets a missing card', () => {
    const cards = createInitialTrackerCards(tracker);
    const applied = applyApprovedSubmission(tracker, cards, submission({ cardId: 999 }), {});

    expect(applied).toBe(false);
  });
});

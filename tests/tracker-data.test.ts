import { describe, expect, it } from 'vitest';
import { DiscoverySubmission } from '@/lib/types';
import { getTracker, trackers } from '@/lib/trackers';
import {
  applyApprovedSubmission,
  createInitialTrackerCards,
  formatTrackerSerial,
  formatTrackerCardLabel,
  getTrackerSlotId,
  getTrackerTotalSlots,
  getTrackerDirectoryStats,
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

  it('summarizes directory stats for located, confirmed, and pending records', () => {
    const cards = createInitialTrackerCards(tracker).slice(0, 4);
    cards[0] = { ...cards[0], found: true, verificationStatus: 'confirmed' };
    cards[1] = { ...cards[1], found: true, verificationStatus: 'source-linked' };

    const stats = getTrackerDirectoryStats(cards, [
      submission({ id: 'a', cardId: 3, status: 'pending' }),
      submission({ id: 'b', cardId: 4, status: 'pending' }),
      submission({ id: 'c', cardId: 2, status: 'approved' }),
    ]);

    expect(stats).toEqual({
      foundCount: 2,
      confirmedCount: 1,
      pendingReportCount: 2,
    });
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
    expect(cards[6].evidenceImages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: 'https://example.com/admin-selected.jpg',
        caption: 'Admin selected primary image',
        sourceSubmissionId: 'submission-1',
      }),
      expect.objectContaining({
        url: 'https://example.com/card.jpg',
        caption: 'Approved report primary image',
        sourceSubmissionId: 'submission-1',
      }),
      expect.objectContaining({
        url: 'https://example.com/evidence.jpg',
        caption: 'Approved report evidence 1',
        sourceSubmissionId: 'submission-1',
      }),
    ]));
    expect(cards[6].priceHistory[0]).toEqual({
      price: 1000,
      date: '2026-06-30',
      soldBy: 'Collector',
    });
  });

  it('merges evidence from related submissions during approval', () => {
    const cards = createInitialTrackerCards(tracker);
    const applied = applyApprovedSubmission(tracker, cards, submission(), {
      mergedEvidenceSubmissions: [
        submission({
          id: 'merged-submission',
          imageUrl: 'https://example.com/merged-card.jpg',
          evidenceImages: [{ url: 'https://example.com/merged-evidence.jpg' }],
        }),
      ],
    });

    expect(applied).toBe(true);
    expect(cards[6].evidenceImages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: 'https://example.com/merged-card.jpg',
        caption: 'Merged report primary image',
        sourceSubmissionId: 'merged-submission',
      }),
      expect.objectContaining({
        url: 'https://example.com/merged-evidence.jpg',
        caption: 'Merged report evidence 1',
        sourceSubmissionId: 'merged-submission',
      }),
    ]));
  });

  it('returns false when approval targets a missing card', () => {
    const cards = createInitialTrackerCards(tracker);
    const applied = applyApprovedSubmission(tracker, cards, submission({ cardId: 999 }), {});

    expect(applied).toBe(false);
  });

  it('initializes multi-card tracker slots by card and serial', () => {
    const posterTracker = getTracker('lotr-poster-cards');
    if (!posterTracker) throw new Error('lotr-poster-cards tracker fixture is missing');

    const cards = createInitialTrackerCards(posterTracker);

    expect(getTrackerTotalSlots(posterTracker)).toBe(2000);
    expect(cards).toHaveLength(2000);
    expect(cards[0]).toMatchObject({
      id: 1,
      cardSlug: 'dawn-of-a-new-age',
      cardTitle: 'Dawn of a New Age',
      serialNumber: '001',
      serialTotal: 100,
      name: 'Dawn of a New Age 001/100',
    });
    expect(cards[100]).toMatchObject({
      id: 101,
      cardSlug: 'gandalf-the-white',
      cardTitle: 'Gandalf the White',
      serialNumber: '001',
      serialTotal: 100,
    });
    expect(getTrackerSlotId(posterTracker, 'the-one-ring', 7)).toBe(1707);
    expect(formatTrackerCardLabel(posterTracker, cards[1706])).toBe('The One Ring 007/100');
  });
});

describe('tracker config', () => {
  it('keeps live trackers anchored to external reference sources', () => {
    const liveTrackers = trackers.filter((entry) => entry.status === 'live');

    expect(liveTrackers.length).toBeGreaterThan(0);

    for (const entry of liveTrackers) {
      expect(entry.referenceLinks?.length, `${entry.slug} reference links`).toBeGreaterThanOrEqual(2);
      expect(entry.referenceLinks?.some((link) => link.type === 'official')).toBe(true);
      expect(entry.referenceLinks?.some((link) => link.type === 'scryfall')).toBe(true);

      for (const link of entry.referenceLinks || []) {
        expect(link.href, `${entry.slug} ${link.label}`).toMatch(/^https:\/\//);
      }
    }
  });
});

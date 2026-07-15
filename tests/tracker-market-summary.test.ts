import { describe, expect, it } from 'vitest';
import { getTrackerMarketSummary } from '@/lib/tracker-market-summary';
import { trackers } from '@/lib/trackers';
import type { SerializedRingCard } from '@/lib/types';

const tracker = trackers.find((candidate) => candidate.slug === 'one-ring');

if (!tracker) {
  throw new Error('Expected one-ring tracker fixture');
}

describe('tracker market summary', () => {
  it('summarizes reviewed discoveries, evidence, market signals, and pending reports', () => {
    const cards: SerializedRingCard[] = [
      {
        id: 1,
        serialNumber: '001',
        name: 'The One Ring',
        found: true,
        verificationStatus: 'confirmed',
        sourceType: 'marketplace',
        price: 1000,
        evidenceImages: [{ url: 'https://example.com/evidence.jpg', uploadedAt: '2026-07-14T00:00:00.000Z' }],
        priceHistory: [],
      },
      {
        id: 2,
        serialNumber: '002',
        name: 'The One Ring',
        found: true,
        verificationStatus: 'source-linked',
        image: 'https://example.com/card.jpg',
        priceHistory: [],
      },
      {
        id: 3,
        serialNumber: '003',
        name: 'The One Ring',
        found: false,
        verificationStatus: 'unverified',
        pendingReports: 2,
        priceHistory: [],
      },
    ];

    expect(getTrackerMarketSummary(tracker, cards)).toMatchObject({
      foundCount: 2,
      confirmedCount: 1,
      sourceLinkedCount: 1,
      evidenceBackedCount: 2,
      marketplaceSourceCount: 1,
      saleDataCount: 1,
      pendingReportCount: 2,
      primaryMerchant: 'ebay',
      primaryMerchantLabel: 'eBay',
    });
  });

  it('starts with TCGplayer when no serials are located yet', () => {
    const summary = getTrackerMarketSummary(tracker, []);

    expect(summary.primaryMerchant).toBe('tcgplayer');
    expect(summary.trustSignals[0]).toMatchObject({
      label: 'Reviewed discoveries',
      value: `0/${tracker.total}`,
    });
  });
});

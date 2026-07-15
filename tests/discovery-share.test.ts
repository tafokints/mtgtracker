import { describe, expect, it } from 'vitest';
import { buildDiscoveryDetailUrl, buildDiscoveryShareLinks, buildDiscoveryShareText, buildDiscoveryShareTitle, getPromotionCandidates } from '@/lib/discovery-share';
import { getTracker } from '@/lib/trackers';
import type { DiscoverySubmission, SerializedRingCard } from '@/lib/types';

const tracker = getTracker('one-ring');

if (!tracker) {
  throw new Error('one-ring tracker fixture is missing');
}

function card(overrides: Partial<SerializedRingCard> = {}): SerializedRingCard {
  return {
    id: 7,
    serialNumber: '007',
    name: 'The One Ring 007/100',
    found: true,
    foundBy: 'Collector A',
    dateFound: '2026-07-14',
    sourceType: 'marketplace',
    verificationStatus: 'source-linked',
    price: 12500,
    priceHistory: [],
    ...overrides,
  };
}

function submission(overrides: Partial<DiscoverySubmission> = {}): DiscoverySubmission {
  return {
    id: 'submission-1',
    cardId: 7,
    serialNumber: '007',
    sourceType: 'marketplace',
    requestedVerificationStatus: 'source-linked',
    evidenceImages: [],
    status: 'approved',
    submittedAt: '2026-07-14T00:00:00.000Z',
    reviewedAt: '2026-07-14T01:00:00.000Z',
    ...overrides,
  };
}

describe('discovery share text', () => {
  it('builds a share-ready located serial summary with the exact detail URL', () => {
    expect(buildDiscoveryShareText(
      tracker,
      card(),
      'https://mtgtrackers.com/trackers/one-ring?serial=007',
    )).toBe([
      'MTG serialized discovery: The One Ring 007/100',
      'Status: Located (source linked)',
      'Source: marketplace',
      'Found by: Collector A',
      'Date found: 2026-07-14',
      'Reported price: $12,500',
      'Track it: https://mtgtrackers.com/trackers/one-ring?serial=007',
    ].join('\n'));
  });

  it('omits optional fields that have not been recorded', () => {
    expect(buildDiscoveryShareText(
      tracker,
      card({
        foundBy: undefined,
        dateFound: undefined,
        sourceType: undefined,
        price: undefined,
        verificationStatus: 'confirmed',
      }),
      'https://mtgtrackers.com/trackers/one-ring?serial=007',
    )).toBe([
      'MTG serialized discovery: The One Ring 007/100',
      'Status: Located (confirmed)',
      'Track it: https://mtgtrackers.com/trackers/one-ring?serial=007',
    ].join('\n'));
  });

  it('builds platform share links from the exact detail URL', () => {
    const links = buildDiscoveryShareLinks(
      tracker,
      card(),
      'https://mtgtrackers.com/trackers/one-ring?serial=007',
    );

    const xUrl = new URL(links.x);
    const redditUrl = new URL(links.reddit);

    expect(buildDiscoveryShareTitle(tracker, card())).toBe('The One Ring 007/100 spotted on MTG Trackers');
    expect(xUrl.hostname).toBe('twitter.com');
    expect(xUrl.searchParams.get('text')).toBe([
      'The One Ring 007/100 spotted on MTG Trackers',
      'https://mtgtrackers.com/trackers/one-ring?serial=007',
    ].join('\n'));
    expect(redditUrl.hostname).toBe('www.reddit.com');
    expect(redditUrl.searchParams.get('url')).toBe('https://mtgtrackers.com/trackers/one-ring?serial=007');
    expect(redditUrl.searchParams.get('title')).toBe('The One Ring 007/100 spotted on MTG Trackers');
  });

  it('ranks approved promotion candidates by evidence strength before recency', () => {
    const candidates = getPromotionCandidates(
      tracker,
      [
        card({
          id: 1,
          serialNumber: '001',
          verificationStatus: 'source-linked',
          evidenceImages: [],
          price: undefined,
        }),
        card({
          id: 7,
          serialNumber: '007',
          verificationStatus: 'confirmed',
          evidenceImages: [{ url: 'https://example.com/evidence.jpg' }],
        }),
      ],
      [
        submission({
          id: 'recent-weak',
          cardId: 1,
          serialNumber: '001',
          requestedVerificationStatus: 'source-linked',
          reviewedAt: '2026-07-16T00:00:00.000Z',
        }),
        submission({
          id: 'older-strong',
          cardId: 7,
          serialNumber: '007',
          requestedVerificationStatus: 'confirmed',
          link: 'https://example.com/source',
          evidenceImages: [{ url: 'https://example.com/evidence.jpg' }],
          price: 12500,
          reviewedAt: '2026-07-15T00:00:00.000Z',
        }),
      ],
      2,
    );

    expect(buildDiscoveryDetailUrl(tracker, card(), 'https://mtgtrackers.com/')).toBe(
      'https://mtgtrackers.com/trackers/one-ring?serial=007',
    );
    expect(candidates.map((candidate) => candidate.submission.id)).toEqual(['older-strong', 'recent-weak']);
    expect(candidates[0].detailUrl).toBe('https://mtgtrackers.com/trackers/one-ring?serial=007');
    expect(candidates[0].reasons).toEqual(expect.arrayContaining(['confirmed', 'source', 'price']));
    expect(candidates[0].shareText).toContain('Track it: https://mtgtrackers.com/trackers/one-ring?serial=007');
  });
});

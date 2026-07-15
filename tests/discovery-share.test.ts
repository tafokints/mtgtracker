import { describe, expect, it } from 'vitest';
import { buildDiscoveryShareText } from '@/lib/discovery-share';
import { getTracker } from '@/lib/trackers';
import type { SerializedRingCard } from '@/lib/types';

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
});

import { describe, expect, it } from 'vitest';
import { buildLegacySummary, buildQueueSubmissions } from '../scripts/import-golden-chocobo-legacy.mjs';

const normalizeSourceUrl = (value) => {
  if (!value) return undefined;
  const url = new URL(value);
  url.search = '';
  url.hash = '';
  return url.href;
};

describe('Golden Chocobo legacy queue import', () => {
  it('summarizes found and missing legacy serials', () => {
    const summary = buildLegacySummary([
      { id: 1, found: true },
      { id: 2, found: false },
      { id: 77, found: true },
    ]);

    expect(summary).toEqual({
      total: 3,
      found: 2,
      missing: 1,
      foundSerials: ['01', '77'],
    });
  });

  it('maps found legacy cards into deterministic pending review records', () => {
    const [submission] = buildQueueSubmissions([
      {
        id: 4,
        name: 'Golden Chocobo #04',
        found: true,
        foundBy: 'collector',
        dateFound: '2025-06-15',
        link: 'https://www.ebay.com/itm/406051967653?mkcid=1',
        image: '/images/chocobo-04.jpg',
        price: 1200,
        priceDate: '2025-07-25',
      },
      { id: 5, found: false },
    ], {
      tracker: { slug: 'golden-chocobo', title: 'Golden Chocobo', total: 77 },
      normalizeSourceUrl,
      submittedAt: '2026-09-08T12:00:00.000Z',
    });

    expect(submission).toMatchObject({
      id: 'legacy-golden-chocobo-04',
      cardId: 4,
      cardSlug: 'golden-chocobo',
      serialNumber: '04',
      serialTotal: 77,
      sourceType: 'marketplace',
      requestedVerificationStatus: 'source-linked',
      status: 'pending',
      link: 'https://www.ebay.com/itm/406051967653',
      price: 1200,
      currency: 'USD',
      priceDate: '2025-07-25',
      submittedAt: '2026-09-08T12:00:00.000Z',
    });
    expect(submission.notes).toContain('Legacy image path: /images/chocobo-04.jpg');
  });
});

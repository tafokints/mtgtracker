import { describe, expect, it } from 'vitest';
import { affiliateStatsCsvFilename, buildAffiliateStatsCsv } from '@/lib/affiliate-stats-export';

describe('affiliate stats export', () => {
  it('exports affiliate rows with destination and last-click context', () => {
    const csv = buildAffiliateStatsCsv({
      generatedAt: '2026-07-14T12:34:56.000Z',
      rows: [
        {
          tracker: 'one-ring',
          trackerTitle: 'The One Ring',
          merchant: 'ebay',
          intent: 'auction-comps',
          placement: 'tracker-card-serial',
          label: 'Search "The One Ring, 007"',
          href: 'https://www.ebay.com/sch/i.html?_nkw=the+one+ring+007',
          clicksInWindow: 4,
          totalClicks: 9,
          lastClick: {
            clickedAt: '2026-07-14T11:00:00.000Z',
            href: 'https://www.ebay.com/sch/i.html?_nkw=the+one+ring+007&customid=one-ring',
            sourcePath: '/trackers/one-ring?filter=missing',
            viewContext: {
              filter: 'missing',
              sort: 'serial',
              cardFilter: 'all',
              query: '007',
              card: 'the-one-ring',
              serial: '007',
              slot: 'the-one-ring-007',
            },
          },
        },
      ],
    });

    expect(csv).toContain('"tracker","trackerTitle","merchant","intent","placement"');
    expect(csv).toContain('"rowType","promotionKey","promotionLabel"');
    expect(csv).toContain('"one-ring","The One Ring","ebay","auction-comps","tracker-card-serial"');
    expect(csv).toContain('"https://www.ebay.com/sch/i.html?_nkw=the+one+ring+007&customid=one-ring"');
    expect(csv).toContain('"/trackers/one-ring?filter=missing"');
    expect(csv).toContain('"missing","serial","all","007","the-one-ring","007","the-one-ring-007"');
    expect(csv).toContain('"affiliate-click"');
  });

  it('quotes commas, quotes, and line breaks safely', () => {
    const csv = buildAffiliateStatsCsv({
      generatedAt: '2026-07-14T12:34:56.000Z',
      rows: [
        {
          tracker: 'lotr-poster-cards',
          trackerTitle: 'Realms and Relics',
          merchant: 'tcgplayer',
          intent: 'singles',
          placement: 'tracker-top-cta',
          label: 'Buy "Rock, Poster"\nSingles',
          href: 'https://partner.tcgplayer.com/DyJ25G',
          clicksInWindow: 1,
          totalClicks: 1,
        },
      ],
    });

    expect(csv).toContain('"Buy ""Rock, Poster"" Singles"');
  });

  it('exports promotion source efficiency rows for channel analysis', () => {
    const csv = buildAffiliateStatsCsv({
      generatedAt: '2026-07-14T12:34:56.000Z',
      rows: [],
      promotion: {
        sourceEfficiency: [
          {
            key: 'x',
            label: 'X',
            promotionActionsInWindow: 2,
            promotionActionsTotal: 5,
            promotionVisitsInWindow: 3,
            promotionVisitsTotal: 8,
            affiliateClicksInWindow: 1,
            affiliateClicksTotal: 4,
            affiliateClicksPerActionInWindow: 0.5,
            affiliateClicksPerActionTotal: 0.8,
            affiliateClicksPerVisitInWindow: 0.33,
            affiliateClicksPerVisitTotal: 0.5,
          },
        ],
      },
    });

    expect(csv).toContain('"promotion-source-efficiency","x","X","2","5","3","8","1","4","0.5","0.8","0.33","0.5"');
  });

  it('exports directory CTA rows for acquisition analysis', () => {
    const csv = buildAffiliateStatsCsv({
      generatedAt: '2026-07-14T12:34:56.000Z',
      rows: [],
      directory: {
        rows: [
          {
            tracker: 'one-ring',
            trackerTitle: 'The One Ring',
            action: 'latest-discovery',
            label: 'Latest Discovery',
            clicksInWindow: 3,
            totalClicks: 7,
            lastClick: {
              clickedAt: '2026-07-14T11:00:00.000Z',
              href: '/trackers/one-ring?serial=007',
              sourcePath: '/trackers',
            },
          },
        ],
      },
    });

    expect(csv).toContain('"one-ring","The One Ring"');
    expect(csv).toContain('"directory-cta"');
    expect(csv).toContain('"latest-discovery","Latest Discovery","/trackers/one-ring?serial=007"');
  });

  it('uses the stats generated date in the filename', () => {
    expect(affiliateStatsCsvFilename('2026-07-14T12:34:56.000Z')).toBe(
      'mtgtrackers-affiliate-stats-2026-07-14.csv',
    );
  });
});

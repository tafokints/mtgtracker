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
    expect(csv).toContain('"one-ring","The One Ring","ebay","auction-comps","tracker-card-serial"');
    expect(csv).toContain('"https://www.ebay.com/sch/i.html?_nkw=the+one+ring+007&customid=one-ring"');
    expect(csv).toContain('"/trackers/one-ring?filter=missing"');
    expect(csv).toContain('"missing","serial","all","007","the-one-ring","007","the-one-ring-007"');
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

  it('uses the stats generated date in the filename', () => {
    expect(affiliateStatsCsvFilename('2026-07-14T12:34:56.000Z')).toBe(
      'mtgtrackers-affiliate-stats-2026-07-14.csv',
    );
  });
});

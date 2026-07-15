import { describe, expect, it } from 'vitest';
import { getAffiliateCoverageRows, getAffiliateCoverageSummary } from '@/lib/affiliate-coverage';
import { trackers } from '@/lib/trackers';

describe('affiliate coverage audit', () => {
  it('marks current tracker affiliate coverage as ready', () => {
    const rows = getAffiliateCoverageRows(trackers);
    const summary = getAffiliateCoverageSummary(rows);

    expect(summary).toMatchObject({
      trackerCount: trackers.length,
      readyCount: trackers.length,
      issueCount: 0,
      errorCount: 0,
      warningCount: 0,
      averageScore: 100,
    });
    expect(rows.every((row) => row.score === 100)).toBe(true);
  });

  it('flags missing live merchant coverage and broken attribution', () => {
    const rows = getAffiliateCoverageRows([
      {
        ...trackers[0],
        slug: 'broken',
        status: 'live',
        affiliateLinks: [
          {
            label: 'Broken eBay',
            href: 'https://www.ebay.com/sch/i.html?_nkw=broken&campid=wrong',
            merchant: 'ebay',
            intent: 'singles',
          },
        ],
      },
    ]);

    expect(rows[0].score).toBeLessThan(100);
    expect(rows[0].issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 'error', merchant: 'tcgplayer' }),
      expect.objectContaining({ severity: 'error', merchant: 'amazon' }),
      expect.objectContaining({ severity: 'error', merchant: 'ebay', message: 'ebay intent should be auction-comps.' }),
      expect.objectContaining({ severity: 'error', merchant: 'ebay', message: 'eBay link is missing the configured campaign id.' }),
      expect.objectContaining({ severity: 'warning', merchant: 'ebay' }),
    ]));
  });
});

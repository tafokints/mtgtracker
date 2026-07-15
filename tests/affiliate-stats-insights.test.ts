import { describe, expect, it } from 'vitest';
import { getAffiliateStatsInsights } from '@/lib/affiliate-stats-insights';

describe('affiliate stats insights', () => {
  it('summarizes top CTA, best placement, stale winners, and latest clicks', () => {
    const insights = getAffiliateStatsInsights({
      summary: {
        bestPlacement: {
          label: 'tracker-card-serial',
          clicksInWindow: 8,
          totalClicks: 20,
        },
      },
      rows: [
        {
          trackerTitle: 'The One Ring',
          merchant: 'ebay',
          placement: 'tracker-card-serial',
          clicksInWindow: 8,
          totalClicks: 20,
          lastClick: {
            clickedAt: '2026-07-14T10:00:00.000Z',
            sourcePath: '/trackers/one-ring?serial=007',
          },
        },
        {
          trackerTitle: 'Edgar Markov',
          merchant: 'tcgplayer',
          placement: 'tracker-top-cta',
          clicksInWindow: 0,
          totalClicks: 12,
          lastClick: {
            clickedAt: '2026-07-12T10:00:00.000Z',
          },
        },
      ],
    });

    expect(insights).toEqual([
      {
        label: 'Top CTA',
        value: 'The One Ring / Ebay',
        detail: '8 recent clicks from tracker card serial.',
      },
      {
        label: 'Best Placement',
        value: 'tracker card serial',
        detail: '8 recent clicks, 20 all time.',
      },
      {
        label: 'Refresh Candidate',
        value: 'Edgar Markov / Tcgplayer',
        detail: 'tracker top cta has 12 lifetime clicks but none in the current window.',
      },
      {
        label: 'Latest Click',
        value: 'The One Ring / Ebay',
        detail: 'tracker card serial from /trackers/one-ring?serial=007.',
      },
    ]);
  });

  it('omits stale insight when all active rows have recent clicks', () => {
    const insights = getAffiliateStatsInsights({
      summary: {
        bestPlacement: null,
      },
      rows: [
        {
          trackerTitle: 'LOTR Poster Cards',
          merchant: 'amazon',
          placement: 'tracker-top-cta',
          clicksInWindow: 1,
          totalClicks: 1,
        },
      ],
    });

    expect(insights.map((insight) => insight.label)).toEqual(['Top CTA']);
  });
});

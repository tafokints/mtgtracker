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
      promotion: {
        efficiency: [
          {
            label: 'The One Ring',
            promotionActionsInWindow: 3,
            promotionVisitsInWindow: 4,
            affiliateClicksInWindow: 2,
            affiliateClicksPerActionInWindow: 0.67,
            affiliateClicksPerVisitInWindow: 0.5,
          },
          {
            label: 'Edgar Markov',
            promotionActionsInWindow: 2,
            promotionVisitsInWindow: 5,
            affiliateClicksInWindow: 0,
            affiliateClicksPerActionInWindow: 0,
            affiliateClicksPerVisitInWindow: 0,
          },
        ],
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
        label: 'Best Funnel',
        value: 'The One Ring',
        detail: '4 promoted visits created 2 affiliate clicks (0.50 clicks/visit).',
      },
      {
        label: 'Funnel Gap',
        value: 'Edgar Markov',
        detail: '5 promoted visits but no affiliate clicks yet. Next: check CTA relevance, above-the-fold links, and source match.',
      },
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

  it('flags promotion actions that are not producing promoted visits', () => {
    const insights = getAffiliateStatsInsights({
      summary: {
        bestPlacement: null,
      },
      promotion: {
        efficiency: [
          {
            label: 'LOTR Poster Cards',
            promotionActionsInWindow: 3,
            promotionVisitsInWindow: 0,
            affiliateClicksInWindow: 0,
            affiliateClicksPerActionInWindow: 0,
            affiliateClicksPerVisitInWindow: null,
          },
        ],
      },
      rows: [],
    });

    expect(insights).toEqual([
      {
        label: 'Distribution Gap',
        value: 'LOTR Poster Cards',
        detail: '3 promotion actions but no promoted visits yet. Next: recheck posted links and audience fit.',
      },
    ]);
  });

  it('prioritizes source-level promotion funnel insights when channel data is available', () => {
    const insights = getAffiliateStatsInsights({
      summary: {
        bestPlacement: null,
      },
      promotion: {
        efficiency: [
          {
            label: 'The One Ring',
            promotionActionsInWindow: 4,
            promotionVisitsInWindow: 8,
            affiliateClicksInWindow: 2,
            affiliateClicksPerActionInWindow: 0.5,
            affiliateClicksPerVisitInWindow: 0.25,
          },
        ],
        sourceEfficiency: [
          {
            label: 'X',
            promotionActionsInWindow: 2,
            promotionVisitsInWindow: 3,
            affiliateClicksInWindow: 2,
            affiliateClicksPerActionInWindow: 1,
            affiliateClicksPerVisitInWindow: 0.67,
          },
          {
            label: 'Reddit',
            promotionActionsInWindow: 2,
            promotionVisitsInWindow: 5,
            affiliateClicksInWindow: 0,
            affiliateClicksPerActionInWindow: 0,
            affiliateClicksPerVisitInWindow: 0,
          },
        ],
      },
      rows: [],
    });

    expect(insights.slice(0, 2)).toEqual([
      {
        label: 'Best Funnel',
        value: 'Source: X',
        detail: '3 promoted visits created 2 affiliate clicks (0.67 clicks/visit).',
      },
      {
        label: 'Funnel Gap',
        value: 'Source: Reddit',
        detail: '5 promoted visits but no affiliate clicks yet. Next: try an eBay exact-serial CTA near the top and lead the post with the proof image.',
      },
    ]);
  });

  it('gives source-specific distribution recommendations when shared links do not create visits', () => {
    const insights = getAffiliateStatsInsights({
      summary: {
        bestPlacement: null,
      },
      promotion: {
        efficiency: [],
        sourceEfficiency: [
          {
            label: 'X',
            promotionActionsInWindow: 4,
            promotionVisitsInWindow: 0,
            affiliateClicksInWindow: 0,
            affiliateClicksPerActionInWindow: 0,
            affiliateClicksPerVisitInWindow: null,
          },
        ],
      },
      rows: [],
    });

    expect(insights).toEqual([
      {
        label: 'Distribution Gap',
        value: 'Source: X',
        detail: '4 promotion actions but no promoted visits yet. Next: confirm the X post uses the generated share URL and repost during collector-heavy hours.',
      },
    ]);
  });
});

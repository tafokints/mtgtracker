import { describe, expect, it } from 'vitest';
import { getMarketplaceCtaRecommendations } from '@/lib/marketplace-cta-recommendations';

describe('marketplace CTA recommendations', () => {
  it('prioritizes broken affiliate coverage before CTA tests', () => {
    const recommendations = getMarketplaceCtaRecommendations({
      affiliateCoverage: {
        rows: [
          {
            tracker: 'one-ring',
            trackerTitle: 'The One Ring',
            score: 50,
            issues: [
              { severity: 'error', merchant: 'ebay', message: 'eBay customid should be one-ring.' },
            ],
          },
        ],
      },
      directory: {
        rows: [
          { tracker: 'one-ring', trackerTitle: 'The One Ring', action: 'open-tracker', clicksInWindow: 4 },
        ],
      },
      rows: [],
    });

    expect(recommendations[0]).toMatchObject({
      tracker: 'one-ring',
      priority: 'high',
      merchant: 'ebay',
      action: 'Fix affiliate coverage before promotion',
    });
  });

  it('recommends reinforcing the winning merchant and placement', () => {
    const recommendations = getMarketplaceCtaRecommendations({
      affiliateCoverage: {
        rows: [
          { tracker: 'one-ring', trackerTitle: 'The One Ring', score: 100, issues: [] },
        ],
      },
      rows: [
        {
          tracker: 'one-ring',
          trackerTitle: 'The One Ring',
          merchant: 'ebay',
          placement: 'serial-detail',
          clicksInWindow: 3,
          totalClicks: 10,
        },
        {
          tracker: 'one-ring',
          trackerTitle: 'The One Ring',
          merchant: 'tcgplayer',
          placement: 'tracker-top-cta',
          clicksInWindow: 1,
          totalClicks: 2,
        },
      ],
    });

    expect(recommendations[0]).toMatchObject({
      tracker: 'one-ring',
      priority: 'high',
      merchant: 'ebay',
      action: 'Lead with exact-serial eBay searches',
      detail: 'ebay has 3 recent clicks, with serial-detail as the strongest placement. Reinforce that path in top and serial-detail CTAs.',
    });
  });

  it('uses directory interest to recommend an above-fold marketplace test', () => {
    const recommendations = getMarketplaceCtaRecommendations({
      affiliateCoverage: {
        rows: [
          { tracker: 'edgar-markov', trackerTitle: 'Edgar Markov', score: 100, issues: [] },
        ],
      },
      directory: {
        rows: [
          { tracker: 'edgar-markov', trackerTitle: 'Edgar Markov', action: 'open-tracker', clicksInWindow: 2 },
        ],
      },
      rows: [],
    });

    expect(recommendations[0]).toMatchObject({
      tracker: 'edgar-markov',
      priority: 'high',
      merchant: 'ebay',
      action: 'Test eBay serial-search CTA above the fold',
    });
  });
});

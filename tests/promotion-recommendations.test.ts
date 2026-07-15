import { describe, expect, it } from 'vitest';
import { choosePromotionSource, getPromoteNextRecommendation } from '@/lib/promotion-recommendations';

describe('promotion recommendations', () => {
  it('chooses the source with the strongest current affiliate conversion', () => {
    expect(choosePromotionSource([
      {
        key: 'reddit',
        label: 'Reddit',
        promotionActionsInWindow: 3,
        promotionVisitsInWindow: 9,
        affiliateClicksInWindow: 0,
        affiliateClicksPerActionInWindow: 0,
        affiliateClicksPerVisitInWindow: 0,
      },
      {
        key: 'x',
        label: 'X',
        promotionActionsInWindow: 2,
        promotionVisitsInWindow: 3,
        affiliateClicksInWindow: 2,
        affiliateClicksPerActionInWindow: 1,
        affiliateClicksPerVisitInWindow: 0.67,
      },
    ])).toMatchObject({
      key: 'x',
      label: 'X',
    });
  });

  it('recommends the strongest candidate with the best source', () => {
    const recommendation = getPromoteNextRecommendation(
      [
        { score: 4, reasons: ['source linked'] },
        { score: 9, reasons: ['confirmed', 'source', 'price'] },
      ],
      [
        {
          key: 'reddit',
          label: 'Reddit',
          promotionActionsInWindow: 1,
          promotionVisitsInWindow: 2,
          affiliateClicksInWindow: 1,
          affiliateClicksPerActionInWindow: 1,
          affiliateClicksPerVisitInWindow: 0.5,
        },
      ],
    );

    expect(recommendation).toMatchObject({
      candidate: {
        score: 9,
      },
      source: {
        key: 'reddit',
      },
      detail: 'Reddit is the best current source; use this confirmed, source, price discovery while it is converting.',
    });
  });

  it('defaults to X when no source has enough history yet', () => {
    expect(getPromoteNextRecommendation([{ score: 5, reasons: [] }])).toMatchObject({
      source: {
        key: 'x',
        label: 'X',
      },
      detail: 'No source has converted yet; start with X using this approved evidence discovery.',
    });
  });
});

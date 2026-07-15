import { describe, expect, it } from 'vitest';
import { getTrackerGrowthRecommendations } from '@/lib/tracker-growth-recommendations';

describe('tracker growth recommendations', () => {
  it('prioritizes directory interest that is not producing affiliate clicks', () => {
    const recommendations = getTrackerGrowthRecommendations({
      summary: {
        byTracker: [],
      },
      directory: {
        summary: {
          byTracker: [
            { key: 'one-ring', label: 'The One Ring', clicksInWindow: 4, totalClicks: 4 },
          ],
        },
        rows: [
          { tracker: 'one-ring', trackerTitle: 'The One Ring', action: 'open-tracker', clicksInWindow: 2, totalClicks: 2 },
          { tracker: 'one-ring', trackerTitle: 'The One Ring', action: 'report-find', clicksInWindow: 1, totalClicks: 1 },
          { tracker: 'one-ring', trackerTitle: 'The One Ring', action: 'latest-discovery', clicksInWindow: 1, totalClicks: 1 },
        ],
      },
      promotion: {
        efficiency: [],
      },
    });

    expect(recommendations).toEqual([
      expect.objectContaining({
        label: 'The One Ring',
        priority: 'high',
        action: 'Improve marketplace CTAs',
      }),
      expect.objectContaining({
        label: 'The One Ring',
        priority: 'high',
        action: 'Review report demand',
      }),
      expect.objectContaining({
        label: 'The One Ring',
        priority: 'medium',
        action: 'Share latest discovery',
      }),
    ]);
  });

  it('recommends promotion for trackers that monetize without campaign visits', () => {
    const recommendations = getTrackerGrowthRecommendations({
      summary: {
        byTracker: [
          { key: 'edgar-markov', label: 'Edgar Markov', clicksInWindow: 3, totalClicks: 5 },
        ],
      },
      directory: {
        summary: {
          byTracker: [],
        },
        rows: [],
      },
      promotion: {
        efficiency: [
          {
            key: 'edgar-markov',
            label: 'Edgar Markov',
            promotionActionsInWindow: 0,
            promotionVisitsInWindow: 0,
            affiliateClicksInWindow: 3,
          },
        ],
      },
    });

    expect(recommendations[0]).toMatchObject({
      label: 'Edgar Markov',
      priority: 'medium',
      action: 'Promote converting tracker',
      detail: '3 affiliate clicks without promoted visits. This tracker is already monetizing organic traffic; give it a campaign push.',
    });
  });
});

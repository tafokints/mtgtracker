import { describe, expect, it } from 'vitest';
import { trackers } from '@/lib/trackers';

describe('tracker market insights', () => {
  it('keeps every live tracker stocked with collector and discovery notes', () => {
    const liveTrackers = trackers.filter((tracker) => tracker.status === 'live');

    expect(liveTrackers.length).toBeGreaterThan(0);
    for (const tracker of liveTrackers) {
      expect(tracker.marketInsights?.length, `${tracker.slug} market insights`).toBeGreaterThanOrEqual(2);

      for (const insight of tracker.marketInsights || []) {
        expect(insight.title.trim(), `${tracker.slug} insight title`).not.toBe('');
        expect(insight.summary.trim(), `${tracker.slug} insight summary`).not.toBe('');
        expect(insight.bullets.length, `${tracker.slug} insight bullets`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('keeps every live tracker stocked with search-ready FAQs', () => {
    const liveTrackers = trackers.filter((tracker) => tracker.status === 'live');

    expect(liveTrackers.length).toBeGreaterThan(0);
    for (const tracker of liveTrackers) {
      expect(tracker.faqs?.length, `${tracker.slug} FAQs`).toBeGreaterThanOrEqual(3);

      for (const faq of tracker.faqs || []) {
        expect(faq.question.trim(), `${tracker.slug} FAQ question`).toMatch(/\?$/);
        expect(faq.answer.trim().length, `${tracker.slug} FAQ answer`).toBeGreaterThanOrEqual(80);
      }
    }
  });
});

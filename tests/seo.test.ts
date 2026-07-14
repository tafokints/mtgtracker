import { describe, expect, it } from 'vitest';
import { getTracker, trackers } from '@/lib/trackers';
import { buildBreadcrumbJsonLd, buildTrackerDirectoryJsonLd, buildTrackerWebPageJsonLd, trackerBreadcrumbItems, trackerKeywords } from '@/lib/seo';

describe('SEO structured data', () => {
  it('builds factual CollectionPage JSON-LD for a tracker', () => {
    const tracker = getTracker('lotr-poster-cards');
    if (!tracker) throw new Error('lotr-poster-cards tracker fixture is missing');

    const jsonLd = buildTrackerWebPageJsonLd(tracker);

    expect(jsonLd).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'LOTR Poster Cards Tracker',
      url: 'https://mtgtrackers.com/trackers/lotr-poster-cards',
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: 2000,
      },
    });
    expect(jsonLd.mainEntity.itemListElement).toHaveLength(20);
    expect(JSON.stringify(jsonLd)).not.toContain('AggregateRating');
    expect(JSON.stringify(jsonLd)).not.toContain('"@type":"Product"');
  });

  it('builds directory JSON-LD from live trackers only', () => {
    const liveTrackers = trackers.filter((tracker) => tracker.status === 'live');
    const jsonLd = buildTrackerDirectoryJsonLd(liveTrackers);

    expect(jsonLd).toMatchObject({
      '@type': 'CollectionPage',
      name: 'MTG Serialized Tracker Directory',
      url: 'https://mtgtrackers.com/trackers',
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: liveTrackers.length,
      },
    });
    expect(jsonLd.mainEntity.itemListElement.map((item) => item.url)).toEqual(
      liveTrackers.map((tracker) => `https://mtgtrackers.com${tracker.href}`)
    );
    expect(jsonLd.mainEntity.itemListElement.map((item) => item.name)).not.toContain('Golden Chocobo');
  });

  it('builds tracker keywords from the tracker subject and set metadata', () => {
    const tracker = getTracker('edgar-markov');
    if (!tracker) throw new Error('edgar-markov tracker fixture is missing');

    expect(trackerKeywords(tracker)).toEqual(expect.arrayContaining([
      'Edgar Markov',
      'Edgar Markov tracker',
      'Edgar Markov serialized',
      'Innistrad Remastered',
      'MTG serialized cards',
    ]));
  });

  it('builds canonical breadcrumb JSON-LD for tracker subpages', () => {
    const tracker = getTracker('one-ring');
    if (!tracker) throw new Error('one-ring tracker fixture is missing');

    const jsonLd = buildBreadcrumbJsonLd(trackerBreadcrumbItems(tracker, {
      name: 'Stats',
      path: `${tracker.href}/stats`,
    }));

    expect(jsonLd).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'MTG Trackers',
          item: 'https://mtgtrackers.com/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Trackers',
          item: 'https://mtgtrackers.com/trackers',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'The One Ring',
          item: 'https://mtgtrackers.com/trackers/one-ring',
        },
        {
          '@type': 'ListItem',
          position: 4,
          name: 'Stats',
          item: 'https://mtgtrackers.com/trackers/one-ring/stats',
        },
      ],
    });
  });
});

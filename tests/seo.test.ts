import { describe, expect, it } from 'vitest';
import { getTracker, trackers } from '@/lib/trackers';
import { buildBreadcrumbJsonLd, buildTrackerDirectoryJsonLd, buildTrackerFaqJsonLd, buildTrackerPageMetadata, buildTrackerSerialItemPageJsonLd, buildTrackerStatsJsonLd, buildTrackerWebPageJsonLd, trackerBreadcrumbItems, trackerKeywords } from '@/lib/seo';

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

  it('builds Dataset JSON-LD for tracker statistics pages', () => {
    const tracker = getTracker('one-ring');
    if (!tracker) throw new Error('one-ring tracker fixture is missing');

    const jsonLd = buildTrackerStatsJsonLd(tracker);

    expect(jsonLd).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: 'The One Ring Serialized Card Statistics',
      url: 'https://mtgtrackers.com/trackers/one-ring/stats',
      includedInDataCatalog: {
        '@type': 'DataCatalog',
        name: 'MTG Trackers',
      },
      size: 100,
      license: 'https://mtgtrackers.com/privacy',
    });
    expect(jsonLd.variableMeasured).toEqual(expect.arrayContaining([
      'Confirmed discoveries',
      'Public sale price coverage',
      'Source type distribution',
    ]));
  });

  it('builds FAQPage JSON-LD for tracker collector questions', () => {
    const tracker = getTracker('one-ring');
    if (!tracker) throw new Error('one-ring tracker fixture is missing');

    const jsonLd = buildTrackerFaqJsonLd(tracker);

    expect(jsonLd).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      name: 'The One Ring Frequently Asked Questions',
      url: 'https://mtgtrackers.com/trackers/one-ring',
    });
    expect(jsonLd?.mainEntity).toEqual(expect.arrayContaining([
      expect.objectContaining({
        '@type': 'Question',
        name: 'How many serialized The One Ring poster cards exist?',
        acceptedAnswer: expect.objectContaining({
          '@type': 'Answer',
        }),
      }),
    ]));
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

  it('builds exact serial metadata for single-card tracker deep links', () => {
    const tracker = getTracker('one-ring');
    if (!tracker) throw new Error('one-ring tracker fixture is missing');

    const metadata = buildTrackerPageMetadata(tracker, { serial: '7' });

    expect(metadata).toMatchObject({
      title: 'The One Ring 007/100',
      description: 'Track The One Ring 007/100: serialized Magic: The Gathering discovery status, source evidence, sale data, and marketplace links.',
      alternates: {
        canonical: '/trackers/one-ring?serial=007',
      },
      openGraph: {
        title: 'The One Ring 007/100 | MTG Trackers',
        url: 'https://mtgtrackers.com/trackers/one-ring?serial=007',
      },
      twitter: {
        title: 'The One Ring 007/100 | MTG Trackers',
      },
    });
    expect(metadata.keywords).toEqual(expect.arrayContaining([
      'The One Ring 007/100',
      '007/100 MTG serialized',
    ]));
  });

  it('builds ItemPage JSON-LD for exact single-card serial links', () => {
    const tracker = getTracker('one-ring');
    if (!tracker) throw new Error('one-ring tracker fixture is missing');

    const jsonLd = buildTrackerSerialItemPageJsonLd(tracker, { serial: '1' });

    expect(jsonLd).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'ItemPage',
      name: 'The One Ring 001/100 Tracker',
      url: 'https://mtgtrackers.com/trackers/one-ring?serial=001',
      isPartOf: {
        '@type': 'CollectionPage',
        name: 'The One Ring Tracker',
      },
      about: {
        '@type': 'Thing',
        name: 'The One Ring 001/100',
        identifier: '001/100',
      },
      potentialAction: {
        '@type': 'CommunicateAction',
        target: 'https://mtgtrackers.com/trackers/one-ring/submit?serial=001',
      },
    });
  });

  it('builds exact serial metadata for multi-card tracker deep links', () => {
    const tracker = getTracker('lotr-poster-cards');
    if (!tracker) throw new Error('lotr-poster-cards tracker fixture is missing');

    const metadata = buildTrackerPageMetadata(tracker, {
      card: 'dawn-of-a-new-age',
      serial: '2',
    });

    expect(metadata.title).toBe('LOTR Poster Cards Dawn of a New Age 002/100');
    expect(metadata.alternates.canonical).toBe('/trackers/lotr-poster-cards?card=dawn-of-a-new-age&serial=002');
    expect(metadata.openGraph.url).toBe('https://mtgtrackers.com/trackers/lotr-poster-cards?card=dawn-of-a-new-age&serial=002');
    expect(metadata.openGraph.images[0].alt).toBe('LOTR Poster Cards Dawn of a New Age 002/100 serial tracker');
  });

  it('builds ItemPage JSON-LD for exact multi-card serial links', () => {
    const tracker = getTracker('lotr-poster-cards');
    if (!tracker) throw new Error('lotr-poster-cards tracker fixture is missing');

    const jsonLd = buildTrackerSerialItemPageJsonLd(tracker, {
      card: 'dawn-of-a-new-age',
      serial: '2',
    });

    expect(jsonLd).toMatchObject({
      '@type': 'ItemPage',
      name: 'LOTR Poster Cards Dawn of a New Age 002/100 Tracker',
      url: 'https://mtgtrackers.com/trackers/lotr-poster-cards?card=dawn-of-a-new-age&serial=002',
      about: {
        name: 'Dawn of a New Age 002/100',
        identifier: '002/100',
      },
      potentialAction: {
        target: 'https://mtgtrackers.com/trackers/lotr-poster-cards/submit?card=dawn-of-a-new-age&serial=002',
      },
    });
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

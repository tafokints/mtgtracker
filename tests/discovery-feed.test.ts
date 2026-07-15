import { describe, expect, it } from 'vitest';
import { buildDiscoveriesJsonFeed, buildDiscoveriesRssFeed } from '@/lib/discovery-feed';
import type { RecentTrackerDiscovery } from '@/lib/tracker-data';

const discoveries: RecentTrackerDiscovery[] = [
  {
    trackerSlug: 'one-ring',
    trackerTitle: 'The One Ring',
    trackerHref: '/trackers/one-ring',
    detailHref: '/trackers/one-ring?serial=007',
    cardId: 7,
    serialNumber: '007',
    serialTotal: 100,
    label: 'The One Ring 007/100',
    foundBy: 'Collector "A"',
    dateFound: '2026-07-14',
    verificationStatus: 'source-linked',
    sourceType: 'marketplace',
    price: 12500,
  },
];

describe('discovery feeds', () => {
  it('builds a JSON feed with absolute exact-card URLs', () => {
    const feed = buildDiscoveriesJsonFeed(discoveries, 'https://mtgtrackers.com/');

    expect(feed).toMatchObject({
      version: 'https://jsonfeed.org/version/1.1',
      title: 'MTG Trackers Recent Discoveries',
      home_page_url: 'https://mtgtrackers.com/',
      feed_url: 'https://mtgtrackers.com/discoveries.json',
    });
    expect(feed.items[0]).toMatchObject({
      id: 'one-ring:7',
      url: 'https://mtgtrackers.com/trackers/one-ring?serial=007',
      title: 'The One Ring: The One Ring 007/100',
      date_published: '2026-07-14T00:00:00.000Z',
      tags: ['The One Ring', 'source-linked', 'marketplace'],
    });
    expect(feed.items[0].content_text).toContain('Reported price: $12,500.');
  });

  it('builds an RSS feed with escaped discovery text', () => {
    const rss = buildDiscoveriesRssFeed(discoveries, 'https://mtgtrackers.com');

    expect(rss).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(rss).toContain('<title>MTG Trackers Recent Discoveries</title>');
    expect(rss).toContain('<link>https://mtgtrackers.com/trackers/one-ring?serial=007</link>');
    expect(rss).toContain('Collector &quot;A&quot;');
    expect(rss).toContain('<pubDate>Tue, 14 Jul 2026 00:00:00 GMT</pubDate>');
  });
});

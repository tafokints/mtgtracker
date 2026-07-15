import type { RecentTrackerDiscovery } from '@/lib/tracker-data';

const DEFAULT_BASE_URL = 'https://mtgtrackers.com';

export interface DiscoveryFeedItem {
  id: string;
  url: string;
  title: string;
  contentText: string;
  datePublished?: string;
  trackerTitle: string;
  verificationStatus: string;
  sourceType?: string;
}

function normalizeBaseUrl(baseUrl = DEFAULT_BASE_URL) {
  return baseUrl.replace(/\/+$/, '');
}

function absoluteUrl(pathOrUrl: string, baseUrl = DEFAULT_BASE_URL) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return `${normalizeBaseUrl(baseUrl)}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

function formatStatus(value: string) {
  return value.replace(/-/g, ' ');
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function discoveryDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString();
}

export function buildDiscoveryFeedItems(discoveries: RecentTrackerDiscovery[], baseUrl = DEFAULT_BASE_URL): DiscoveryFeedItem[] {
  return discoveries.map((discovery) => {
    const status = formatStatus(discovery.verificationStatus);
    const source = discovery.sourceType ? ` via ${formatStatus(discovery.sourceType)}` : '';
    const price = discovery.price !== undefined ? ` Reported price: $${discovery.price.toLocaleString()}.` : '';
    const finder = discovery.foundBy ? ` Found by ${discovery.foundBy}.` : '';

    return {
      id: `${discovery.trackerSlug}:${discovery.cardId}`,
      url: absoluteUrl(discovery.detailHref, baseUrl),
      title: `${discovery.trackerTitle}: ${discovery.label}`,
      contentText: `${discovery.label} is marked ${status}${source}.${finder}${price}`.replace(/\s+/g, ' ').trim(),
      datePublished: discoveryDate(discovery.dateFound),
      trackerTitle: discovery.trackerTitle,
      verificationStatus: discovery.verificationStatus,
      sourceType: discovery.sourceType,
    };
  });
}

export function buildDiscoveriesJsonFeed(discoveries: RecentTrackerDiscovery[], baseUrl = DEFAULT_BASE_URL) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const items = buildDiscoveryFeedItems(discoveries, normalizedBaseUrl);

  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'MTG Trackers Recent Discoveries',
    home_page_url: `${normalizedBaseUrl}/`,
    feed_url: `${normalizedBaseUrl}/discoveries.json`,
    description: 'Recent verified serialized Magic: The Gathering discoveries from MTG Trackers.',
    items: items.map((item) => ({
      id: item.id,
      url: item.url,
      title: item.title,
      content_text: item.contentText,
      date_published: item.datePublished,
      tags: [
        item.trackerTitle,
        item.verificationStatus,
        item.sourceType,
      ].filter(Boolean),
    })),
  };
}

export function buildDiscoveriesRssFeed(discoveries: RecentTrackerDiscovery[], baseUrl = DEFAULT_BASE_URL) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const items = buildDiscoveryFeedItems(discoveries, normalizedBaseUrl)
    .map((item) => {
      const pubDate = item.datePublished ? `<pubDate>${new Date(item.datePublished).toUTCString()}</pubDate>` : '';

      return [
        '<item>',
        `<guid isPermaLink="false">${escapeXml(item.id)}</guid>`,
        `<title>${escapeXml(item.title)}</title>`,
        `<link>${escapeXml(item.url)}</link>`,
        `<description>${escapeXml(item.contentText)}</description>`,
        pubDate,
        '</item>',
      ].filter(Boolean).join('');
    })
    .join('');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '<channel>',
    '<title>MTG Trackers Recent Discoveries</title>',
    `<link>${escapeXml(`${normalizedBaseUrl}/`)}</link>`,
    '<description>Recent verified serialized Magic: The Gathering discoveries from MTG Trackers.</description>',
    `<atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${escapeXml(`${normalizedBaseUrl}/discoveries.xml`)}" rel="self" type="application/rss+xml" />`,
    items,
    '</channel>',
    '</rss>',
  ].join('');
}

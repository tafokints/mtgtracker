import { createInitialTrackerCards, findTrackerCardByDeepLinkParams, formatTrackerCardLabel, getTrackerCardDeepLinkParams, getTrackerCardDefinitions, getTrackerTotalSlots } from '@/lib/tracker-data';
import { TrackerSummary } from '@/lib/trackers';

export const siteUrl = 'https://mtgtrackers.com';

export function trackerCanonicalUrl(tracker: Pick<TrackerSummary, 'href'>) {
  return `${siteUrl}${tracker.href}`;
}

export function trackerSocialImage(tracker: Pick<TrackerSummary, 'referenceImage'>) {
  return tracker.referenceImage || '/icon.svg';
}

export function trackerKeywords(tracker: TrackerSummary) {
  return [
    tracker.title,
    `${tracker.title} tracker`,
    `${tracker.title} serialized`,
    tracker.setName,
    tracker.releaseName,
    tracker.cardType,
    'MTG serialized cards',
    'Magic: The Gathering tracker',
  ].filter(Boolean) as string[];
}

type SearchParamValue = string | string[] | undefined;

function firstSearchParam(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function toUrlSearchParams(searchParams?: Record<string, SearchParamValue>) {
  const params = new URLSearchParams();

  if (!searchParams) {
    return params;
  }

  for (const [key, value] of Object.entries(searchParams)) {
    const firstValue = firstSearchParam(value);
    if (firstValue) {
      params.set(key, firstValue);
    }
  }

  return params;
}

export function buildTrackerPageMetadata(tracker: TrackerSummary, searchParams?: Record<string, SearchParamValue>) {
  const params = toUrlSearchParams(searchParams);
  const deepLinkedCard = findTrackerCardByDeepLinkParams(
    tracker,
    createInitialTrackerCards(tracker),
    params,
  );
  const isSerialDetail = Boolean(deepLinkedCard);
  const serialLabel = deepLinkedCard ? formatTrackerCardLabel(tracker, deepLinkedCard) : undefined;
  const detailParams = deepLinkedCard ? getTrackerCardDeepLinkParams(tracker, deepLinkedCard) : undefined;
  const pagePath = detailParams ? `${tracker.href}?${detailParams.toString()}` : tracker.href;
  const title = serialLabel ? `${tracker.title} ${serialLabel}` : tracker.title;
  const description = serialLabel
    ? `Track ${tracker.title} ${serialLabel}: serialized Magic: The Gathering discovery status, source evidence, sale data, and marketplace links.`
    : tracker.description;
  const image = trackerSocialImage(tracker);

  return {
    title,
    description,
    keywords: [
      ...trackerKeywords(tracker),
      ...(serialLabel ? [
        `${tracker.title} ${serialLabel}`,
        `${serialLabel} MTG serialized`,
      ] : []),
    ],
    alternates: {
      canonical: pagePath,
    },
    openGraph: {
      title: isSerialDetail ? `${title} | MTG Trackers` : `${tracker.title} Tracker`,
      description,
      url: `${siteUrl}${pagePath}`,
      type: 'website',
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: isSerialDetail ? `${title} serial tracker` : `${tracker.title} tracker`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: isSerialDetail ? `${title} | MTG Trackers` : `${tracker.title} Tracker`,
      description,
      images: [image],
    },
  };
}

export function buildTrackerWebPageJsonLd(tracker: TrackerSummary) {
  const cardDefinitions = getTrackerCardDefinitions(tracker);
  const totalSlots = getTrackerTotalSlots(tracker);

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${tracker.title} Tracker`,
    description: tracker.description,
    url: trackerCanonicalUrl(tracker),
    image: trackerSocialImage(tracker),
    isPartOf: {
      '@type': 'WebSite',
      name: 'MTG Trackers',
      url: siteUrl,
    },
    about: {
      '@type': 'Thing',
      name: tracker.title,
      description: tracker.description,
    },
    mainEntity: {
      '@type': 'ItemList',
      name: `${tracker.title} serialized card slots`,
      numberOfItems: totalSlots,
      itemListElement: cardDefinitions.slice(0, 20).map((definition, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: definition.title,
        url: definition.scryfallUrl || trackerCanonicalUrl(tracker),
      })),
    },
    mentions: [
      ...(tracker.referenceLinks || []).map((link) => ({
        '@type': 'WebPage',
        name: link.label,
        url: link.href,
      })),
      ...(tracker.affiliateLinks || []).map((link) => ({
        '@type': 'WebPage',
        name: link.label,
        url: link.href,
      })),
    ],
  };
}

export function buildTrackerStatsJsonLd(tracker: TrackerSummary) {
  const totalSlots = getTrackerTotalSlots(tracker);

  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${tracker.title} Serialized Card Statistics`,
    description: `Statistics, discovery quality, source-type, pricing coverage, and marketplace context for serialized ${tracker.title} Magic: The Gathering cards.`,
    url: `${trackerCanonicalUrl(tracker)}/stats`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'MTG Trackers',
      url: siteUrl,
    },
    about: {
      '@type': 'Thing',
      name: tracker.title,
      description: tracker.description,
    },
    includedInDataCatalog: {
      '@type': 'DataCatalog',
      name: 'MTG Trackers',
      url: siteUrl,
    },
    measurementTechnique: [
      'Community discovery reports',
      'Admin-reviewed evidence',
      'Marketplace source links',
      'Public sale data',
    ],
    variableMeasured: [
      'Located serialized cards',
      'Confirmed discoveries',
      'Source-linked discoveries',
      'Source type distribution',
      'Public sale price coverage',
      'Grading service distribution',
    ],
    spatialCoverage: 'Worldwide',
    keywords: trackerKeywords(tracker),
    size: totalSlots,
    license: `${siteUrl}/privacy`,
  };
}

export function buildTrackerDirectoryJsonLd(liveTrackers: TrackerSummary[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'MTG Serialized Tracker Directory',
    description: 'Directory of community-maintained serialized Magic: The Gathering card trackers.',
    url: `${siteUrl}/trackers`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'MTG Trackers',
      url: siteUrl,
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: liveTrackers.length,
      itemListElement: liveTrackers.map((tracker, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: tracker.title,
        url: trackerCanonicalUrl(tracker),
      })),
    },
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${siteUrl}${item.path}`,
    })),
  };
}

export function trackerBreadcrumbItems(tracker: Pick<TrackerSummary, 'title' | 'href'>, current?: BreadcrumbItem) {
  const items = [
    { name: 'MTG Trackers', path: '/' },
    { name: 'Trackers', path: '/trackers' },
    { name: tracker.title, path: tracker.href },
  ];

  return current ? [...items, current] : items;
}

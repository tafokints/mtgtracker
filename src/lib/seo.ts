import { getTrackerCardDefinitions, getTrackerTotalSlots } from '@/lib/tracker-data';
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

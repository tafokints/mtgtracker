export interface TrackerSummary {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  total: number;
  href: string;
  status: 'live' | 'planned';
  accent: string;
  referenceImage?: string;
}

export const trackers: TrackerSummary[] = [
  {
    slug: 'one-ring',
    title: 'The One Ring',
    subtitle: 'Serialized borderless poster cards',
    description: 'Track the 100 serialized The One Ring cards from MTG The Lord of the Rings: Tales of Middle-earth.',
    total: 100,
    href: '/trackers/one-ring',
    status: 'live',
    accent: 'ring-gold',
    referenceImage: 'https://cards.scryfall.io/large/front/4/e/4e6fee52-33a8-4085-b632-bf95dfd2b16d.jpg?1782694957',
  },
  {
    slug: 'golden-chocobo',
    title: 'Golden Chocobo',
    subtitle: 'Coming later',
    description: 'The existing Golden Chocobo tracker can be migrated into this platform when we are ready.',
    total: 77,
    href: '/trackers/golden-chocobo',
    status: 'planned',
    accent: 'ring-teal',
  },
];

export function getTracker(slug: string) {
  return trackers.find((tracker) => tracker.slug === slug);
}

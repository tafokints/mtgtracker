export interface AffiliateLink {
  label: string;
  href: string;
  merchant: 'tcgplayer' | 'ebay' | 'amazon' | 'other';
}

export interface TrackerTheme {
  accentClass: string;
  surfaceClass: string;
  textClass: string;
  glowClass: string;
}

export interface TrackerSummary {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  setName?: string;
  releaseName?: string;
  cardType?: string;
  total: number;
  href: string;
  status: 'live' | 'planned';
  theme: TrackerTheme;
  affiliateLinks?: AffiliateLink[];
  referenceImage?: string;
}

export const defaultAffiliateLinks: AffiliateLink[] = [
  {
    label: 'MTG Singles on TCGplayer',
    href: 'https://partner.tcgplayer.com/WyLbG3',
    merchant: 'tcgplayer',
  },
  {
    label: 'Serialized MTG on eBay',
    href: 'https://ebay.us/MZ8psC',
    merchant: 'ebay',
  },
  {
    label: 'Magic: The Gathering on Amazon',
    href: 'https://amzn.to/4kAIv6n',
    merchant: 'amazon',
  },
];

export const defaultTrackerTheme: TrackerTheme = {
  accentClass: 'text-ring-gold',
  surfaceClass: 'bg-ring-dark',
  textClass: 'text-ring-light',
  glowClass: 'shadow-[0_0_15px_rgba(214,167,61,0.5)]',
};

export const trackers: TrackerSummary[] = [
  {
    slug: 'one-ring',
    title: 'The One Ring',
    subtitle: 'Serialized borderless poster cards',
    description: 'Track the 100 serialized The One Ring cards from MTG The Lord of the Rings: Tales of Middle-earth.',
    setName: 'The Lord of the Rings: Tales of Middle-earth',
    releaseName: 'Holiday Release',
    cardType: 'Serialized borderless poster',
    total: 100,
    href: '/trackers/one-ring',
    status: 'live',
    theme: {
      accentClass: 'text-ring-gold',
      surfaceClass: 'bg-ring-dark',
      textClass: 'text-ring-light',
      glowClass: 'shadow-[0_0_15px_rgba(214,167,61,0.5)]',
    },
    affiliateLinks: [
      {
        label: 'LOTR Singles on TCGplayer',
        href: 'https://partner.tcgplayer.com/WyLbG3',
        merchant: 'tcgplayer',
      },
      {
        label: 'Serialized One Ring on eBay',
        href: 'https://ebay.us/MZ8psC',
        merchant: 'ebay',
      },
      {
        label: 'LOTR Collector Boosters on Amazon',
        href: 'https://amzn.to/4kAIv6n',
        merchant: 'amazon',
      },
    ],
    referenceImage: 'https://cards.scryfall.io/large/front/4/e/4e6fee52-33a8-4085-b632-bf95dfd2b16d.jpg?1782694957',
  },
  {
    slug: 'golden-chocobo',
    title: 'Golden Chocobo',
    subtitle: 'Coming later',
    description: 'The existing Golden Chocobo tracker can be migrated into this platform when we are ready.',
    setName: 'Final Fantasy',
    cardType: 'Serialized card',
    total: 77,
    href: '/trackers/golden-chocobo',
    status: 'planned',
    theme: {
      accentClass: 'text-chocobo-gold',
      surfaceClass: 'bg-chocobo-dark',
      textClass: 'text-chocobo-light',
      glowClass: 'shadow-[0_0_15px_rgba(214,167,61,0.5)]',
    },
    affiliateLinks: [
      {
        label: 'Final Fantasy Singles on TCGplayer',
        href: 'https://partner.tcgplayer.com/WyLbG3',
        merchant: 'tcgplayer',
      },
      {
        label: 'Golden Chocobo on eBay',
        href: 'https://ebay.us/MZ8psC',
        merchant: 'ebay',
      },
      {
        label: 'Final Fantasy MTG on Amazon',
        href: 'https://amzn.to/4kAIv6n',
        merchant: 'amazon',
      },
    ],
  },
];

export function getTracker(slug: string) {
  return trackers.find((tracker) => tracker.slug === slug);
}

export interface AffiliateLink {
  label: string;
  href: string;
  merchant: 'tcgplayer' | 'ebay' | 'amazon' | 'other';
}

export interface ReferenceLink {
  label: string;
  href: string;
  type: 'official' | 'scryfall' | 'source' | 'article' | 'other';
}

export interface TrackerTheme {
  accentClass: string;
  surfaceClass: string;
  textClass: string;
  glowClass: string;
}

export interface TrackerStorage {
  cardsKey: string;
  submissionsKey: string;
  legacyCardsKeys?: string[];
}

export interface TrackerSummary {
  slug: string;
  catalogSlug?: string;
  title: string;
  subtitle: string;
  description: string;
  setName?: string;
  releaseName?: string;
  cardType?: string;
  total: number;
  serialPadding: number;
  storage: TrackerStorage;
  href: string;
  status: 'live' | 'planned';
  theme: TrackerTheme;
  affiliateLinks?: AffiliateLink[];
  referenceLinks?: ReferenceLink[];
  referenceImage?: string;
}

const tcgplayerPartnerLink = 'https://partner.tcgplayer.com/DyJ25G';

function buildEbaySearchUrl(query: string, customId: string) {
  const params = new URLSearchParams({
    _nkw: query,
    _sacat: '0',
    _from: 'R40',
    _trksid: 'p4432023.m570.l1313',
    mkcid: '1',
    mkrid: '711-53200-19255-0',
    siteid: '0',
    campid: '5339113954',
    customid: customId,
    toolid: '20012',
    mkevt: '1',
  });

  return `https://www.ebay.com/sch/i.html?${params.toString()}`;
}

function buildAmazonSearchUrl(query: string) {
  const params = new URLSearchParams({
    k: query,
    tag: 'meleeitonme0a-20',
  });

  return `https://www.amazon.com/s?${params.toString()}`;
}

function buildTcgplayerSearchUrl(_query: string, _sharedId: string) {
  return tcgplayerPartnerLink;
}

export const defaultAffiliateLinks: AffiliateLink[] = [
  {
    label: 'MTG Singles on TCGplayer',
    href: buildTcgplayerSearchUrl('serialized mtg', 'serialized-mtg'),
    merchant: 'tcgplayer',
  },
  {
    label: 'Serialized MTG on eBay',
    href: buildEbaySearchUrl('serialized mtg card', 'serialized-mtg'),
    merchant: 'ebay',
  },
  {
    label: 'Magic: The Gathering on Amazon',
    href: buildAmazonSearchUrl('magic the gathering collector booster'),
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
    catalogSlug: 'lotr-poster-cards',
    title: 'The One Ring',
    subtitle: 'Serialized borderless poster cards',
    description: 'Track the 100 serialized The One Ring cards from MTG The Lord of the Rings: Tales of Middle-earth.',
    setName: 'The Lord of the Rings: Tales of Middle-earth',
    releaseName: 'Holiday Release',
    cardType: 'Serialized borderless poster',
    total: 100,
    serialPadding: 3,
    storage: {
      cardsKey: 'one_ring_cards',
      submissionsKey: 'one_ring_submissions',
      legacyCardsKeys: ['one-ring-cards'],
    },
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
        href: buildTcgplayerSearchUrl('The One Ring serialized', 'one-ring'),
        merchant: 'tcgplayer',
      },
      {
        label: 'Serialized One Ring on eBay',
        href: buildEbaySearchUrl('serialized one ring mtg', 'one-ring'),
        merchant: 'ebay',
      },
      {
        label: 'LOTR Collector Boosters on Amazon',
        href: buildAmazonSearchUrl('lord of the rings mtg collector booster'),
        merchant: 'amazon',
      },
    ],
    referenceLinks: [
      {
        label: 'Wizards collecting guide',
        href: 'https://magic.wizards.com/en/news/feature/collecting-the-lord-of-the-rings-tales-of-middle-earth',
        type: 'official',
      },
      {
        label: 'Scryfall card page',
        href: 'https://scryfall.com/card/ltr/748z/the-one-ring',
        type: 'scryfall',
      },
    ],
    referenceImage: 'https://cards.scryfall.io/large/front/4/e/4e6fee52-33a8-4085-b632-bf95dfd2b16d.jpg?1782694957',
  },
  {
    slug: 'edgar-markov',
    catalogSlug: 'innistrad-remastered-edgar-markov',
    title: 'Edgar Markov',
    subtitle: 'Serialized Innistrad Remastered headliner',
    description: 'Track the 500 serialized Edgar Markov cards from Magic: The Gathering Innistrad Remastered.',
    setName: 'Innistrad Remastered',
    releaseName: 'Collector Boosters',
    cardType: 'Serialized headliner',
    total: 500,
    serialPadding: 3,
    storage: {
      cardsKey: 'edgar_markov_cards',
      submissionsKey: 'edgar_markov_submissions',
    },
    href: '/trackers/edgar-markov',
    status: 'live',
    theme: defaultTrackerTheme,
    affiliateLinks: [
      {
        label: 'Innistrad Remastered Singles on TCGplayer',
        href: buildTcgplayerSearchUrl('Edgar Markov serialized', 'edgar-markov'),
        merchant: 'tcgplayer',
      },
      {
        label: 'Serialized Edgar Markov on eBay',
        href: buildEbaySearchUrl('serialized edgar markov mtg', 'edgar-markov'),
        merchant: 'ebay',
      },
      {
        label: 'Innistrad Remastered on Amazon',
        href: buildAmazonSearchUrl('innistrad remastered collector booster'),
        merchant: 'amazon',
      },
    ],
    referenceLinks: [
      {
        label: 'Wizards collecting guide',
        href: 'https://magic.wizards.com/en/news/feature/collecting-innistrad-remastered',
        type: 'official',
      },
      {
        label: 'Scryfall card page',
        href: 'https://scryfall.com/card/inr/491/edgar-markov',
        type: 'scryfall',
      },
    ],
    referenceImage: 'https://cards.scryfall.io/large/front/e/7/e70bfc25-3c0c-4574-b504-1d1f73e9e790.jpg?1782726466',
  },
  {
    slug: 'golden-chocobo',
    catalogSlug: 'final-fantasy-traveling-chocobo',
    title: 'Golden Chocobo',
    subtitle: 'Coming later',
    description: 'The existing Golden Chocobo tracker can be migrated into this platform when we are ready.',
    setName: 'Final Fantasy',
    cardType: 'Serialized card',
    total: 77,
    serialPadding: 2,
    storage: {
      cardsKey: 'golden_chocobo_cards',
      submissionsKey: 'golden_chocobo_submissions',
      legacyCardsKeys: ['chocobo_cards', 'chocobo-cards'],
    },
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
        href: buildTcgplayerSearchUrl('Final Fantasy Traveling Chocobo', 'golden-chocobo'),
        merchant: 'tcgplayer',
      },
      {
        label: 'Golden Chocobo on eBay',
        href: buildEbaySearchUrl('traveling chocobo serialized mtg', 'golden-chocobo'),
        merchant: 'ebay',
      },
      {
        label: 'Final Fantasy MTG on Amazon',
        href: buildAmazonSearchUrl('final fantasy mtg collector booster'),
        merchant: 'amazon',
      },
    ],
  },
];

export function getTracker(slug: string) {
  return trackers.find((tracker) => tracker.slug === slug);
}

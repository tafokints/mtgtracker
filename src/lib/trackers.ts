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

export interface TrackerCardDefinition {
  slug: string;
  title: string;
  total?: number;
  serialPadding?: number;
  referenceImage?: string;
  scryfallUrl?: string;
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
  cardDefinitions?: TrackerCardDefinition[];
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
    slug: 'lotr-poster-cards',
    catalogSlug: 'lotr-poster-cards',
    title: 'LOTR Poster Cards',
    subtitle: 'Serialized borderless poster treatment',
    description: 'Track every serialized borderless poster card from The Lord of the Rings: Tales of Middle-earth Holiday Release.',
    setName: 'The Lord of the Rings: Tales of Middle-earth',
    releaseName: 'Holiday Release',
    cardType: 'Serialized borderless poster',
    total: 100,
    serialPadding: 3,
    storage: {
      cardsKey: 'lotr_poster_cards',
      submissionsKey: 'lotr_poster_submissions',
    },
    href: '/trackers/lotr-poster-cards',
    status: 'planned',
    theme: {
      accentClass: 'text-ring-gold',
      surfaceClass: 'bg-ring-dark',
      textClass: 'text-ring-light',
      glowClass: 'shadow-[0_0_15px_rgba(214,167,61,0.5)]',
    },
    affiliateLinks: [
      {
        label: 'LOTR Poster Singles on TCGplayer',
        href: buildTcgplayerSearchUrl('LOTR poster serialized', 'lotr-poster-cards'),
        merchant: 'tcgplayer',
      },
      {
        label: 'LOTR Poster Serials on eBay',
        href: buildEbaySearchUrl('serialized lotr poster mtg', 'lotr-poster-cards'),
        merchant: 'ebay',
      },
      {
        label: 'LOTR Collector Boosters on Amazon',
        href: buildAmazonSearchUrl('lord of the rings mtg special edition collector booster'),
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
        label: 'Scryfall poster query',
        href: 'https://scryfall.com/search?order=set&q=e%3Altr+%28cn%3A%22731z%22+OR+cn%3A%22732z%22+OR+cn%3A%22733z%22+OR+cn%3A%22734z%22+OR+cn%3A%22735z%22+OR+cn%3A%22736z%22+OR+cn%3A%22737z%22+OR+cn%3A%22738z%22+OR+cn%3A%22739z%22+OR+cn%3A%22740z%22+OR+cn%3A%22741z%22+OR+cn%3A%22742z%22+OR+cn%3A%22743z%22+OR+cn%3A%22744z%22+OR+cn%3A%22745z%22+OR+cn%3A%22746z%22+OR+cn%3A%22747z%22+OR+cn%3A%22748z%22+OR+cn%3A%22749z%22+OR+cn%3A%22750z%22%29&unique=prints',
        type: 'scryfall',
      },
    ],
    cardDefinitions: [
      { slug: 'dawn-of-a-new-age', title: 'Dawn of a New Age', referenceImage: 'https://cards.scryfall.io/large/front/c/9/c9108db3-93b3-4d15-8d43-8d6908c42a7c.jpg?1782694982', scryfallUrl: 'https://scryfall.com/card/ltr/731z/dawn-of-a-new-age' },
      { slug: 'gandalf-the-white', title: 'Gandalf the White', referenceImage: 'https://cards.scryfall.io/large/front/c/9/c991916f-b238-459e-9176-a3a6f00c54c2.jpg?1782694980', scryfallUrl: 'https://scryfall.com/card/ltr/732z/gandalf-the-white' },
      { slug: 'storm-of-saruman', title: 'Storm of Saruman', referenceImage: 'https://cards.scryfall.io/large/front/8/2/8213e598-e594-4db1-aad5-836fa972df8f.jpg?1782694979', scryfallUrl: 'https://scryfall.com/card/ltr/733z/storm-of-saruman' },
      { slug: 'the-watcher-in-the-water', title: 'The Watcher in the Water', referenceImage: 'https://cards.scryfall.io/large/front/2/2/2256e802-8895-432b-b381-bdca41e7ce06.jpg?1782694977', scryfallUrl: 'https://scryfall.com/card/ltr/734z/the-watcher-in-the-water' },
      { slug: 'shadow-of-the-enemy', title: 'Shadow of the Enemy', referenceImage: 'https://cards.scryfall.io/large/front/7/b/7b4b6982-c56e-4880-85ee-e24705afff55.jpg?1782694977', scryfallUrl: 'https://scryfall.com/card/ltr/735z/shadow-of-the-enemy' },
      { slug: 'witch-king-of-angmar', title: 'Witch-king of Angmar', referenceImage: 'https://cards.scryfall.io/large/front/3/d/3de94e93-2021-4d00-a9db-497373994ec3.jpg?1782694976', scryfallUrl: 'https://scryfall.com/card/ltr/736z/witch-king-of-angmar' },
      { slug: 'hew-the-entwood', title: 'Hew the Entwood', referenceImage: 'https://cards.scryfall.io/large/front/a/6/a614d5f4-cb93-4fdb-a4d6-6a6e14bfd04e.jpg?1782694974', scryfallUrl: 'https://scryfall.com/card/ltr/737z/hew-the-entwood' },
      { slug: 'spiteful-banditry', title: 'Spiteful Banditry', referenceImage: 'https://cards.scryfall.io/large/front/a/6/a6975ed0-b2f0-4820-9649-6bc5594af19a.jpg?1782694972', scryfallUrl: 'https://scryfall.com/card/ltr/738z/spiteful-banditry' },
      { slug: 'last-march-of-the-ents', title: 'Last March of the Ents', referenceImage: 'https://cards.scryfall.io/large/front/c/e/cebd776a-92ac-4a4c-a88f-335fbcb84c36.jpg?1782694971', scryfallUrl: 'https://scryfall.com/card/ltr/739z/last-march-of-the-ents' },
      { slug: 'radagast-the-brown', title: 'Radagast the Brown', referenceImage: 'https://cards.scryfall.io/large/front/3/8/385a0103-f15b-41fa-8d2c-5cf2568c4e13.jpg?1782694969', scryfallUrl: 'https://scryfall.com/card/ltr/740z/radagast-the-brown' },
      { slug: 'aragorn-the-uniter', title: 'Aragorn, the Uniter', referenceImage: 'https://cards.scryfall.io/large/front/9/d/9d481911-48a9-4cd7-a3b4-14c058dcac19.jpg?1782694968', scryfallUrl: 'https://scryfall.com/card/ltr/741z/aragorn-the-uniter' },
      { slug: 'arwen-mortal-queen', title: 'Arwen, Mortal Queen', referenceImage: 'https://cards.scryfall.io/large/front/b/a/ba4f80df-841d-4ae3-b33e-d45cdc853761.jpg?1782694967', scryfallUrl: 'https://scryfall.com/card/ltr/742z/arwen-mortal-queen' },
      { slug: 'saruman-of-many-colors', title: 'Saruman of Many Colors', referenceImage: 'https://cards.scryfall.io/large/front/a/4/a4d16e37-1fa1-4515-b29a-dbabb5c69665.jpg?1782694966', scryfallUrl: 'https://scryfall.com/card/ltr/743z/saruman-of-many-colors' },
      { slug: 'sauron-the-dark-lord', title: 'Sauron, the Dark Lord', referenceImage: 'https://cards.scryfall.io/large/front/2/7/27251103-e27c-446a-b64c-b7b0d5846b27.jpg?1782694963', scryfallUrl: 'https://scryfall.com/card/ltr/744z/sauron-the-dark-lord' },
      { slug: 'tom-bombadil', title: 'Tom Bombadil', referenceImage: 'https://cards.scryfall.io/large/front/5/0/50dd89bd-43a2-49c6-bf56-c9fbbf370540.jpg?1782694962', scryfallUrl: 'https://scryfall.com/card/ltr/745z/tom-bombadil' },
      { slug: 'anduril-flame-of-the-west', title: 'Anduril, Flame of the West', referenceImage: 'https://cards.scryfall.io/large/front/5/a/5a5354dd-ff5f-4231-bf31-039ad3448a09.jpg?1782694961', scryfallUrl: 'https://scryfall.com/card/ltr/746z/and%C3%BAril-flame-of-the-west' },
      { slug: 'glamdring', title: 'Glamdring', referenceImage: 'https://cards.scryfall.io/large/front/8/a/8a5d405b-dfea-44de-a456-eaac8af73100.jpg?1782694960', scryfallUrl: 'https://scryfall.com/card/ltr/747z/glamdring' },
      { slug: 'the-one-ring', title: 'The One Ring', referenceImage: 'https://cards.scryfall.io/large/front/4/e/4e6fee52-33a8-4085-b632-bf95dfd2b16d.jpg?1782694957', scryfallUrl: 'https://scryfall.com/card/ltr/748z/the-one-ring' },
      { slug: 'palantir-of-orthanc', title: 'Palantir of Orthanc', referenceImage: 'https://cards.scryfall.io/large/front/b/9/b9b95f71-ca89-4173-89bf-99abccd259de.jpg?1782694956', scryfallUrl: 'https://scryfall.com/card/ltr/749z/palant%C3%ADr-of-orthanc' },
      { slug: 'mount-doom', title: 'Mount Doom', referenceImage: 'https://cards.scryfall.io/large/front/6/c/6c53dace-4597-4d34-96d1-7aa6290594d4.jpg?1782694955', scryfallUrl: 'https://scryfall.com/card/ltr/750z/mount-doom' },
    ],
    referenceImage: 'https://cards.scryfall.io/large/front/4/e/4e6fee52-33a8-4085-b632-bf95dfd2b16d.jpg?1782694957',
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

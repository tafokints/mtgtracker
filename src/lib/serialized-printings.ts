import snapshot from '@/data/serialized-printings.json';
import { serializedCatalog } from '@/lib/serialized-catalog';

export type SerializedPrinting = (typeof snapshot.printings)[number];
export const serializedPrintings: SerializedPrinting[] = snapshot.printings;
export const catalogCheckedAt = snapshot.checkedAt;

const officialBase = 'https://magic.wizards.com/en/news/feature/';
export const catalogOfficialSources: Record<string, string> = {
  'bro-retro-schematic-artifacts': `${officialBase}whats-inside-the-brothers-war-boosters`,
  'mom-multiverse-legends': `${officialBase}collecting-march-of-the-machine`,
  'mom-serialized-praetors': `${officialBase}collecting-march-of-the-machine`,
  'lotr-one-ring-001': `${officialBase}collecting-the-lord-of-the-rings-tales-of-middle-earth`,
  'lotr-serialized-sol-rings': `${officialBase}collecting-the-lord-of-the-rings-tales-of-middle-earth`,
  'lotr-poster-cards': `${officialBase}collecting-the-lord-of-the-rings-tales-of-middle-earth`,
  'lotr-realms-and-relics': `${officialBase}collecting-the-lord-of-the-rings-tales-of-middle-earth`,
  'doctor-who-doctors': `${officialBase}collecting-magic-the-gathering-doctor-who`,
  'ravnica-remastered-retro-serials': `${officialBase}collecting-ravnica-remastered`,
  'mkm-ravnica-city-showcase': `${officialBase}collecting-murders-at-karlov-manor`,
  'fallout-bobbleheads': `${officialBase}collecting-magic-the-gathering-fallout`,
  'assassins-creed-historical-figures': `${officialBase}collecting-assassins-creed`,
  'mh3-concept-eldrazi': `${officialBase}collecting-modern-horizons-3`,
  'innistrad-remastered-edgar-markov': `${officialBase}collecting-innistrad-remastered`,
  'aetherdrift-aetherspark': 'https://magic.wizards.com/en/products/aetherdrift',
  'tarkir-dragonstorm-mox-jasper': 'https://magic.wizards.com/en/products/tarkir-dragonstorm',
  'final-fantasy-traveling-chocobo': `${officialBase}collecting-final-fantasy`,
  'lorwyn-eclipsed-bitterbloom-bearer': 'https://magic.wizards.com/en/products/lorwyn-eclipsed',
  'secrets-of-strixhaven-emeritus': 'https://magic.wizards.com/en/products/secrets-of-strixhaven',
  'reality-fracture-bloodline-recollector': `${officialBase}collecting-reality-fracture`,
};

export function getCatalogPrintings(catalogSlug: string) {
  return serializedPrintings.filter((printing) => printing.catalogSlug === catalogSlug);
}

export function getSerializedPrinting(catalogSlug: string, cardSlug: string) {
  return serializedPrintings.find((printing) => printing.catalogSlug === catalogSlug && printing.slug === cardSlug);
}

export function printingPath(printing: SerializedPrinting) {
  return `/serialized-mtg-catalog/${printing.catalogSlug}/${printing.slug}`;
}

export function printingTitle(printing: SerializedPrinting) {
  if (printing.catalogSlug === 'lotr-serialized-sol-rings') {
    const variants: Record<string, string> = { '408z': 'Elven Sol Ring', '409z': 'Dwarven Sol Ring', '410z': 'Human Sol Ring' };
    return variants[printing.collectorNumber] || printing.name;
  }
  return printing.name;
}

export function printingReleaseDate(printing: SerializedPrinting) {
  // Scryfall retains the summer base-set date on most serialized holiday relics.
  if (printing.catalogSlug === 'lotr-realms-and-relics') return '2023-11-03';
  return printing.releasedAt;
}

export function isReleasedPrinting(printing: SerializedPrinting) {
  return printingReleaseDate(printing) <= catalogCheckedAt;
}

export function printingLanguage(printing: SerializedPrinting) {
  return ({ en: 'English', qya: 'Quenya', it: 'Italian', grc: 'Ancient Greek' } as Record<string, string>)[printing.language] || printing.language;
}

export function printingTotal(printing: SerializedPrinting) {
  if (printing.setCode === 'WHO') {
    const doctors = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth'];
    const index = doctors.findIndex((doctor) => printing.name === `The ${doctor} Doctor`);
    if (index < 0) throw new Error(`Unknown Doctor: ${printing.name}`);
    return 501 + index;
  }
  if (printing.catalogSlug === 'lotr-serialized-sol-rings') {
    const total = ({ '408z': 300, '409z': 700, '410z': 900 } as Record<string, number>)[printing.collectorNumber];
    if (!total) throw new Error('Unknown serialized Sol Ring');
    return total;
  }
  const entry = serializedCatalog.find((entry) => entry.slug === printing.catalogSlug);
  if (!entry?.defaultSerialTotal) throw new Error(`Missing print run: ${printing.catalogSlug}`);
  return entry.defaultSerialTotal;
}

const setOverrides: Record<string, { slug: string; title: string }> = {
  BRR: { slug: 'the-brothers-war', title: "The Brothers' War" },
  MOM: { slug: 'march-of-the-machine', title: 'March of the Machine' },
  MUL: { slug: 'march-of-the-machine', title: 'March of the Machine' },
  LTR: { slug: 'the-lord-of-the-rings', title: 'The Lord of the Rings' },
  LTC: { slug: 'the-lord-of-the-rings', title: 'The Lord of the Rings' },
};
export function getCatalogSet(entry: (typeof serializedCatalog)[number]) {
  return setOverrides[entry.setCode] || {
    slug: entry.setName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), title: entry.setName,
  };
}
export const serializedSets = Array.from(new Map(serializedCatalog.map((entry) => {
  const set = getCatalogSet(entry);
  return [set.slug, set] as const;
})).values()).map((set) => ({
  ...set,
  entries: serializedCatalog.filter((entry) => getCatalogSet(entry).slug === set.slug),
}));

export function getPrintingCoverage() {
  return {
    all: serializedPrintings.length,
    english: serializedPrintings.filter((printing) => printing.language === 'en').length,
    releasedEnglish: serializedPrintings.filter((printing) => printing.language === 'en' && isReleasedPrinting(printing)).length,
    otherLanguages: serializedPrintings.filter((printing) => printing.language !== 'en').length,
    sets: serializedSets.length,
  };
}

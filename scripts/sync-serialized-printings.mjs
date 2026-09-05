import { writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const setCatalog = {
  acr: 'assassins-creed-historical-figures', brr: 'bro-retro-schematic-artifacts',
  dft: 'aetherdrift-aetherspark', ecl: 'lorwyn-eclipsed-bitterbloom-bearer',
  fin: 'final-fantasy-traveling-chocobo', fra: 'reality-fracture-bloodline-recollector',
  inr: 'innistrad-remastered-edgar-markov', mh3: 'mh3-concept-eldrazi',
  mkm: 'mkm-ravnica-city-showcase', mom: 'mom-serialized-praetors', mul: 'mom-multiverse-legends',
  pip: 'fallout-bobbleheads', rvr: 'ravnica-remastered-retro-serials',
  sos: 'secrets-of-strixhaven-emeritus', tdm: 'tarkir-dragonstorm-mox-jasper', who: 'doctor-who-doctors',
};
function catalogSlug(card) {
  if (card.set === 'ltr') return card.collector_number === '0' ? 'lotr-one-ring-001' : 'lotr-poster-cards';
  if (card.set === 'ltc') return card.name === 'Sol Ring' ? 'lotr-serialized-sol-rings' : 'lotr-realms-and-relics';
  if (card.set === 'sld') {
    if (card.name === 'Viscera Seer' && card.collector_number === 'VS') return 'secret-lair-mirrored-viscera-seer';
    if (['713', '714', '715', '716', '717'].includes(card.collector_number)) return 'secret-lair-serialized-295';
    throw new Error(`Unmapped Secret Lair printing ${card.collector_number}. Verify its numbered quantity.`);
  }
  const slug = setCatalog[card.set];
  if (!slug) throw new Error(`Unmapped serialized set ${card.set}. Research its treatment and print run before syncing.`);
  return slug;
}
function slugify(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const query = 'is:serialized lang:any';
let url = `https://api.scryfall.com/cards/search?${new URLSearchParams({ q: query, unique: 'prints', order: 'set' })}`;
const cards = [];
let expected;
while (url) {
  if (new URL(url).origin !== 'https://api.scryfall.com') throw new Error('Unexpected pagination host');
  const response = await fetch(url, { headers: { 'User-Agent': 'MTGTrackers/1.0 (https://mtgtrackers.com)', Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Scryfall returned ${response.status}`);
  const page = await response.json();
  expected ??= page.total_cards;
  if (!Array.isArray(page.data)) throw new Error('Invalid Scryfall page');
  cards.push(...page.data);
  url = page.has_more ? page.next_page : undefined;
  if (url) await sleep(150);
}
if (cards.length !== expected || new Set(cards.map((card) => card.id)).size !== cards.length) throw new Error('Incomplete or duplicate Scryfall results');
const printings = cards.map((card) => {
  if (!card.promo_types?.includes('serialized')) throw new Error(`Not serialized: ${card.id}`);
  const image = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal;
  if (!image || new URL(image).hostname !== 'cards.scryfall.io') throw new Error(`Missing reference image: ${card.id}`);
  return {
    id: card.id, slug: `${slugify(card.name.split(' // ')[0])}-${card.collector_number.toLowerCase()}`,
    catalogSlug: catalogSlug(card), name: card.name, setCode: card.set.toUpperCase(),
    collectorNumber: card.collector_number, language: card.lang, releasedAt: card.released_at,
    scryfallUrl: card.scryfall_uri.split('?')[0], referenceImage: image,
  };
});
const snapshot = { schemaVersion: 1, checkedAt: new Date().toISOString().slice(0, 10), query, source: 'https://scryfall.com/search?q=is%3Aserialized+lang%3Aany&unique=prints', printings };
await writeFile(new URL('../src/data/serialized-printings.json', import.meta.url), `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Synced ${printings.length} serialized printings; ${printings.filter((card) => card.language === 'en').length} English. Review changes before publishing.`);

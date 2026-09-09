import { describe, expect, it } from 'vitest';
import { serializedCatalog } from '@/lib/serialized-catalog';
import { getCatalogPrintings, getRelatedPrintings, printingLanguage, printingTitle, printingTotal, serializedPrintings } from '@/lib/serialized-printings';
import { allTrackers, getTracker } from '@/lib/trackers';
import { getTrackerCardDefinitions, getTrackerCardSlot, getTrackerSlotId, getTrackerTotalSlots } from '@/lib/tracker-data';

// Independent, source-reviewed expectations. Do not regenerate from runtime config.
// Evidence and remaining distribution-documentation gaps: docs/SERIAL_QUANTITY_AUDIT_2026-09-06.md.
const reviewedRuns: Record<string, { cards: number; total: number | Record<string, number> }> = {
  'secret-lair-mirrored-viscera-seer': { cards: 1, total: 100 },
  'bro-retro-schematic-artifacts': { cards: 63, total: 500 },
  'secret-lair-serialized-295': { cards: 5, total: 295 },
  'mom-multiverse-legends': { cards: 65, total: 500 },
  'mom-serialized-praetors': { cards: 5, total: 500 },
  'lotr-one-ring-001': { cards: 1, total: 1 },
  'lotr-serialized-sol-rings': { cards: 3, total: { '408z': 300, '409z': 700, '410z': 900 } },
  'lotr-poster-cards': { cards: 20, total: 100 },
  'lotr-realms-and-relics': { cards: 30, total: 100 },
  'doctor-who-doctors': { cards: 13, total: {
    '552z': 501, '553z': 502, '554z': 503, '555z': 504, '556z': 505,
    '557z': 506, '558z': 507, '559z': 508, '560z': 509, '561z': 510,
    '562z': 511, '563z': 512, '564z': 513,
  } },
  'ravnica-remastered-retro-serials': { cards: 64, total: 500 },
  'mkm-ravnica-city-showcase': { cards: 7, total: 250 },
  'fallout-bobbleheads': { cards: 7, total: 500 },
  'assassins-creed-historical-figures': { cards: 4, total: 500 },
  'mh3-concept-eldrazi': { cards: 3, total: 250 },
  'innistrad-remastered-edgar-markov': { cards: 1, total: 500 },
  'aetherdrift-aetherspark': { cards: 1, total: 500 },
  'tarkir-dragonstorm-mox-jasper': { cards: 1, total: 500 },
  'final-fantasy-traveling-chocobo': { cards: 1, total: 77 },
  'secrets-of-strixhaven-emeritus': { cards: 1, total: 500 },
  'lorwyn-eclipsed-bitterbloom-bearer': { cards: 1, total: 500 },
  'reality-fracture-bloodline-recollector': { cards: 1, total: 500 },
};

describe('source-reviewed serialized quantities', () => {
  it('requires a reviewed rule for every catalog family and exact printing', () => {
    expect(Object.keys(reviewedRuns).sort()).toEqual(serializedCatalog.map((entry) => entry.slug).sort());
    expect(Object.values(reviewedRuns).reduce((sum, run) => sum + run.cards, 0)).toBe(serializedPrintings.length);
  });

  it.each(Object.entries(reviewedRuns))('%s uses the reviewed numbered run for every card', (slug, run) => {
    const cards = getCatalogPrintings(slug);
    expect(cards).toHaveLength(run.cards);
    if (typeof run.total !== 'number') expect(Object.keys(run.total).sort()).toEqual(cards.map((card) => card.collectorNumber).sort());
    for (const card of cards) {
      const expected = typeof run.total === 'number' ? run.total : run.total[card.collectorNumber];
      expect(printingTotal(card), `${card.setCode} #${card.collectorNumber}: ${card.name}`).toBe(expected);
    }
  });

  it('uses exact printing totals and rejects out-of-run serials in every live tracker view', () => {
    for (const tracker of allTrackers.filter((tracker) => tracker.status === 'live')) {
      let offset = 0;
      for (const definition of getTrackerCardDefinitions(tracker)) {
        const printing = serializedPrintings.find((card) => card.id === definition.printingId);
        expect(printing, `${tracker.slug}: ${definition.slug}`).toBeDefined();
        const total = printingTotal(printing!);
        expect(definition.total).toBe(total);
        expect(getTrackerSlotId(tracker, definition.slug, 0)).toBeUndefined();
        expect(getTrackerSlotId(tracker, definition.slug, 1)).toBe(offset + 1);
        expect(getTrackerSlotId(tracker, definition.slug, total)).toBe(offset + total);
        expect(getTrackerSlotId(tracker, definition.slug, total + 1)).toBeUndefined();
        expect(getTrackerCardSlot(tracker, offset + total)).toMatchObject({ printingId: printing!.id, serialTotal: total });
        offset += total;
      }
      expect(getTrackerTotalSlots(tracker)).toBe(offset);
      expect(getTrackerCardSlot(tracker, offset + 1)).toBeUndefined();
    }
  });

  it('keeps unique Ring, poster Ring and Chocobo quantities and identities separate', () => {
    const unique = getCatalogPrintings('lotr-one-ring-001')[0];
    const poster = getCatalogPrintings('lotr-poster-cards').find((card) => card.collectorNumber === '748z')!;
    expect(printingTotal(unique)).toBe(1);
    expect(printingTotal(poster)).toBe(100);
    expect(unique.id).not.toBe(poster.id);
    const ring = getTracker('one-ring')!;
    expect(ring.displayTitle).toBe('The One Ring: Poster Edition /100');
    expect(printingTitle(poster)).toBe(ring.displayTitle);
    expect(printingTitle(unique)).toBe('The One Ring: Unique 001/001');
    expect(getRelatedPrintings(unique)).toContain(poster);
    expect(getRelatedPrintings(poster)).toContain(unique);
    expect(getTrackerCardDefinitions(ring)[0]).toMatchObject({ slug: 'one-ring', title: 'The One Ring' });
    expect(ring.subtitle).toContain('poster edition /100');
    expect(getTrackerCardDefinitions(ring)[0].printingId).toBe(poster.id);
    expect(getTrackerTotalSlots(ring)).toBe(100);
    expect(getTrackerTotalSlots(getTracker('lotr-poster-cards')!)).toBe(2000);
    expect(getTracker('golden-chocobo')).toMatchObject({ total: 77, status: 'live' });
    expect(printingTotal(getCatalogPrintings('final-fantasy-traveling-chocobo')[0])).toBe(77);
    expect(printingLanguage(unique)).toBe('Black Speech');
    for (const sol of getCatalogPrintings('lotr-serialized-sol-rings')) expect(printingLanguage(sol)).toBe('Quenya');
    expect(unique.language).toBe('qya');
  });
});

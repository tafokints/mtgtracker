import { describe, expect, it } from 'vitest';
import { serializedCatalog } from '@/lib/serialized-catalog';
import { getCatalogPrintings, getPrintingCoverage, isReleasedPrinting, printingPath, printingReleaseDate, printingTotal, serializedPrintings, serializedSets } from '@/lib/serialized-printings';
import { allTrackers, generatedTrackers, getCatalogAffiliateLinks, getLiveTrackerStaticParams, getPrintingAffiliateLinks, getPrintingTracker, getPrintingTrackerHref, getTracker, getSerialAffiliateLinks } from '@/lib/trackers';
import { getTrackerCardSlot, getTrackerTotalSlots } from '@/lib/tracker-data';
import { assertUrlShape } from '../scripts/validate-affiliate-links.mjs';
import sitemap from '@/app/sitemap';

describe('complete serialized printing catalog', () => {
  it('accounts for the English, non-English, and unreleased snapshot without conflating names with printings', () => {
    expect(getPrintingCoverage()).toMatchObject({ all: 298, english: 291, releasedEnglish: 290, otherLanguages: 7 });
    expect(serializedPrintings.filter((printing) => printing.language === 'en' && !isReleasedPrinting(printing)).map((card) => card.setCode)).toEqual(['FRA']);
    expect(new Set(serializedPrintings.map((card) => card.id)).size).toBe(298);
    expect(new Set(serializedPrintings.map(printingPath)).size).toBe(298);
    for (const card of serializedPrintings) expect(card.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('matches every treatment count and groups every treatment into exactly one set', () => {
    for (const entry of serializedCatalog) expect(getCatalogPrintings(entry.slug), entry.slug).toHaveLength(entry.cardCount);
    const slugs = serializedSets.flatMap((set) => set.entries.map((entry) => entry.slug));
    expect(slugs).toHaveLength(serializedCatalog.length);
    expect(new Set(slugs).size).toBe(serializedCatalog.length);
    expect(serializedSets.find((set) => set.slug === 'march-of-the-machine')?.entries).toHaveLength(2);
    expect(serializedSets.find((set) => set.slug === 'the-lord-of-the-rings')?.entries).toHaveLength(4);
  });

  it('covers every released English printing with a working tracker', () => {
    for (const card of serializedPrintings) {
      const href = getPrintingTrackerHref(card);
      if (card.language !== 'en' || !isReleasedPrinting(card)) {
        expect(href, card.name).toBeUndefined();
      } else {
        expect(href, card.name).toMatch(/^\/trackers\//);
        expect(getTracker(href!.split('/')[2].split('?')[0])?.status).toBe('live');
      }
    }
  });

  it('reuses existing records instead of creating more overlapping trackers', () => {
    for (const card of getCatalogPrintings('lotr-poster-cards')) {
      expect(getPrintingTracker(card)?.catalogGenerated).toBeUndefined();
      expect(getPrintingTrackerHref(card)).toEqual(card.collectorNumber === '748z' ? '/trackers/one-ring' : expect.stringMatching(/^\/trackers\/lotr-poster-cards\?card=/));
    }
    expect(getPrintingTracker(getCatalogPrintings('innistrad-remastered-edgar-markov')[0])?.slug).toBe('edgar-markov');
  });

  it('gives each new printing a stable isolated key and bounded, correct serial range', () => {
    expect(generatedTrackers).toHaveLength(268);
    expect(new Set(allTrackers.map((tracker) => tracker.slug)).size).toBe(allTrackers.length);
    const keys = allTrackers.flatMap((tracker) => [tracker.storage.cardsKey, tracker.storage.submissionsKey]);
    expect(new Set(keys).size).toBe(keys.length);
    for (const tracker of generatedTrackers) {
      expect(tracker.storage.cardsKey).toBe(`printing:${tracker.printingId}:cards`);
      expect(getTrackerTotalSlots(tracker)).toBeLessThanOrEqual(513);
      expect(getTrackerCardSlot(tracker, 1)?.found).toBe(false);
      expect(getTrackerCardSlot(tracker, tracker.total)?.serialNumber).toBe(String(tracker.total).padStart(3, '0'));
      expect(getTrackerCardSlot(tracker, tracker.total + 1)).toBeUndefined();
    }
  });

  it('handles Doctor-specific runs, Sol Ring variants, and corrected release dates', () => {
    expect(getCatalogPrintings('doctor-who-doctors').map(printingTotal)).toEqual(Array.from({ length: 13 }, (_, index) => 501 + index));
    expect(getCatalogPrintings('lotr-serialized-sol-rings').map(printingTotal)).toEqual([300, 700, 900]);
    expect(getCatalogPrintings('lotr-realms-and-relics').every((card) => printingReleaseDate(card) === '2023-11-03')).toBe(true);
    expect(serializedCatalog.find((entry) => entry.slug === 'tarkir-dragonstorm-mox-jasper')?.releaseMonth).toBe('2025-04');
  });

  it('preserves affiliate IDs, exact-card relevance, and genuine booster-product fallbacks on every printing', () => {
    for (const printing of serializedPrintings) for (const link of getPrintingAffiliateLinks(printing)) expect(() => assertUrlShape({ ...link, tracker: 'default' })).not.toThrow();
    for (const tracker of generatedTrackers) {
      for (const link of tracker.affiliateLinks || []) expect(() => assertUrlShape({ ...link, tracker: tracker.slug })).not.toThrow();
      const slot = getTrackerCardSlot(tracker, tracker.total)!;
      const ebay = getSerialAffiliateLinks(tracker, slot).find((link) => link.merchant === 'ebay')!;
      expect(new URL(ebay.href).searchParams.get('_nkw')).toContain(tracker.setName);
    }
    for (const [slug, query] of [['bro-retro-schematic-artifacts', 'mtg the brothers war collector booster'], ['mom-multiverse-legends', 'mtg march of the machine collector booster'], ['lotr-realms-and-relics', 'lord of the rings mtg special edition collector booster']]) {
      const entry = serializedCatalog.find((entry) => entry.slug === slug)!;
      const amazon = getCatalogAffiliateLinks(entry).find((link) => link.merchant === 'amazon')!;
      expect(new URL(amazon.href).searchParams.get('k')).toBe(query);
    }
    const promo = getCatalogAffiliateLinks(serializedCatalog.find((entry) => entry.slug === 'secret-lair-serialized-295')!);
    expect(promo.find((link) => link.merchant === 'amazon')?.ctaEyebrow).toBe('Other MTG products');
  });

  it('includes every reference and live tracker in the sitemap, without duplicates or unreleased report forms', () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const printing of serializedPrintings) expect(urls).toContain(`https://mtgtrackers.com${printingPath(printing)}`);
    for (const tracker of generatedTrackers) expect(urls).toContain(`https://mtgtrackers.com${tracker.href}/submit`);
    expect(urls.some((url) => url.includes('card-fra-402/submit'))).toBe(false);
  });

  it('prebuilds every live tracker page advertised by the sitemap', () => {
    const liveSlugs = allTrackers.filter((tracker) => tracker.status === 'live').map((tracker) => tracker.slug).sort();
    expect(getLiveTrackerStaticParams().map((params) => params.slug).sort()).toEqual(liveSlugs);
  });
});

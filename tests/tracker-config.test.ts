import { describe, expect, it } from 'vitest';
import { serializedCatalog } from '@/lib/serialized-catalog';
import { trackers } from '@/lib/trackers';

const requiredLiveMerchants = ['tcgplayer', 'ebay', 'amazon'] as const;

describe('tracker config consistency', () => {
  it('maps every live tracker to a valid serialized catalog entry', () => {
    const catalogBySlug = new Map(serializedCatalog.map((entry) => [entry.slug, entry]));
    const liveTrackers = trackers.filter((tracker) => tracker.status === 'live');

    expect(liveTrackers.length).toBeGreaterThan(0);

    for (const tracker of liveTrackers) {
      expect(tracker.catalogSlug, `${tracker.slug} catalogSlug`).toBeTruthy();

      const catalogEntry = catalogBySlug.get(tracker.catalogSlug || '');
      expect(catalogEntry, `${tracker.slug} catalog entry`).toBeTruthy();
      if (!catalogEntry) continue;

      expect(catalogEntry.status, `${tracker.slug} catalog status`).toBe('live');
      expect(tracker.setName, `${tracker.slug} setName`).toBe(catalogEntry.setName);
      expect(catalogEntry.defaultSerialTotal, `${tracker.slug} defaultSerialTotal`).toBe(tracker.total);
      expect(catalogEntry.sampleCards, `${tracker.slug} sampleCards`).toContain(tracker.title);
    }
  });

  it('keeps live catalog entries covered by at least one live tracker', () => {
    const liveTrackerCatalogSlugs = new Set(
      trackers
        .filter((tracker) => tracker.status === 'live')
        .map((tracker) => tracker.catalogSlug)
        .filter(Boolean)
    );

    for (const catalogEntry of serializedCatalog.filter((entry) => entry.status === 'live')) {
      expect(liveTrackerCatalogSlugs.has(catalogEntry.slug), `${catalogEntry.slug} live tracker coverage`).toBe(true);
    }
  });

  it('keeps live trackers wired to all primary affiliate merchants', () => {
    for (const tracker of trackers.filter((entry) => entry.status === 'live')) {
      const merchants = new Set((tracker.affiliateLinks || []).map((link) => link.merchant));

      for (const merchant of requiredLiveMerchants) {
        expect(merchants.has(merchant), `${tracker.slug} ${merchant} affiliate link`).toBe(true);
      }
    }
  });

  it('keeps tracker slugs, routes, and storage keys unique', () => {
    const slugs = new Set<string>();
    const hrefs = new Set<string>();
    const storageKeys = new Set<string>();

    for (const tracker of trackers) {
      expect(slugs.has(tracker.slug), `${tracker.slug} duplicate slug`).toBe(false);
      slugs.add(tracker.slug);

      expect(tracker.href, `${tracker.slug} href`).toBe(`/trackers/${tracker.slug}`);
      expect(hrefs.has(tracker.href), `${tracker.slug} duplicate href`).toBe(false);
      hrefs.add(tracker.href);

      for (const key of [tracker.storage.cardsKey, tracker.storage.submissionsKey]) {
        expect(storageKeys.has(key), `${tracker.slug} duplicate storage key ${key}`).toBe(false);
        storageKeys.add(key);
      }
    }
  });

  it('keeps multi-card tracker definitions internally consistent', () => {
    const multiCardTrackers = trackers.filter((tracker) => (tracker.cardDefinitions || []).length > 0);

    expect(multiCardTrackers.length).toBeGreaterThan(0);

    for (const tracker of multiCardTrackers) {
      const cardSlugs = new Set<string>();

      for (const definition of tracker.cardDefinitions || []) {
        expect(definition.slug, `${tracker.slug} card slug`).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(cardSlugs.has(definition.slug), `${tracker.slug} duplicate card slug ${definition.slug}`).toBe(false);
        expect(definition.title, `${tracker.slug} card title`).toBeTruthy();
        expect(definition.total || tracker.total, `${tracker.slug} ${definition.slug} total`).toBeGreaterThan(0);
        expect(definition.referenceImage || tracker.referenceImage, `${tracker.slug} ${definition.slug} reference image`).toMatch(/^https:\/\//);
        cardSlugs.add(definition.slug);
      }
    }
  });
});

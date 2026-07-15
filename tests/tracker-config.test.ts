import { describe, expect, it } from 'vitest';
import { AFFILIATE_PLACEMENTS } from '@/lib/affiliate-placements';
import { serializedCatalog } from '@/lib/serialized-catalog';
import { defaultAffiliateLinks, getSerialAffiliateLinks, trackers, type AffiliateLink } from '@/lib/trackers';

const requiredLiveMerchants = ['tcgplayer', 'ebay', 'amazon'] as const;
const tcgplayerPartnerPath = '/DyJ25G';
const amazonAssociateTag = 'meleeitonme0a-20';
const ebayCampaignId = '5339113954';
const expectedIntentByMerchant: Partial<Record<AffiliateLink['merchant'], AffiliateLink['intent']>> = {
  tcgplayer: 'singles',
  ebay: 'auction-comps',
  amazon: 'sealed-product',
};

function collectAffiliateLinks() {
  return [
    ...defaultAffiliateLinks.map((link) => ({ trackerSlug: 'default', link })),
    ...trackers.flatMap((tracker) => (
      (tracker.affiliateLinks || defaultAffiliateLinks).map((link) => ({ trackerSlug: tracker.slug, link }))
    )),
  ] as Array<{ trackerSlug: string; link: AffiliateLink }>;
}

describe('tracker config consistency', () => {
  it('keeps affiliate telemetry placements key-safe and unique', () => {
    expect(new Set(AFFILIATE_PLACEMENTS).size).toBe(AFFILIATE_PLACEMENTS.length);
    expect(AFFILIATE_PLACEMENTS).toEqual(expect.arrayContaining([
      'tracker-top-cta',
      'tracker-filtered-cta',
      'tracker-stats-cta',
      'tracker-directory',
      'tracker-marketplace',
      'tracker-card-serial',
      'serial-detail',
      'discoveries-page',
      'marketplace-links',
    ]));

    for (const placement of AFFILIATE_PLACEMENTS) {
      expect(placement).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

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

      if ((tracker.cardDefinitions || []).length > 0) {
        const trackedCardTitles = new Set((tracker.cardDefinitions || []).map((definition) => definition.title));

        for (const sampleCard of catalogEntry.sampleCards) {
          expect(trackedCardTitles.has(sampleCard), `${tracker.slug} sample card ${sampleCard}`).toBe(true);
        }
      } else {
        expect(catalogEntry.sampleCards, `${tracker.slug} sampleCards`).toContain(tracker.title);
      }
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

  it('keeps tracker affiliate CTA copy specific enough for top placements', () => {
    for (const tracker of trackers) {
      for (const link of tracker.affiliateLinks || []) {
        expect(link.ctaEyebrow, `${tracker.slug} ${link.merchant} CTA eyebrow`).toBeTruthy();
        expect(link.ctaDetail, `${tracker.slug} ${link.merchant} CTA detail`).toBeTruthy();
      }
    }
  });

  it('keeps affiliate attribution parameters consistent across trackers', () => {
    for (const { trackerSlug, link } of collectAffiliateLinks()) {
      const url = new URL(link.href);

      expect(url.protocol, `${trackerSlug} ${link.merchant} protocol`).toBe('https:');
      expect(link.intent, `${trackerSlug} ${link.merchant} intent`).toBeTruthy();
      expect(link.intent, `${trackerSlug} ${link.merchant} expected intent`).toBe(expectedIntentByMerchant[link.merchant] || 'marketplace');

      if (link.merchant === 'tcgplayer') {
        expect(url.hostname, `${trackerSlug} TCGplayer host`).toBe('partner.tcgplayer.com');
        expect(url.pathname, `${trackerSlug} TCGplayer partner id`).toBe(tcgplayerPartnerPath);
      }

      if (link.merchant === 'ebay') {
        const expectedCustomId = trackerSlug === 'default' ? 'serialized-mtg' : trackerSlug;

        expect(url.hostname, `${trackerSlug} eBay host`).toMatch(/(^|\.)ebay\.com$/);
        expect(url.searchParams.get('campid'), `${trackerSlug} eBay campaign id`).toBe(ebayCampaignId);
        expect(url.searchParams.get('customid'), `${trackerSlug} eBay customid`).toBe(expectedCustomId);
        expect(url.searchParams.get('mkevt'), `${trackerSlug} eBay event`).toBe('1');
        expect(url.searchParams.get('_nkw'), `${trackerSlug} eBay query`).toBeTruthy();
      }

      if (link.merchant === 'amazon') {
        expect(url.hostname, `${trackerSlug} Amazon host`).toMatch(/(^|\.)amazon\.com$/);
        expect(url.searchParams.get('tag'), `${trackerSlug} Amazon associate tag`).toBe(amazonAssociateTag);
        expect(url.searchParams.get('k'), `${trackerSlug} Amazon query`).toBeTruthy();
      }
    }
  });

  it('builds serial-specific eBay links without losing affiliate attribution', () => {
    const tracker = trackers.find((candidate) => candidate.slug === 'one-ring');
    if (!tracker) throw new Error('Expected One Ring tracker');

    const links = getSerialAffiliateLinks(tracker, {
      id: 7,
      serialNumber: '007',
      name: 'The One Ring',
      found: true,
      foundBy: 'Collector',
      verificationStatus: 'confirmed',
      priceHistory: [],
    });
    const ebayLink = links.find((link) => link.merchant === 'ebay');
    if (!ebayLink) throw new Error('Expected serial-specific eBay link');

    const url = new URL(ebayLink.href);

    expect(ebayLink.label).toBe('The One Ring 007/100 on eBay');
    expect(url.hostname).toMatch(/(^|\.)ebay\.com$/);
    expect(url.searchParams.get('campid')).toBe(ebayCampaignId);
    expect(url.searchParams.get('customid')).toBe('one-ring');
    expect(url.searchParams.get('mkevt')).toBe('1');
    expect(url.searchParams.get('_nkw')).toContain('The One Ring 007/100 serialized mtg');
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

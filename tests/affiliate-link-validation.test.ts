import { describe, expect, it } from 'vitest';
import { assertUrlShape, assessResponse } from '../scripts/validate-affiliate-links.mjs';
import { getCatalogAffiliateLinks, getCatalogTracker, getTracker, tcgplayerAffiliateLink } from '@/lib/trackers';
import { serializedCatalog } from '@/lib/serialized-catalog';

const ebay = { tracker: 'one-ring', ...getTracker('one-ring')!.affiliateLinks!.find((link) => link.merchant === 'ebay')! };
const amazon = { tracker: 'one-ring', ...getTracker('one-ring')!.affiliateLinks!.find((link) => link.merchant === 'amazon')! };

describe('affiliate destinations', () => {
  it.each(['https://notebay.com', 'https://ebay.com.attacker.example'])('rejects lookalike eBay domains: %s', (origin) => {
    const url = new URL(ebay.href);
    url.hostname = new URL(origin).hostname;
    expect(() => assertUrlShape({ ...ebay, href: url.href })).toThrow('ebay.com');
  });

  it('rejects ambiguous duplicate campaign parameters', () => {
    expect(() => assertUrlShape({ ...ebay, href: `${ebay.href}&campid=another-account` })).toThrow('duplicate campid');
  });

  it('reports a merchant bot block as unverified instead of a passed destination', () => {
    expect(assessResponse(ebay, { status: 403, ok: false, finalUrl: ebay.href }).outcome).toBe('manual-review');
  });

  it('fails when an Amazon redirect drops the Associate tag', () => {
    expect(assessResponse(amazon, { status: 200, ok: true, finalUrl: 'https://www.amazon.com/s?k=magic' }).outcome).toBe('failed');
  });

  it('requires Impact attribution on the actual TCGplayer destination', () => {
    const link = { tracker: 'default', ...tcgplayerAffiliateLink };
    const query = '?irclickid=example&irpid=6334129&irgwc=1&utm_source=impact';
    expect(assessResponse(link, { status: 200, ok: true, finalUrl: `https://www.tcgplayer.com/${query}` }).outcome).toBe('verified');
    expect(assessResponse(link, { status: 200, ok: true, finalUrl: `https://example.com/${query}` }).outcome).toBe('failed');
    expect(assessResponse(link, { status: 200, ok: true, finalUrl: 'https://www.tcgplayer.com/' }).outcome).toBe('failed');
  });

  it('uses Special Edition boosters for the serialized poster Ring', () => {
    expect(new URL(amazon.href).searchParams.get('k')).toContain('special edition');
    const catalogLinks = getCatalogAffiliateLinks(serializedCatalog.find((entry) => entry.slug === 'lotr-poster-cards')!);
    expect(new URL(catalogLinks.find((link) => link.merchant === 'amazon')!.href).searchParams.get('k')).toContain('special edition');
  });

  it('does not imply that Secret Lair promos come from collector boosters', () => {
    const entry = serializedCatalog.find((entry) => entry.foundIn?.startsWith('Bonus card'))!;
    const link = getCatalogAffiliateLinks(entry).find((link) => link.merchant === 'amazon')!;
    expect(link.ctaEyebrow).toBe('Other MTG products');
  });

  it('links the poster catalog to the complete treatment tracker', () => {
    expect(getCatalogTracker('lotr-poster-cards')?.slug).toBe('lotr-poster-cards');
  });
});

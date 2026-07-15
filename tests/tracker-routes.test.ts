import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ADMIN_COOKIE_NAME, createAdminSession } from '@/lib/admin-auth';
import { getSerialAffiliateLinks, getTracker } from '@/lib/trackers';

const redisFixture = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  const counters = new Map<string, number>();

  return {
    store,
    counters,
    redis: {
      async get(key: string) {
        if (counters.has(key)) {
          return counters.get(key);
        }
        return store.get(key);
      },
      async set(key: string, value: unknown) {
        store.set(key, value);
        return 'OK';
      },
      async del(key: string) {
        const existed = store.delete(key);
        return existed ? 1 : 0;
      },
      async incr(key: string) {
        const count = (counters.get(key) || 0) + 1;
        counters.set(key, count);
        return count;
      },
      async expire() {
        return 1;
      },
    },
  };
});

const blobFixture = vi.hoisted(() => ({
  put: vi.fn(async (pathname: string) => ({
    url: `https://blob.vercel-storage.com/${pathname}`,
    pathname,
  })),
}));

vi.mock('@/lib/redis', () => ({
  getRedis: () => redisFixture.redis,
}));

vi.mock('@vercel/blob', () => ({
  put: blobFixture.put,
}));

import { POST as submitDiscovery } from '@/app/api/trackers/[slug]/submit/route';
import { POST as uploadEvidenceImage } from '@/app/api/trackers/[slug]/upload-image/route';
import { POST as reviewSubmission } from '@/app/api/trackers/[slug]/submissions/route';
import { GET as exportTrackerBackup } from '@/app/api/trackers/[slug]/export/route';
import { POST as importTrackerBackup } from '@/app/api/trackers/[slug]/import/route';
import { POST as trackAffiliateClick } from '@/app/api/affiliate/click/route';
import { GET as getAffiliateStats } from '@/app/api/admin/affiliate-stats/route';
import { POST as trackPromotionAction } from '@/app/api/admin/promotion-action/route';

const tracker = getTracker('one-ring');

if (!tracker) {
  throw new Error('one-ring tracker fixture is missing');
}

function routeContext(slug = 'one-ring') {
  return {
    params: Promise.resolve({ slug }),
  };
}

function submitRequest(body: unknown, ip = '203.0.113.7') {
  return new Request('https://mtgtrackers.com/api/trackers/one-ring/submit', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function uploadRequest(file: File, ip = '203.0.113.7') {
  const formData = new FormData();
  formData.set('file', file);

  return new Request('https://mtgtrackers.com/api/trackers/one-ring/upload-image', {
    method: 'POST',
    headers: {
      'x-forwarded-for': ip,
    },
    body: formData,
  });
}

function affiliateClickRequest(body: unknown) {
  return new Request('https://mtgtrackers.com/api/affiliate/click', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function affiliateStatsRequest(session = createAdminSession(), days = 30) {
  return new NextRequest(`https://mtgtrackers.com/api/admin/affiliate-stats?days=${days}`, {
    method: 'GET',
    headers: {
      cookie: `${ADMIN_COOKIE_NAME}=${session}`,
    },
  });
}

function promotionActionRequest(body: unknown, session = createAdminSession()) {
  return new NextRequest('https://mtgtrackers.com/api/admin/promotion-action', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `${ADMIN_COOKIE_NAME}=${session}`,
    },
    body: JSON.stringify(body),
  });
}

function reviewRequest(body: unknown, session = createAdminSession()) {
  return new NextRequest('https://mtgtrackers.com/api/trackers/one-ring/submissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `${ADMIN_COOKIE_NAME}=${session}`,
    },
    body: JSON.stringify(body),
  });
}

function exportRequest(session = createAdminSession()) {
  return new NextRequest('https://mtgtrackers.com/api/trackers/one-ring/export', {
    method: 'GET',
    headers: {
      cookie: `${ADMIN_COOKIE_NAME}=${session}`,
    },
  });
}

function importRequest(body: unknown, session = createAdminSession()) {
  return new NextRequest('https://mtgtrackers.com/api/trackers/one-ring/import', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `${ADMIN_COOKIE_NAME}=${session}`,
    },
    body: JSON.stringify(body),
  });
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

async function submitValidDiscovery(cardId = 7, ip = '203.0.113.7', overrides: Record<string, unknown> = {}) {
  const response = await submitDiscovery(submitRequest({
    cardId,
    foundBy: 'Collector',
    dateFound: '2026-06-30',
    link: 'https://example.com/source',
    sourceType: 'marketplace',
    verificationStatus: 'source-linked',
    price: '1200',
    imageUrl: 'https://example.com/card.jpg',
    notes: 'Looks real.',
    ...overrides,
  }, ip), routeContext());

  const body = await json(response);
  return { response, body };
}

describe('tracker API routes', () => {
  beforeEach(() => {
    redisFixture.store.clear();
    redisFixture.counters.clear();
    blobFixture.put.mockClear();
    process.env.ADMIN_PASSWORD = 'test-admin-password';
    process.env.ADMIN_SESSION_SECRET = 'test-admin-secret';
    process.env.BLOB_READ_WRITE_TOKEN = 'test-blob-token';
  });

  it('returns 400 for malformed public submission JSON', async () => {
    const response = await submitDiscovery(submitRequest('not-json'), routeContext());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: 'Request body must be valid JSON' });
  });

  it('queues a valid public submission for review', async () => {
    const { response, body } = await submitValidDiscovery();
    const submissions = redisFixture.store.get(tracker.storage.submissionsKey) as Array<{ id: string; cardId: number; status: string }>;

    expect(response.status).toBe(202);
    expect(body).toMatchObject({
      message: 'Submission queued for review',
      remaining: 4,
    });
    expect(typeof body.submissionId).toBe('string');
    expect(submissions).toHaveLength(1);
    expect(submissions[0]).toMatchObject({
      id: body.submissionId,
      cardId: 7,
      status: 'pending',
    });
  });

  it('uploads a valid evidence image to blob storage', async () => {
    const file = new File(['image-bytes'], 'Serial Evidence.PNG', { type: 'image/png' });
    const response = await uploadEvidenceImage(uploadRequest(file), routeContext());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      url: expect.stringContaining('https://blob.vercel-storage.com/trackers/one-ring/evidence/'),
      contentType: 'image/png',
      size: file.size,
      remaining: 9,
    });
    expect(blobFixture.put).toHaveBeenCalledWith(
      expect.stringMatching(/^trackers\/one-ring\/evidence\/\d+-serial-evidence\.png$/),
      file,
      expect.objectContaining({
        access: 'public',
        addRandomSuffix: true,
        contentType: 'image/png',
      })
    );
  });

  it('rejects unsupported evidence upload file types', async () => {
    const file = new File(['not-image'], 'evidence.txt', { type: 'text/plain' });
    const response = await uploadEvidenceImage(uploadRequest(file), routeContext());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: 'Only JPEG, PNG, and WebP images are supported' });
    expect(blobFixture.put).not.toHaveBeenCalled();
  });

  it('tracks known affiliate link clicks without changing the destination URL', async () => {
    const link = tracker.affiliateLinks?.find((affiliateLink) => affiliateLink.merchant === 'ebay');
    if (!link) throw new Error('Expected One Ring eBay affiliate link');

    const response = await trackAffiliateClick(affiliateClickRequest({
      tracker: tracker.slug,
      merchant: link.merchant,
      href: link.href,
      label: link.label,
      placement: 'tracker-marketplace',
      sourcePath: '/trackers/one-ring?filter=has-evidence&sort=evidence-desc&serial=007',
      viewContext: {
        query: 'foil',
        filter: 'has-evidence',
        sort: 'evidence-desc',
        cardFilter: 'all',
        card: 'the-one-ring',
        serial: '007',
        slot: '7',
        ignored: 'not stored',
      },
    }));
    const date = new Date().toISOString().slice(0, 10);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(redisFixture.counters.get(`affiliate:clicks:${date}:one-ring:ebay:tracker-marketplace`)).toBe(1);
    expect(redisFixture.counters.get('affiliate:clicks:total:one-ring:ebay:tracker-marketplace')).toBe(1);
    expect(redisFixture.counters.get(`affiliate:context:${date}:one-ring:filter:has-evidence`)).toBe(1);
    expect(redisFixture.counters.get('affiliate:context:total:one-ring:filter:has-evidence')).toBe(1);
    expect(redisFixture.counters.get(`affiliate:context:${date}:one-ring:sort:evidence-desc`)).toBe(1);
    expect(redisFixture.counters.get('affiliate:context:total:one-ring:sort:evidence-desc')).toBe(1);
    expect(redisFixture.counters.get(`affiliate:context:${date}:one-ring:cardFilter:all`)).toBe(1);
    expect(redisFixture.counters.get('affiliate:context:total:one-ring:cardFilter:all')).toBe(1);
    expect(redisFixture.counters.get(`affiliate:context:${date}:one-ring:card:the-one-ring`)).toBe(1);
    expect(redisFixture.counters.get('affiliate:context:total:one-ring:card:the-one-ring')).toBe(1);
    expect(redisFixture.counters.get(`affiliate:context:${date}:one-ring:serial:007`)).toBe(1);
    expect(redisFixture.counters.get('affiliate:context:total:one-ring:serial:007')).toBe(1);
    expect(redisFixture.store.get('affiliate:last-click:one-ring:ebay:tracker-marketplace')).toMatchObject({
      tracker: 'one-ring',
      merchant: 'ebay',
      label: link.label,
      href: link.href,
      intent: link.intent,
      placement: 'tracker-marketplace',
      sourcePath: '/trackers/one-ring?filter=has-evidence&sort=evidence-desc&serial=007',
      viewContext: {
        query: 'foil',
        filter: 'has-evidence',
        sort: 'evidence-desc',
        cardFilter: 'all',
        card: 'the-one-ring',
        serial: '007',
        slot: '7',
      },
    });
  });

  it('tracks serial-specific eBay affiliate clicks with the tracker campaign id', async () => {
    const link = getSerialAffiliateLinks(tracker, {
      id: 7,
      serialNumber: '007',
      name: tracker.title,
      found: true,
      verificationStatus: 'confirmed',
      priceHistory: [],
    }).find((affiliateLink) => affiliateLink.merchant === 'ebay');
    if (!link) throw new Error('Expected serial-specific eBay affiliate link');

    const response = await trackAffiliateClick(affiliateClickRequest({
      tracker: tracker.slug,
      merchant: link.merchant,
      href: link.href,
      label: link.label,
      placement: 'serial-detail',
      sourcePath: '/trackers/one-ring?serial=007',
      viewContext: {
        serial: '007',
        slot: '7',
      },
    }));
    const date = new Date().toISOString().slice(0, 10);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(redisFixture.counters.get(`affiliate:clicks:${date}:one-ring:ebay:serial-detail`)).toBe(1);
    expect(redisFixture.counters.get('affiliate:clicks:total:one-ring:ebay:serial-detail')).toBe(1);
    expect(redisFixture.counters.get(`affiliate:context:${date}:one-ring:serial:007`)).toBe(1);
    expect(redisFixture.counters.get('affiliate:context:total:one-ring:serial:007')).toBe(1);
    expect(redisFixture.store.get('affiliate:last-click:one-ring:ebay:serial-detail')).toMatchObject({
      tracker: 'one-ring',
      merchant: 'ebay',
      label: link.label,
      href: link.href,
      intent: 'auction-comps',
      placement: 'serial-detail',
      sourcePath: '/trackers/one-ring?serial=007',
      viewContext: {
        serial: '007',
        slot: '7',
      },
    });
  });

  it('sanitizes affiliate click view context before storing last-click metadata', async () => {
    const link = tracker.affiliateLinks?.find((affiliateLink) => affiliateLink.merchant === 'amazon');
    if (!link) throw new Error('Expected One Ring Amazon affiliate link');

    const response = await trackAffiliateClick(affiliateClickRequest({
      tracker: tracker.slug,
      merchant: link.merchant,
      href: link.href,
      label: link.label,
      placement: 'tracker-top-cta',
      sourcePath: `/trackers/one-ring?${'x'.repeat(260)}`,
      viewContext: {
        query: 'x'.repeat(120),
        filter: 'source-marketplace',
        sort: 'date-desc',
        cardFilter: 'the-one-ring',
        serial: '123456789012345678901234567890',
        slot: '123456789012345678901234567890',
        card: 123,
      },
    }));

    expect(response.status).toBe(200);
    expect(redisFixture.store.get('affiliate:last-click:one-ring:amazon:tracker-top-cta')).toMatchObject({
      sourcePath: `/trackers/one-ring?${'x'.repeat(181)}`,
      viewContext: {
        query: 'x'.repeat(80),
        filter: 'source-marketplace',
        sort: 'date-desc',
        cardFilter: 'the-one-ring',
        serial: '123456789012345678901234',
        slot: '123456789012345678901234',
      },
    });
  });

  it('tracks primary top CTA affiliate placement separately', async () => {
    const link = tracker.affiliateLinks?.find((affiliateLink) => affiliateLink.merchant === 'tcgplayer');
    if (!link) throw new Error('Expected One Ring TCGplayer affiliate link');

    const response = await trackAffiliateClick(affiliateClickRequest({
      tracker: tracker.slug,
      merchant: link.merchant,
      href: link.href,
      label: link.label,
      placement: 'tracker-top-cta',
    }));
    const date = new Date().toISOString().slice(0, 10);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(redisFixture.counters.get(`affiliate:clicks:${date}:one-ring:tcgplayer:tracker-top-cta`)).toBe(1);
    expect(redisFixture.counters.get('affiliate:clicks:total:one-ring:tcgplayer:tracker-top-cta')).toBe(1);
  });

  it('rejects unknown affiliate click URLs', async () => {
    const response = await trackAffiliateClick(affiliateClickRequest({
      tracker: tracker.slug,
      merchant: 'ebay',
      href: 'https://www.ebay.com/sch/i.html?_nkw=not-ours',
      label: 'Unknown',
      placement: 'tracker-marketplace',
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: 'Unknown affiliate link' });
  });

  it('requires admin auth to read affiliate stats', async () => {
    const response = await getAffiliateStats(new NextRequest('https://mtgtrackers.com/api/admin/affiliate-stats'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: 'Unauthorized' });
  });

  it('tracks admin promotion actions separately from affiliate clicks', async () => {
    const unauthorizedResponse = await trackPromotionAction(new NextRequest('https://mtgtrackers.com/api/admin/promotion-action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tracker: tracker.slug, action: 'copy' }),
    }));

    expect(unauthorizedResponse.status).toBe(401);

    const response = await trackPromotionAction(promotionActionRequest({
      tracker: tracker.slug,
      action: 'x',
      card: 'the-one-ring',
      serial: '007',
      detailUrl: 'https://mtgtrackers.com/trackers/one-ring?serial=007&utm_source=x&utm_medium=social&utm_campaign=discovery_promotion&utm_content=one-ring-the-one-ring-007',
    }));
    const date = new Date().toISOString().slice(0, 10);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(redisFixture.counters.get(`promotion:actions:${date}:one-ring:x`)).toBe(1);
    expect(redisFixture.counters.get('promotion:actions:total:one-ring:x')).toBe(1);
    expect(redisFixture.counters.get(`promotion:context:${date}:one-ring:card:the-one-ring`)).toBe(1);
    expect(redisFixture.counters.get(`promotion:context:${date}:one-ring:serial:007`)).toBe(1);
    expect(redisFixture.store.get('promotion:last-action:one-ring:x')).toMatchObject({
      tracker: 'one-ring',
      trackerTitle: 'The One Ring',
      action: 'x',
      card: 'the-one-ring',
      serial: '007',
      detailUrl: 'https://mtgtrackers.com/trackers/one-ring?serial=007&utm_source=x&utm_medium=social&utm_campaign=discovery_promotion&utm_content=one-ring-the-one-ring-007',
    });

    const statsResponse = await getAffiliateStats(affiliateStatsRequest());
    const statsBody = await json(statsResponse);

    expect(statsResponse.status).toBe(200);
    expect(statsBody).toMatchObject({
      summary: {
        clicksInWindow: 0,
        totalClicks: 0,
      },
      promotion: {
        summary: {
          clicksInWindow: 1,
          totalClicks: 1,
          byAction: [expect.objectContaining({ key: 'x', label: 'X', clicksInWindow: 1, totalClicks: 1 })],
          byTracker: [expect.objectContaining({ key: 'one-ring', label: 'The One Ring', clicksInWindow: 1, totalClicks: 1 })],
        },
        rows: [
          expect.objectContaining({
            tracker: 'one-ring',
            trackerTitle: 'The One Ring',
            action: 'x',
            label: 'X',
            clicksInWindow: 1,
            totalClicks: 1,
            lastAction: expect.objectContaining({
              card: 'the-one-ring',
              serial: '007',
              detailUrl: 'https://mtgtrackers.com/trackers/one-ring?serial=007&utm_source=x&utm_medium=social&utm_campaign=discovery_promotion&utm_content=one-ring-the-one-ring-007',
            }),
          }),
        ],
      },
      rows: [],
    });
  });

  it('returns affiliate stats for tracked clicks', async () => {
    const ebayLink = tracker.affiliateLinks?.find((affiliateLink) => affiliateLink.merchant === 'ebay');
    const tcgplayerLink = tracker.affiliateLinks?.find((affiliateLink) => affiliateLink.merchant === 'tcgplayer');
    const serialGridEbayLink = getSerialAffiliateLinks(tracker, {
      id: 7,
      serialNumber: '007',
      name: tracker.title,
      found: false,
      verificationStatus: 'unverified',
      priceHistory: [],
    }).find((affiliateLink) => affiliateLink.merchant === 'ebay');
    if (!ebayLink) throw new Error('Expected One Ring eBay affiliate link');
    if (!tcgplayerLink) throw new Error('Expected One Ring TCGplayer affiliate link');
    if (!serialGridEbayLink) throw new Error('Expected serial grid eBay affiliate link');

    await trackAffiliateClick(affiliateClickRequest({
      tracker: tracker.slug,
      merchant: ebayLink.merchant,
      href: ebayLink.href,
      label: ebayLink.label,
      placement: 'tracker-marketplace',
      sourcePath: '/trackers/one-ring?filter=has-evidence&sort=evidence-desc&serial=007',
      viewContext: {
        filter: 'has-evidence',
        sort: 'evidence-desc',
        cardFilter: 'all',
        serial: '007',
      },
    }));
    await trackAffiliateClick(affiliateClickRequest({
      tracker: tracker.slug,
      merchant: tcgplayerLink.merchant,
      href: tcgplayerLink.href,
      label: tcgplayerLink.label,
      placement: 'tracker-top-cta',
    }));
    await trackAffiliateClick(affiliateClickRequest({
      tracker: tracker.slug,
      merchant: tcgplayerLink.merchant,
      href: tcgplayerLink.href,
      label: tcgplayerLink.label,
      placement: 'tracker-filtered-cta',
      sourcePath: '/trackers/one-ring?filter=confirmed',
      viewContext: {
        filter: 'confirmed',
      },
    }));
    await trackAffiliateClick(affiliateClickRequest({
      tracker: tracker.slug,
      merchant: ebayLink.merchant,
      href: ebayLink.href,
      label: ebayLink.label,
      placement: 'tracker-directory',
    }));
    await trackAffiliateClick(affiliateClickRequest({
      tracker: tracker.slug,
      merchant: ebayLink.merchant,
      href: ebayLink.href,
      label: ebayLink.label,
      placement: 'serial-detail',
      sourcePath: '/trackers/one-ring?serial=007',
      viewContext: {
        serial: '007',
      },
    }));
    await trackAffiliateClick(affiliateClickRequest({
      tracker: tracker.slug,
      merchant: serialGridEbayLink.merchant,
      href: serialGridEbayLink.href,
      label: serialGridEbayLink.label,
      placement: 'tracker-card-serial',
      sourcePath: '/trackers/one-ring?serial=007',
      viewContext: {
        serial: '007',
      },
    }));
    const response = await getAffiliateStats(affiliateStatsRequest());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      days: 30,
      summary: {
        clicksInWindow: 6,
        totalClicks: 6,
        bestTracker: expect.objectContaining({
          key: 'one-ring',
          clicksInWindow: 6,
        }),
        byIntent: expect.arrayContaining([
          expect.objectContaining({ key: 'auction-comps', clicksInWindow: 4 }),
          expect.objectContaining({ key: 'singles', clicksInWindow: 2 }),
        ]),
        byMerchant: expect.arrayContaining([
          expect.objectContaining({ key: 'ebay', clicksInWindow: 4 }),
          expect.objectContaining({ key: 'tcgplayer', clicksInWindow: 2 }),
        ]),
        byPlacement: expect.arrayContaining([
          expect.objectContaining({ key: 'tracker-marketplace', clicksInWindow: 1 }),
          expect.objectContaining({ key: 'tracker-top-cta', clicksInWindow: 1 }),
          expect.objectContaining({ key: 'tracker-filtered-cta', clicksInWindow: 1 }),
          expect.objectContaining({ key: 'tracker-directory', clicksInWindow: 1 }),
          expect.objectContaining({ key: 'tracker-card-serial', clicksInWindow: 1 }),
          expect.objectContaining({ key: 'serial-detail', clicksInWindow: 1 }),
        ]),
        byViewFilter: expect.arrayContaining([
          expect.objectContaining({ key: 'has-evidence', clicksInWindow: 1, totalClicks: 1 }),
          expect.objectContaining({ key: 'confirmed', clicksInWindow: 1, totalClicks: 1 }),
        ]),
        byViewSort: expect.arrayContaining([
          expect.objectContaining({ key: 'evidence-desc', clicksInWindow: 1, totalClicks: 1 }),
        ]),
        byViewCardFilter: expect.arrayContaining([
          expect.objectContaining({ key: 'all', clicksInWindow: 1, totalClicks: 1 }),
        ]),
        byViewSerial: expect.arrayContaining([
          expect.objectContaining({ key: '007', clicksInWindow: 3, totalClicks: 3 }),
        ]),
        byLastClickFilter: expect.arrayContaining([
          expect.objectContaining({ key: 'has-evidence', clicksInWindow: 1 }),
        ]),
        byLastClickSort: expect.arrayContaining([
          expect.objectContaining({ key: 'evidence-desc', clicksInWindow: 1 }),
        ]),
        byLastClickSerial: expect.arrayContaining([
          expect.objectContaining({ key: '007', clicksInWindow: 3 }),
        ]),
      },
      rows: expect.arrayContaining([
        expect.objectContaining({
          tracker: 'one-ring',
          trackerTitle: 'The One Ring',
          merchant: 'ebay',
          intent: 'auction-comps',
          label: ebayLink.label,
          href: ebayLink.href,
          placement: 'tracker-marketplace',
          clicksInWindow: 1,
          totalClicks: 1,
          lastClick: expect.objectContaining({
            href: ebayLink.href,
            sourcePath: '/trackers/one-ring?filter=has-evidence&sort=evidence-desc&serial=007',
            viewContext: {
              filter: 'has-evidence',
              sort: 'evidence-desc',
              cardFilter: 'all',
              serial: '007',
            },
          }),
        }),
        expect.objectContaining({
          tracker: 'one-ring',
          trackerTitle: 'The One Ring',
          merchant: 'tcgplayer',
          intent: 'singles',
          label: tcgplayerLink.label,
          href: tcgplayerLink.href,
          placement: 'tracker-top-cta',
          clicksInWindow: 1,
          totalClicks: 1,
        }),
        expect.objectContaining({
          tracker: 'one-ring',
          trackerTitle: 'The One Ring',
          merchant: 'tcgplayer',
          intent: 'singles',
          label: tcgplayerLink.label,
          href: tcgplayerLink.href,
          placement: 'tracker-filtered-cta',
          clicksInWindow: 1,
          totalClicks: 1,
          lastClick: expect.objectContaining({
            sourcePath: '/trackers/one-ring?filter=confirmed',
            viewContext: {
              filter: 'confirmed',
            },
          }),
        }),
        expect.objectContaining({
          tracker: 'one-ring',
          trackerTitle: 'The One Ring',
          merchant: 'ebay',
          intent: 'auction-comps',
          label: ebayLink.label,
          href: ebayLink.href,
          placement: 'serial-detail',
          clicksInWindow: 1,
          totalClicks: 1,
          lastClick: expect.objectContaining({
            href: ebayLink.href,
            sourcePath: '/trackers/one-ring?serial=007',
          }),
        }),
        expect.objectContaining({
          tracker: 'one-ring',
          trackerTitle: 'The One Ring',
          merchant: 'ebay',
          intent: 'auction-comps',
          label: ebayLink.label,
          href: ebayLink.href,
          placement: 'tracker-card-serial',
          clicksInWindow: 1,
          totalClicks: 1,
          lastClick: expect.objectContaining({
            label: serialGridEbayLink.label,
            href: serialGridEbayLink.href,
            sourcePath: '/trackers/one-ring?serial=007',
            viewContext: {
              serial: '007',
            },
          }),
        }),
      ]),
    });
  });

  it('marks repeated reports for the same serial as possible duplicates', async () => {
    const first = await submitValidDiscovery(7);
    const second = await submitValidDiscovery(7);
    const submissions = redisFixture.store.get(tracker.storage.submissionsKey) as Array<{
      id: string;
      duplicateOf?: string;
      duplicateSubmissionIds?: string[];
    }>;

    expect(second.response.status).toBe(202);
    expect(submissions[0]).toMatchObject({
      id: second.body.submissionId,
      duplicateOf: first.body.submissionId,
      duplicateSubmissionIds: [first.body.submissionId],
    });
  });

  it('rate limits repeated public submissions from the same client', async () => {
    const responses: number[] = [];

    for (let index = 0; index < 6; index += 1) {
      const { response } = await submitValidDiscovery(index + 1, '198.51.100.42');
      responses.push(response.status);
    }

    expect(responses).toEqual([202, 202, 202, 202, 202, 429]);
  });

  it('requires admin auth to review submissions', async () => {
    const request = new NextRequest('https://mtgtrackers.com/api/trackers/one-ring/submissions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ submissionId: 'missing', action: 'reject' }),
    });
    const response = await reviewSubmission(request, routeContext());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: 'Unauthorized' });
  });

  it('requires admin auth to export a tracker backup', async () => {
    const request = new NextRequest('https://mtgtrackers.com/api/trackers/one-ring/export');
    const response = await exportTrackerBackup(request, routeContext());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: 'Unauthorized' });
  });

  it('exports tracker cards and submissions for admins', async () => {
    const { body } = await submitValidDiscovery(7);
    const response = await exportTrackerBackup(exportRequest(), routeContext());
    const backup = await json(response);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('content-disposition')).toContain('one-ring-backup-');
    expect(backup).toMatchObject({
      schemaVersion: 1,
      tracker: {
        slug: 'one-ring',
        total: 100,
      },
      counts: {
        cards: 100,
        submissions: 1,
      },
    });
    expect(Array.isArray(backup.cards)).toBe(true);
    expect(Array.isArray(backup.submissions)).toBe(true);
    expect((backup.submissions as Array<{ id: string }>)[0].id).toBe(body.submissionId);
  });

  it('requires admin auth to import a tracker backup', async () => {
    const request = new NextRequest('https://mtgtrackers.com/api/trackers/one-ring/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirm: 'RESTORE_TRACKER_BACKUP', backup: {} }),
    });
    const response = await importTrackerBackup(request, routeContext());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: 'Unauthorized' });
  });

  it('requires explicit confirmation to import a tracker backup', async () => {
    const response = await importTrackerBackup(importRequest({ backup: {} }), routeContext());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: 'Restore confirmation is required' });
  });

  it('rejects backups for a different tracker slug', async () => {
    await submitValidDiscovery(7);
    const exportResponse = await exportTrackerBackup(exportRequest(), routeContext());
    const backup = await json(exportResponse);
    const response = await importTrackerBackup(importRequest({
      confirm: 'RESTORE_TRACKER_BACKUP',
      backup: {
        ...backup,
        tracker: {
          ...(backup.tracker as Record<string, unknown>),
          slug: 'edgar-markov',
        },
      },
    }), routeContext());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: 'Backup tracker does not match this tracker' });
  });

  it('imports a matching tracker backup and overwrites cards and submissions', async () => {
    const { body } = await submitValidDiscovery(7);
    const exportResponse = await exportTrackerBackup(exportRequest(), routeContext());
    const backup = await json(exportResponse);

    redisFixture.store.set(tracker.storage.cardsKey, []);
    redisFixture.store.set(tracker.storage.submissionsKey, []);

    const response = await importTrackerBackup(importRequest({
      confirm: 'RESTORE_TRACKER_BACKUP',
      backup,
    }), routeContext());
    const cards = redisFixture.store.get(tracker.storage.cardsKey) as Array<{ id: number; serialNumber: string }>;
    const submissions = redisFixture.store.get(tracker.storage.submissionsKey) as Array<{ id: string }>;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: 'Backup restored',
      counts: {
        cards: 100,
        submissions: 1,
      },
    });
    expect(cards).toHaveLength(100);
    expect(cards[6]).toMatchObject({ id: 7, serialNumber: '007' });
    expect(submissions).toHaveLength(1);
    expect(submissions[0].id).toBe(body.submissionId);
  });

  it('approves a pending submission and updates the target card', async () => {
    const { body } = await submitValidDiscovery(7);
    const response = await reviewSubmission(reviewRequest({
      submissionId: body.submissionId,
      action: 'approve',
      reviewedBy: 'admin',
      reviewNotes: 'Verified against source.',
      verificationStatus: 'confirmed',
      imageUrl: 'https://example.com/admin-image.jpg',
    }), routeContext());
    const cards = redisFixture.store.get(tracker.storage.cardsKey) as Array<{ id: number; found: boolean; verificationStatus: string; image?: string; price?: number }>;
    const submissions = redisFixture.store.get(tracker.storage.submissionsKey) as Array<{ id: string; status: string; reviewedBy?: string }>;

    expect(response.status).toBe(200);
    expect(cards[6]).toMatchObject({
      id: 7,
      found: true,
      verificationStatus: 'confirmed',
      image: 'https://example.com/admin-image.jpg',
      price: 1200,
    });
    expect(submissions[0]).toMatchObject({
      id: body.submissionId,
      status: 'approved',
      reviewedBy: 'admin',
    });
  });

  it('merges selected duplicate evidence when approving a submission', async () => {
    const primary = await submitValidDiscovery(10, '203.0.113.10', {
      imageUrl: 'https://example.com/primary-card.jpg',
      evidenceImageUrls: ['https://example.com/primary-evidence.jpg'],
    });
    const duplicate = await submitValidDiscovery(10, '203.0.113.11', {
      imageUrl: 'https://example.com/duplicate-card.jpg',
      evidenceImageUrls: ['https://example.com/duplicate-evidence.jpg'],
    });
    const response = await reviewSubmission(reviewRequest({
      submissionId: primary.body.submissionId,
      action: 'approve',
      reviewedBy: 'admin',
      mergeSubmissionIds: [duplicate.body.submissionId],
    }), routeContext());
    const cards = redisFixture.store.get(tracker.storage.cardsKey) as Array<{
      id: number;
      evidenceImages?: Array<{ url: string; sourceSubmissionId?: string }>;
    }>;
    const submissions = redisFixture.store.get(tracker.storage.submissionsKey) as Array<{
      id: string;
      status: string;
      duplicateOf?: string;
      reviewNotes?: string;
    }>;

    expect(response.status).toBe(200);
    expect(cards[9].evidenceImages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: 'https://example.com/primary-card.jpg',
        sourceSubmissionId: primary.body.submissionId,
      }),
      expect.objectContaining({
        url: 'https://example.com/primary-evidence.jpg',
        sourceSubmissionId: primary.body.submissionId,
      }),
      expect.objectContaining({
        url: 'https://example.com/duplicate-card.jpg',
        sourceSubmissionId: duplicate.body.submissionId,
      }),
      expect.objectContaining({
        url: 'https://example.com/duplicate-evidence.jpg',
        sourceSubmissionId: duplicate.body.submissionId,
      }),
    ]));
    expect(submissions.find((submission) => submission.id === duplicate.body.submissionId)).toMatchObject({
      status: 'duplicate',
      duplicateOf: primary.body.submissionId,
      reviewNotes: `Merged evidence into ${primary.body.submissionId}.`,
    });
  });

  it('rejects a pending submission without changing card state', async () => {
    const { body } = await submitValidDiscovery(8);
    const beforeCards = redisFixture.store.get(tracker.storage.cardsKey) as Array<{ id: number; found: boolean; verificationStatus: string }>;
    const beforeCard = { ...beforeCards[7] };
    const response = await reviewSubmission(reviewRequest({
      submissionId: body.submissionId,
      action: 'reject',
      reviewedBy: 'admin',
      reviewNotes: 'Could not verify.',
    }), routeContext());
    const afterCards = redisFixture.store.get(tracker.storage.cardsKey) as Array<{ id: number; found: boolean; verificationStatus: string }>;
    const submissions = redisFixture.store.get(tracker.storage.submissionsKey) as Array<{ id: string; status: string; reviewNotes?: string }>;

    expect(response.status).toBe(200);
    expect(afterCards[7]).toMatchObject(beforeCard);
    expect(submissions[0]).toMatchObject({
      id: body.submissionId,
      status: 'rejected',
      reviewNotes: 'Could not verify.',
    });
  });

  it('can request more information without changing card state', async () => {
    const { body } = await submitValidDiscovery(9);
    const beforeCards = redisFixture.store.get(tracker.storage.cardsKey) as Array<{ id: number; found: boolean; verificationStatus: string }>;
    const beforeCard = { ...beforeCards[8] };
    const response = await reviewSubmission(reviewRequest({
      submissionId: body.submissionId,
      action: 'needs-more-info',
      reviewedBy: 'admin',
      reviewNotes: 'Need a clearer serial photo.',
    }), routeContext());
    const afterCards = redisFixture.store.get(tracker.storage.cardsKey) as Array<{ id: number; found: boolean; verificationStatus: string }>;
    const submissions = redisFixture.store.get(tracker.storage.submissionsKey) as Array<{ id: string; status: string; reviewNotes?: string }>;

    expect(response.status).toBe(200);
    expect(afterCards[8]).toMatchObject(beforeCard);
    expect(submissions[0]).toMatchObject({
      id: body.submissionId,
      status: 'needs-more-info',
      reviewNotes: 'Need a clearer serial photo.',
    });
  });
});

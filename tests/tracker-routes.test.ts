import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ADMIN_COOKIE_NAME, createAdminSession } from '@/lib/admin-auth';
import { buildAmazonSearchUrl, buildTrackerEbaySearchUrl, getSerialAffiliateLinks, getTracker } from '@/lib/trackers';
import sharp from 'sharp';
import { ACTIVE_PRINTING_TRACKERS_KEY } from '@/lib/tracker-store';

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
        return structuredClone(store.get(key));
      },
      async set(key: string, value: unknown, options?: { nx?: boolean }) {
        if (options?.nx && store.has(key)) return null;
        store.set(key, structuredClone(value));
        return 'OK';
      },
      async eval(script: string, keys: string[], args: string[]) {
        const raw = (key: string) => store.has(key) ? JSON.stringify(store.get(key)) : null;
        if (script.includes('-- restore printing')) {
          store.set(keys[0], JSON.parse(args[0]));
          store.set(keys[1], JSON.parse(args[1]));
          store.set(keys[2], Array.from(new Set([...(store.get(keys[2]) as string[] || []), args[2]])));
          return 1;
        }
        if (script.includes("redis.call('MSET'")) {
          if ((raw(keys[0]) || '') !== args[0] || (raw(keys[1]) || '') !== args[1]) return 0;
          store.set(keys[0], JSON.parse(args[2]));
          store.set(keys[1], JSON.parse(args[3]));
          if (keys[2]) store.set(keys[2], Array.from(new Set([...(store.get(keys[2]) as string[] || []), args[4]])));
          return 1;
        }
        return { cards: raw(keys[0]), submissions: raw(keys[1]) };
      },
      async mset(values: Record<string, unknown>) {
        for (const [key, value] of Object.entries(values)) store.set(key, structuredClone(value));
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
import { POST as trackPromotionVisit } from '@/app/api/promotion/visit/route';
import { POST as trackDirectoryClick } from '@/app/api/directory/click/route';
import { POST as loginAdmin } from '@/app/api/admin/login/route';
import { POST as updatePrice } from '@/app/api/trackers/[slug]/update-price/route';
import { POST as updateImage } from '@/app/api/trackers/[slug]/update-image/route';
import { POST as updateGrading } from '@/app/api/trackers/[slug]/update-grading/route';
import { POST as addPriceHistory } from '@/app/api/trackers/[slug]/add-price-history/route';
import { GET as readCards } from '@/app/api/trackers/[slug]/cards/route';
import { GET as readSubmissions } from '@/app/api/trackers/[slug]/submissions/route';
import { GET as readSession, DELETE as logoutAdmin } from '@/app/api/admin/login/route';
import { createInitialTrackerCards } from '@/lib/tracker-data';

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

async function realImage(format: 'png' | 'jpeg' | 'webp' = 'png') {
  const buffer = await sharp({ create: { width: 24, height: 32, channels: 3, background: '#0099aa' } }).toFormat(format).toBuffer();
  return new File([new Uint8Array(buffer)], `private-owner-name.${format}`, { type: `image/${format}` });
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

function directoryClickRequest(body: unknown) {
  return new Request('https://mtgtrackers.com/api/directory/click', {
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

function promotionVisitRequest(body: unknown) {
  return new Request('https://mtgtrackers.com/api/promotion/visit', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
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
  afterEach(() => vi.restoreAllMocks());
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

  it.each([null, [], 'text', 1])('rejects non-object JSON bodies: %j', async (value) => {
    const response = await submitDiscovery(submitRequest(JSON.stringify(value)), routeContext());
    expect(response.status).toBe(400);
    expect(redisFixture.store.size).toBe(0);
  });

  it('preserves simultaneous reports and duplicate candidates', async () => {
    const results = await Promise.all([
      submitValidDiscovery(7, '203.0.113.1'),
      submitValidDiscovery(7, '203.0.113.2'),
      submitValidDiscovery(8, '203.0.113.3'),
    ]);
    expect(results.map(({ response }) => response.status)).toEqual([202, 202, 202]);
    const submissions = redisFixture.store.get(tracker.storage.submissionsKey) as Array<{ cardId: number; duplicateSubmissionIds: string[] }>;
    expect(submissions).toHaveLength(3);
    expect(submissions.filter((report) => report.cardId === 7).map((report) => report.duplicateSubmissionIds.length).sort()).toEqual([0, 1]);
  });

  it('commits a review only once when two admins approve together', async () => {
    const { body } = await submitValidDiscovery();
    const responses = await Promise.all([0, 1].map(() => reviewSubmission(
      reviewRequest({ submissionId: body.submissionId, action: 'approve' }), routeContext(),
    )));
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const cards = redisFixture.store.get(tracker.storage.cardsKey) as Array<{ priceHistory: unknown[] }>;
    expect(cards[6].priceHistory).toHaveLength(1);
  });

  it('preserves concurrent price and image edits', async () => {
    const responses = await Promise.all([
      updatePrice(reviewRequest({ cardId: 7, price: 1800 }), routeContext()),
      updateImage(reviewRequest({ cardId: 7, imageUrl: 'https://example.com/new.jpg' }), routeContext()),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const cards = redisFixture.store.get(tracker.storage.cardsKey) as unknown[];
    expect(cards[6]).toMatchObject({ price: 1800, image: 'https://example.com/new.jpg' });
  });

  it('does not partially approve when the atomic commit fails', async () => {
    const { body } = await submitValidDiscovery();
    const cardsBefore = structuredClone(redisFixture.store.get(tracker.storage.cardsKey));
    const evalCommand = redisFixture.redis.eval;
    vi.spyOn(redisFixture.redis, 'eval').mockImplementation(async (script, keys, args) => {
      if (script.includes("redis.call('MSET'")) throw new Error('Test storage failure');
      return evalCommand(script, keys, args);
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await reviewSubmission(reviewRequest({ submissionId: body.submissionId, action: 'approve' }), routeContext());
    expect(response.status).toBe(500);
    expect(redisFixture.store.get(tracker.storage.cardsKey)).toEqual(cardsBefore);
    expect(redisFixture.store.get(tracker.storage.submissionsKey)).toEqual([expect.objectContaining({ status: 'pending' })]);
  });

  it('exports and restores every slot in a multi-card tracker', async () => {
    const poster = getTracker('lotr-poster-cards')!;
    const cards = createInitialTrackerCards(poster);
    cards[1999].found = true;
    redisFixture.store.set(poster.storage.cardsKey, cards);
    const exported = await exportTrackerBackup(exportRequest(), routeContext(poster.slug));
    const backup = await exported.json();
    expect(backup.cards).toHaveLength(2000);
    expect(backup.tracker.totalSlots).toBe(2000);
    const response = await importTrackerBackup(importRequest({ confirm: 'RESTORE_TRACKER_BACKUP', backup }), routeContext(poster.slug));
    expect(response.status).toBe(200);
    const restored = redisFixture.store.get(poster.storage.cardsKey) as unknown[];
    expect(restored).toHaveLength(2000);
    expect(restored[1999]).toMatchObject({ cardSlug: 'mount-doom', serialNumber: '100', found: true });
  });

  it('rejects inherited property names as review actions', async () => {
    const { body } = await submitValidDiscovery();
    const response = await reviewSubmission(reviewRequest({ submissionId: body.submissionId, action: 'toString' }), routeContext());
    expect(response.status).toBe(400);
  });

  it('rate-limits admin password guesses without issuing a session', async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await loginAdmin(submitRequest({ password: 'wrong' }))).status).toBe(401);
    }
    const blocked = await loginAdmin(submitRequest({ password: 'test-admin-password' }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('set-cookie')).toBeNull();
    const allowed = await loginAdmin(submitRequest({ password: 'test-admin-password' }, '203.0.113.8'));
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get('set-cookie')).toContain('HttpOnly');
  });

  it('uploads a valid evidence image to blob storage', async () => {
    const file = await realImage();
    const response = await uploadEvidenceImage(uploadRequest(file), routeContext());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      url: expect.stringContaining('https://blob.vercel-storage.com/trackers/one-ring/evidence/'),
      contentType: 'image/webp',
      size: expect.any(Number),
      width: 24,
      height: 32,
      remaining: 9,
    });
    expect(blobFixture.put).toHaveBeenCalledWith(
      expect.stringMatching(/^trackers\/one-ring\/evidence\/[a-f0-9-]+\.webp$/),
      expect.any(Buffer),
      expect.objectContaining({
        access: 'public',
        addRandomSuffix: true,
        contentType: 'image/webp',
      })
    );
  });

  it.each(['png', 'jpeg', 'webp'] as const)('decodes and stores real %s image bytes', async (format) => {
    const response = await uploadEvidenceImage(uploadRequest(await realImage(format)), routeContext());
    expect(response.status).toBe(200);
    expect((await response.json()).pathname).not.toContain('private-owner-name');
  });

  it.each([
    new File(['image-bytes'], 'fake.png', { type: 'image/png' }),
    new File(['<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"></svg>'], 'fake.png', { type: 'image/png' }),
    new File([], 'empty.png', { type: 'image/png' }),
  ])('rejects invalid upload content: $name', async (file) => {
    expect((await uploadEvidenceImage(uploadRequest(file), routeContext())).status).toBe(400);
    expect(blobFixture.put).not.toHaveBeenCalled();
  });

  it('rejects a MIME mismatch and oversized or malformed multipart requests', async () => {
    const png = await realImage();
    const mismatch = new File([await png.arrayBuffer()], 'fake.jpg', { type: 'image/jpeg' });
    expect((await uploadEvidenceImage(uploadRequest(mismatch), routeContext())).status).toBe(400);
    const oversized = new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' });
    expect((await uploadEvidenceImage(uploadRequest(oversized), routeContext())).status).toBe(413);
    const malformed = new Request('https://mtgtrackers.com/upload', { method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=missing' }, body: 'not multipart' });
    expect((await uploadEvidenceImage(malformed, routeContext())).status).toBe(400);
    expect(blobFixture.put).not.toHaveBeenCalled();
  });

  it('requires exactly one file and returns 415 for non-multipart input', async () => {
    const form = new FormData();
    const file = await realImage();
    form.append('file', file); form.append('file', file);
    const duplicate = new Request('https://mtgtrackers.com/upload', { method: 'POST', body: form });
    expect((await uploadEvidenceImage(duplicate, routeContext())).status).toBe(400);
    expect((await uploadEvidenceImage(submitRequest({ file: 'fake' }), routeContext())).status).toBe(415);
    expect(blobFixture.put).not.toHaveBeenCalled();
  });

  it('fails closed when Blob configuration or storage is unavailable', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect((await uploadEvidenceImage(uploadRequest(await realImage()), routeContext())).status).toBe(503);
    expect(blobFixture.put).not.toHaveBeenCalled();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-blob-token';
    blobFixture.put.mockRejectedValueOnce(new Error('Fixture storage failure'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await uploadEvidenceImage(uploadRequest(await realImage()), routeContext())).status).toBe(500);
  });

  it('enforces cross-tracker IP and site-wide upload limits', async () => {
    redisFixture.counters.set('rate-limit:upload:203.0.113.7', 10);
    const response = await uploadEvidenceImage(uploadRequest(await realImage()), routeContext('card-brr-64z'));
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('3600');
    redisFixture.counters.clear();
    redisFixture.counters.set('rate-limit:upload:site', 500);
    expect((await uploadEvidenceImage(uploadRequest(await realImage()), routeContext())).status).toBe(429);
    expect(blobFixture.put).not.toHaveBeenCalled();
  });

  it('runs upload -> pending report -> private review -> public read -> edits -> backup restore', async () => {
    const uploaded = await (await uploadEvidenceImage(uploadRequest(await realImage()), routeContext())).json();
    const { body } = await submitValidDiscovery(7, '203.0.113.7', { imageUrl: uploaded.url });
    const before = await (await readCards(new Request('https://mtgtrackers.com/cards'), routeContext())).json();
    expect(before[6]).toMatchObject({ found: false, pendingReports: 1 });
    const queueRequest = new NextRequest('https://mtgtrackers.com/submissions?status=pending', { headers: { cookie: `${ADMIN_COOKIE_NAME}=${createAdminSession()}` } });
    const queue = await (await readSubmissions(queueRequest, routeContext())).json();
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe(body.submissionId);
    expect((await reviewSubmission(reviewRequest({ submissionId: body.submissionId, action: 'approve', verificationStatus: 'confirmed' }), routeContext())).status).toBe(200);
    expect((await updateGrading(reviewRequest({ cardId: 7, grading: { service: 'PSA', grade: 9, dateGraded: '2026-08-01' } }), routeContext())).status).toBe(200);
    expect((await addPriceHistory(reviewRequest({ cardId: 7, entry: { price: 1200, date: '2026-08-02', soldBy: 'Fixture seller' } }), routeContext())).status).toBe(200);
    expect((await updatePrice(reviewRequest({ cardId: 7, price: '1250.50' }), routeContext())).status).toBe(200);
    expect((await updateImage(reviewRequest({ cardId: 7, imageUrl: uploaded.url }), routeContext())).status).toBe(200);
    const after = await (await readCards(new Request('https://mtgtrackers.com/cards'), routeContext())).json();
    expect(after[6]).toMatchObject({ found: true, pendingReports: 0, image: uploaded.url, price: 1250.50, grading: { service: 'PSA', grade: 9 } });
    expect(after[6].evidenceImages).toEqual(expect.arrayContaining([expect.objectContaining({ url: uploaded.url, sourceSubmissionId: body.submissionId })]));
    const backup = await (await exportTrackerBackup(exportRequest(), routeContext())).json();
    await updatePrice(reviewRequest({ cardId: 7, price: 1 }), routeContext());
    expect((await importTrackerBackup(importRequest({ confirm: 'RESTORE_TRACKER_BACKUP', backup }), routeContext())).status).toBe(200);
    const restored = await (await readCards(new Request('https://mtgtrackers.com/cards'), routeContext())).json();
    expect(restored).toEqual(after);
  });

  it('keeps generated printing records isolated and indexes activity on mutation/restore', async () => {
    const generated = getTracker('card-brr-64z')!;
    const other = getTracker('card-brr-65z')!;
    const response = await submitDiscovery(submitRequest({ cardId: 500, notes: 'Isolated fixture' }), routeContext(generated.slug));
    expect(response.status).toBe(202);
    expect(redisFixture.store.get(ACTIVE_PRINTING_TRACKERS_KEY)).toEqual([generated.slug]);
    expect(redisFixture.store.has(other.storage.cardsKey)).toBe(false);
    expect(redisFixture.store.has(tracker.storage.cardsKey)).toBe(false);
    const backup = await (await exportTrackerBackup(exportRequest(), routeContext(generated.slug))).json();
    redisFixture.store.delete(ACTIVE_PRINTING_TRACKERS_KEY);
    expect((await importTrackerBackup(importRequest({ confirm: 'RESTORE_TRACKER_BACKUP', backup }), routeContext(generated.slug))).status).toBe(200);
    expect(redisFixture.store.get(ACTIVE_PRINTING_TRACKERS_KEY)).toEqual([generated.slug]);
  });

  it.each([{}, { cards: null }, { cards: '' }])('initializes untouched printing slots for absent Redis fields: %j', async (raw) => {
    const generated = getTracker('card-brr-98z')!;
    vi.spyOn(redisFixture.redis, 'eval').mockResolvedValueOnce(raw as never);
    const response = await readCards(new Request('https://mtgtrackers.com/cards'), routeContext(generated.slug));
    expect(response.status).toBe(200);
    const cards = await response.json();
    expect(cards).toHaveLength(500);
    expect(cards[0]).toMatchObject({ id: 1, serialNumber: '001', found: false });
    expect(cards[499]).toMatchObject({ id: 500, serialNumber: '500', found: false });
  });

  it('does not silently publish an empty grid if initialized cards are unreadable', async () => {
    redisFixture.store.set(tracker.storage.cardsKey, []);
    expect((await readCards(new Request('https://mtgtrackers.com/cards'), routeContext())).status).toBe(500);
    expect(redisFixture.store.get(tracker.storage.cardsKey)).toEqual([]);
  });

  it.each([updatePrice, updateImage, updateGrading, addPriceHistory, reviewSubmission, importTrackerBackup])('protects every privileged mutation from anonymous requests', async (handler) => {
    const request = new NextRequest('https://mtgtrackers.com/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect((await handler(request, routeContext())).status).toBe(401);
    expect(redisFixture.store.size).toBe(0);
  });

  it.each(['7junk', '7.5', 7.5, true, null])('rejects malformed IDs in all card edits: %j', async (cardId) => {
    const requests = [
      [updatePrice, { cardId, price: 100 }], [updateImage, { cardId, imageUrl: 'https://example.com/a.png' }],
      [updateGrading, { cardId, grading: { service: 'PSA', grade: 9 } }], [addPriceHistory, { cardId, entry: { price: 100, date: '2026-08-01' } }],
    ] as const;
    for (const [handler, body] of requests) expect((await handler(reviewRequest(body), routeContext())).status).toBe(400);
    expect(redisFixture.store.size).toBe(0);
  });

  it.each([null, false, '', '9junk', 'Infinity', -1])('rejects invalid admin prices: %j', async (price) => {
    expect((await updatePrice(reviewRequest({ cardId: 7, price }), routeContext())).status).toBe(400);
  });

  it.each([null, false, '9junk', 'Infinity', 11, -1])('rejects invalid grades: %j', async (grade) => {
    expect((await updateGrading(reviewRequest({ cardId: 7, grading: { service: 'PSA', grade } }), routeContext())).status).toBe(400);
  });

  it('rejects impossible dates and dangerous image URLs', async () => {
    expect((await addPriceHistory(reviewRequest({ cardId: 7, entry: { price: 1, date: '2026-02-30' } }), routeContext())).status).toBe(400);
    expect((await updateGrading(reviewRequest({ cardId: 7, grading: { service: 'PSA', grade: 9, dateGraded: 'nonsense' } }), routeContext())).status).toBe(400);
    for (const imageUrl of ['javascript:alert(1)', '//example.com/a.png', '/\\example.com/a.png', 'https://user:pass@example.com/a.png']) {
      expect((await updateImage(reviewRequest({ cardId: 7, imageUrl }), routeContext())).status).toBe(400);
    }
  });

  it('returns 404 for missing records and keeps reviewed reports immutable', async () => {
    expect((await updatePrice(reviewRequest({ cardId: 101, price: 100 }), routeContext())).status).toBe(404);
    for (const action of ['reject', 'needs-more-info', 'duplicate', 'cannot-verify']) {
      const { body } = await submitValidDiscovery(7, `203.0.113.${action.length}`);
      expect((await reviewSubmission(reviewRequest({ submissionId: body.submissionId, action }), routeContext())).status).toBe(200);
      expect((await reviewSubmission(reviewRequest({ submissionId: body.submissionId, action: 'approve' }), routeContext())).status).toBe(409);
    }
    const cards = await (await readCards(new Request('https://mtgtrackers.com/cards'), routeContext())).json();
    expect(cards[6].found).toBe(false);
  });

  it.each([
    { imageUrl: 'javascript:alert(1)' }, { imageUrl: '//attacker.test/image' },
    { reviewedBy: 'x'.repeat(121) }, { reviewNotes: 'x'.repeat(5001) },
    { verificationStatus: 'trusted' }, { mergeSubmissionIds: [true] },
    { mergeSubmissionIds: Array(101).fill('id') },
  ])('rejects invalid review overrides without approving: %j', async (details) => {
    const { body } = await submitValidDiscovery(7);
    const response = await reviewSubmission(reviewRequest({ submissionId: body.submissionId, action: 'approve', ...details }), routeContext());
    expect(response.status).toBe(400);
    expect((redisFixture.store.get(tracker.storage.submissionsKey) as Array<{ status: string }>)[0].status).toBe('pending');
  });

  it.each([
    { id: '1' }, { serialNumber: '999' }, { cardSlug: 'another-card' },
    { evidenceImages: 'not an array' }, { evidenceImages: [{ url: 'javascript:alert(1)' }] },
    { priceHistory: {} }, { priceHistory: [{ price: true, date: '2026-09-05' }] },
    { grading: { service: 'PSA', grade: 11 } }, { found: 'false' }, { image: '//attacker.test/x' },
  ])('rejects malformed backup cards without replacing live state: %j', async (fields) => {
    await submitValidDiscovery(7);
    const backup = await (await exportTrackerBackup(exportRequest(), routeContext())).json();
    const before = structuredClone(redisFixture.store.get(tracker.storage.cardsKey));
    Object.assign(backup.cards[0], fields);
    const response = await importTrackerBackup(importRequest({ confirm: 'RESTORE_TRACKER_BACKUP', backup }), routeContext());
    expect(response.status).toBe(400);
    expect(redisFixture.store.get(tracker.storage.cardsKey)).toEqual(before);
  });

  it('rejects duplicate or malformed submission records during restore', async () => {
    await submitValidDiscovery(7);
    const backup = await (await exportTrackerBackup(exportRequest(), routeContext())).json();
    const restore = (submissions: unknown[]) => importTrackerBackup(importRequest({ confirm: 'RESTORE_TRACKER_BACKUP', backup: { ...backup, submissions } }), routeContext());
    expect((await restore([backup.submissions[0], backup.submissions[0]])).status).toBe(400);
    for (const fields of [{ cardId: '7' }, { serialTotal: 999 }, { evidenceImages: {} }, { submittedAt: 'not a date' }]) {
      expect((await restore([{ ...backup.submissions[0], ...fields }])).status).toBe(400);
    }
  });

  it('logs out by deleting the browser session cookie', async () => {
    expect(await (await readSession(reviewRequest({}))).json()).toEqual({ authenticated: true });
    const response = await logoutAdmin();
    expect(await response.json()).toEqual({ authenticated: false });
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
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

  it('tracks catalog-specific default eBay searches with affiliate attribution', async () => {
    const href = buildTrackerEbaySearchUrl('serialized The Aetherspark mtg', 'serialized-mtg');
    const response = await trackAffiliateClick(affiliateClickRequest({
      tracker: 'default',
      merchant: 'ebay',
      href,
      label: 'The Aetherspark serials on eBay',
      placement: 'marketplace-links',
      sourcePath: '/serialized-mtg-catalog/aetherdrift-aetherspark',
      viewContext: {
        card: 'aetherdrift-aetherspark',
      },
    }));
    const date = new Date().toISOString().slice(0, 10);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(redisFixture.counters.get(`affiliate:clicks:${date}:default:ebay:marketplace-links`)).toBe(1);
    expect(redisFixture.counters.get('affiliate:clicks:total:default:ebay:marketplace-links')).toBe(1);
    expect(redisFixture.counters.get(`affiliate:context:${date}:default:card:aetherdrift-aetherspark`)).toBe(1);
    expect(redisFixture.store.get('affiliate:last-click:default:ebay:marketplace-links')).toMatchObject({
      tracker: 'default',
      merchant: 'ebay',
      label: 'The Aetherspark serials on eBay',
      href,
      intent: 'auction-comps',
      placement: 'marketplace-links',
      sourcePath: '/serialized-mtg-catalog/aetherdrift-aetherspark',
      viewContext: {
        card: 'aetherdrift-aetherspark',
      },
    });
  });

  it('tracks catalog-specific default Amazon searches with affiliate attribution', async () => {
    const href = buildAmazonSearchUrl('Aetherdrift collector booster');
    const response = await trackAffiliateClick(affiliateClickRequest({
      tracker: 'default',
      merchant: 'amazon',
      href,
      label: 'Aetherdrift on Amazon',
      placement: 'marketplace-links',
      sourcePath: '/serialized-mtg-catalog/aetherdrift-aetherspark',
      viewContext: {
        card: 'aetherdrift-aetherspark',
      },
    }));
    const date = new Date().toISOString().slice(0, 10);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(redisFixture.counters.get(`affiliate:clicks:${date}:default:amazon:marketplace-links`)).toBe(1);
    expect(redisFixture.counters.get('affiliate:clicks:total:default:amazon:marketplace-links')).toBe(1);
    expect(redisFixture.counters.get(`affiliate:context:${date}:default:card:aetherdrift-aetherspark`)).toBe(1);
    expect(redisFixture.store.get('affiliate:last-click:default:amazon:marketplace-links')).toMatchObject({
      tracker: 'default',
      merchant: 'amazon',
      label: 'Aetherdrift on Amazon',
      href,
      intent: 'sealed-product',
      placement: 'marketplace-links',
      sourcePath: '/serialized-mtg-catalog/aetherdrift-aetherspark',
      viewContext: {
        card: 'aetherdrift-aetherspark',
      },
    });
  });

  it('rejects catalog Amazon searches that drop the Associate tag', async () => {
    const unsafeHref = new URL(buildAmazonSearchUrl('Aetherdrift collector booster'));
    unsafeHref.searchParams.delete('tag');

    const response = await trackAffiliateClick(affiliateClickRequest({
      tracker: 'default',
      merchant: 'amazon',
      href: unsafeHref.toString(),
      label: 'Aetherdrift on Amazon',
      placement: 'marketplace-links',
      sourcePath: '/serialized-mtg-catalog/aetherdrift-aetherspark',
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: 'Unknown affiliate link' });
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

  it('tracks recent discovery affiliate clicks as their own placement', async () => {
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
      placement: 'discoveries-page',
      sourcePath: '/discoveries',
      viewContext: {
        serial: '007',
        slot: '7',
      },
    }));
    const date = new Date().toISOString().slice(0, 10);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(redisFixture.counters.get(`affiliate:clicks:${date}:one-ring:ebay:discoveries-page`)).toBe(1);
    expect(redisFixture.counters.get('affiliate:clicks:total:one-ring:ebay:discoveries-page')).toBe(1);
    expect(redisFixture.counters.get(`affiliate:context:${date}:one-ring:serial:007`)).toBe(1);
    expect(redisFixture.store.get('affiliate:last-click:one-ring:ebay:discoveries-page')).toMatchObject({
      tracker: 'one-ring',
      merchant: 'ebay',
      placement: 'discoveries-page',
      sourcePath: '/discoveries',
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

  it('drops external affiliate click source paths before storing last-click metadata', async () => {
    const link = tracker.affiliateLinks?.find((affiliateLink) => affiliateLink.merchant === 'amazon');
    if (!link) throw new Error('Expected One Ring Amazon affiliate link');

    const externalResponse = await trackAffiliateClick(affiliateClickRequest({
      tracker: tracker.slug,
      merchant: link.merchant,
      href: link.href,
      label: link.label,
      placement: 'tracker-top-cta',
      sourcePath: 'https://example.com/trackers/one-ring',
    }));
    const protocolRelativeResponse = await trackAffiliateClick(affiliateClickRequest({
      tracker: tracker.slug,
      merchant: link.merchant,
      href: link.href,
      label: link.label,
      placement: 'tracker-stats-cta',
      sourcePath: '//example.com/trackers/one-ring',
    }));

    expect(externalResponse.status).toBe(200);
    expect(protocolRelativeResponse.status).toBe(200);
    expect(redisFixture.store.get('affiliate:last-click:one-ring:amazon:tracker-top-cta')).toMatchObject({
      sourcePath: undefined,
    });
    expect(redisFixture.store.get('affiliate:last-click:one-ring:amazon:tracker-stats-cta')).toMatchObject({
      sourcePath: undefined,
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

  it('rejects unknown affiliate placements before writing click counters', async () => {
    const link = tracker.affiliateLinks?.find((affiliateLink) => affiliateLink.merchant === 'ebay');
    if (!link) throw new Error('Expected One Ring eBay affiliate link');

    const response = await trackAffiliateClick(affiliateClickRequest({
      tracker: tracker.slug,
      merchant: link.merchant,
      href: link.href,
      label: link.label,
      placement: 'typo-placement',
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: 'Unknown affiliate placement' });
    expect([...redisFixture.counters.keys()].some((key) => key.includes('typo-placement'))).toBe(false);
  });

  it('requires admin auth to read affiliate stats', async () => {
    const response = await getAffiliateStats(new NextRequest('https://mtgtrackers.com/api/admin/affiliate-stats'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: 'Unauthorized' });
  });

  it('includes affiliate coverage readiness in admin affiliate stats', async () => {
    const response = await getAffiliateStats(affiliateStatsRequest());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      affiliateCoverage: {
        summary: {
          trackerCount: expect.any(Number),
          readyCount: expect.any(Number),
          issueCount: 0,
          errorCount: 0,
          warningCount: 0,
          averageScore: 100,
        },
        rows: expect.arrayContaining([
          expect.objectContaining({
            tracker: 'one-ring',
            trackerTitle: 'The One Ring',
            score: 100,
            issues: [],
            merchants: expect.arrayContaining(['tcgplayer', 'ebay', 'amazon']),
          }),
        ]),
      },
    });
  });

  it('tracks public tracker directory CTA clicks for admin stats', async () => {
    const unknownTrackerResponse = await trackDirectoryClick(directoryClickRequest({
      tracker: 'not-real',
      action: 'open-tracker',
      href: '/trackers/not-real',
    }));
    const unknownActionResponse = await trackDirectoryClick(directoryClickRequest({
      tracker: tracker.slug,
      action: 'print-money',
      href: '/trackers/one-ring',
    }));

    expect(unknownTrackerResponse.status).toBe(400);
    await expect(unknownTrackerResponse.json()).resolves.toEqual({ message: 'Unknown tracker' });
    expect(unknownActionResponse.status).toBe(400);
    await expect(unknownActionResponse.json()).resolves.toEqual({ message: 'Unknown directory action' });

    const response = await trackDirectoryClick(directoryClickRequest({
      tracker: tracker.slug,
      action: 'report-find',
      href: '/trackers/one-ring/submit',
      sourcePath: '/trackers',
    }));
    const date = new Date().toISOString().slice(0, 10);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(redisFixture.counters.get(`directory:clicks:${date}:one-ring:report-find`)).toBe(1);
    expect(redisFixture.counters.get('directory:clicks:total:one-ring:report-find')).toBe(1);
    expect(redisFixture.store.get('directory:last-click:one-ring:report-find')).toMatchObject({
      tracker: 'one-ring',
      trackerTitle: 'The One Ring',
      action: 'report-find',
      href: '/trackers/one-ring/submit',
      sourcePath: '/trackers',
    });

    const statsResponse = await getAffiliateStats(affiliateStatsRequest());
    const statsBody = await json(statsResponse);

    expect(statsResponse.status).toBe(200);
    expect(statsBody).toMatchObject({
      directory: {
        summary: {
          clicksInWindow: 1,
          totalClicks: 1,
          byAction: [expect.objectContaining({ key: 'report-find', label: 'Report Find', clicksInWindow: 1, totalClicks: 1 })],
          byTracker: [expect.objectContaining({ key: 'one-ring', label: 'The One Ring', clicksInWindow: 1, totalClicks: 1 })],
        },
        rows: [
          expect.objectContaining({
            tracker: 'one-ring',
            trackerTitle: 'The One Ring',
            action: 'report-find',
            label: 'Report Find',
            clicksInWindow: 1,
            totalClicks: 1,
            lastClick: expect.objectContaining({
              href: '/trackers/one-ring/submit',
              sourcePath: '/trackers',
            }),
          }),
        ],
      },
    });
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
        efficiency: [
          expect.objectContaining({
            key: 'one-ring',
            label: 'The One Ring',
            promotionActionsInWindow: 1,
            promotionActionsTotal: 1,
            promotionVisitsInWindow: 0,
            promotionVisitsTotal: 0,
            affiliateClicksInWindow: 0,
            affiliateClicksTotal: 0,
            affiliateClicksPerActionInWindow: 0,
            affiliateClicksPerActionTotal: 0,
            affiliateClicksPerVisitInWindow: null,
            affiliateClicksPerVisitTotal: null,
          }),
        ],
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

  it('tracks promoted discovery page visits for known campaign URLs', async () => {
    const rejectedResponse = await trackPromotionVisit(promotionVisitRequest({
      tracker: tracker.slug,
      source: 'x',
      campaign: 'not-ours',
    }));

    expect(rejectedResponse.status).toBe(400);
    await expect(rejectedResponse.json()).resolves.toEqual({ message: 'Unknown promotion campaign' });

    const response = await trackPromotionVisit(promotionVisitRequest({
      tracker: tracker.slug,
      source: 'x',
      campaign: 'discovery_promotion',
      content: 'one-ring-the-one-ring-007',
      card: 'the-one-ring',
      serial: '007',
      path: '/trackers/one-ring?serial=007&utm_source=x&utm_medium=social&utm_campaign=discovery_promotion&utm_content=one-ring-the-one-ring-007',
    }));
    const date = new Date().toISOString().slice(0, 10);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(redisFixture.counters.get(`promotion:visits:${date}:one-ring:x`)).toBe(1);
    expect(redisFixture.counters.get('promotion:visits:total:one-ring:x')).toBe(1);
    expect(redisFixture.counters.get(`promotion:visit-context:${date}:one-ring:card:the-one-ring`)).toBe(1);
    expect(redisFixture.counters.get(`promotion:visit-context:${date}:one-ring:serial:007`)).toBe(1);
    expect(redisFixture.counters.get(`promotion:visit-context:${date}:one-ring:content:one-ring-the-one-ring-007`)).toBe(1);
    expect(redisFixture.store.get('promotion:last-visit:one-ring:x')).toMatchObject({
      tracker: 'one-ring',
      trackerTitle: 'The One Ring',
      source: 'x',
      campaign: 'discovery_promotion',
      content: 'one-ring-the-one-ring-007',
      card: 'the-one-ring',
      serial: '007',
      path: '/trackers/one-ring?serial=007&utm_source=x&utm_medium=social&utm_campaign=discovery_promotion&utm_content=one-ring-the-one-ring-007',
    });

    const statsResponse = await getAffiliateStats(affiliateStatsRequest());
    const statsBody = await json(statsResponse);

    expect(statsResponse.status).toBe(200);
    expect(statsBody).toMatchObject({
      promotion: {
        visits: {
          summary: {
            clicksInWindow: 1,
            totalClicks: 1,
            bySource: [expect.objectContaining({ key: 'x', label: 'X', clicksInWindow: 1, totalClicks: 1 })],
            byTracker: [expect.objectContaining({ key: 'one-ring', label: 'The One Ring', clicksInWindow: 1, totalClicks: 1 })],
          },
          rows: [
            expect.objectContaining({
              tracker: 'one-ring',
              trackerTitle: 'The One Ring',
              source: 'x',
              label: 'X',
              clicksInWindow: 1,
              totalClicks: 1,
            }),
          ],
        },
        efficiency: [
          expect.objectContaining({
            key: 'one-ring',
            promotionActionsInWindow: 0,
            promotionVisitsInWindow: 1,
            affiliateClicksInWindow: 0,
            affiliateClicksPerVisitInWindow: 0,
          }),
        ],
      },
    });
  });

  it('tracks public copied discovery visits as a promotion source', async () => {
    const response = await trackPromotionVisit(promotionVisitRequest({
      tracker: tracker.slug,
      source: 'public_copy',
      campaign: 'discovery_promotion',
      content: 'one-ring-the-one-ring-007',
      card: 'the-one-ring',
      serial: '007',
      path: '/trackers/one-ring?serial=007&utm_source=public_copy&utm_medium=social&utm_campaign=discovery_promotion&utm_content=one-ring-the-one-ring-007',
    }));
    const date = new Date().toISOString().slice(0, 10);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(redisFixture.counters.get(`promotion:visits:${date}:one-ring:public_copy`)).toBe(1);
    expect(redisFixture.counters.get('promotion:visits:total:one-ring:public_copy')).toBe(1);
    expect(redisFixture.store.get('promotion:last-visit:one-ring:public_copy')).toMatchObject({
      tracker: 'one-ring',
      source: 'public_copy',
      campaign: 'discovery_promotion',
      serial: '007',
    });

    const statsResponse = await getAffiliateStats(affiliateStatsRequest());
    const statsBody = await json(statsResponse);

    expect(statsResponse.status).toBe(200);
    expect(statsBody).toMatchObject({
      promotion: {
        visits: {
          summary: {
            bySource: [expect.objectContaining({ key: 'public_copy', label: 'Public Copy', clicksInWindow: 1, totalClicks: 1 })],
          },
          rows: [
            expect.objectContaining({
              source: 'public_copy',
              label: 'Public Copy',
              clicksInWindow: 1,
              totalClicks: 1,
            }),
          ],
        },
      },
    });
  });

  it('summarizes promotion efficiency against affiliate clicks by tracker', async () => {
    const ebayLink = tracker.affiliateLinks?.find((affiliateLink) => affiliateLink.merchant === 'ebay');
    if (!ebayLink) throw new Error('Expected One Ring eBay affiliate link');

    await trackPromotionAction(promotionActionRequest({
      tracker: tracker.slug,
      action: 'x',
      card: 'the-one-ring',
      serial: '007',
      detailUrl: 'https://mtgtrackers.com/trackers/one-ring?serial=007&utm_source=x&utm_medium=social&utm_campaign=discovery_promotion&utm_content=one-ring-the-one-ring-007',
    }));
    await trackPromotionAction(promotionActionRequest({
      tracker: tracker.slug,
      action: 'reddit',
      card: 'the-one-ring',
      serial: '007',
      detailUrl: 'https://mtgtrackers.com/trackers/one-ring?serial=007&utm_source=reddit&utm_medium=social&utm_campaign=discovery_promotion&utm_content=one-ring-the-one-ring-007',
    }));
    await trackPromotionVisit(promotionVisitRequest({
      tracker: tracker.slug,
      source: 'x',
      campaign: 'discovery_promotion',
      content: 'one-ring-the-one-ring-007',
      card: 'the-one-ring',
      serial: '007',
      path: '/trackers/one-ring?serial=007&utm_source=x&utm_medium=social&utm_campaign=discovery_promotion&utm_content=one-ring-the-one-ring-007',
    }));
    await trackAffiliateClick(affiliateClickRequest({
      tracker: tracker.slug,
      merchant: ebayLink.merchant,
      href: ebayLink.href,
      label: ebayLink.label,
      placement: 'serial-detail',
      sourcePath: '/trackers/one-ring?serial=007&utm_source=x&utm_medium=social&utm_campaign=discovery_promotion&utm_content=one-ring-the-one-ring-007',
      viewContext: {
        serial: '007',
      },
    }));
    await trackAffiliateClick(affiliateClickRequest({
      tracker: tracker.slug,
      merchant: ebayLink.merchant,
      href: ebayLink.href,
      label: ebayLink.label,
      placement: 'discoveries-page',
      sourcePath: '/trackers/one-ring?serial=007&utm_source=public_copy&utm_medium=social&utm_campaign=discovery_promotion&utm_content=one-ring-the-one-ring-007',
      viewContext: {
        serial: '007',
      },
    }));
    const date = new Date().toISOString().slice(0, 10);

    expect(redisFixture.counters.get(`affiliate:promotion-source:${date}:x`)).toBe(1);
    expect(redisFixture.counters.get('affiliate:promotion-source:total:x')).toBe(1);
    expect(redisFixture.counters.get(`affiliate:promotion-source:${date}:public_copy`)).toBe(1);
    expect(redisFixture.counters.get('affiliate:promotion-source:total:public_copy')).toBe(1);

    const response = await getAffiliateStats(affiliateStatsRequest());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      summary: {
        clicksInWindow: 2,
        totalClicks: 2,
      },
      promotion: {
        summary: {
          clicksInWindow: 2,
          totalClicks: 2,
        },
        affiliateSources: expect.arrayContaining([
          expect.objectContaining({
            key: 'public_copy',
            label: 'Public Copy',
            clicksInWindow: 1,
            totalClicks: 1,
          }),
          expect.objectContaining({
            key: 'x',
            label: 'X',
            clicksInWindow: 1,
            totalClicks: 1,
          }),
        ]),
        efficiency: expect.arrayContaining([
          expect.objectContaining({
            key: 'one-ring',
            label: 'The One Ring',
            promotionActionsInWindow: 2,
            promotionActionsTotal: 2,
            promotionVisitsInWindow: 1,
            promotionVisitsTotal: 1,
            affiliateClicksInWindow: 2,
            affiliateClicksTotal: 2,
            affiliateClicksPerActionInWindow: 1,
            affiliateClicksPerActionTotal: 1,
            affiliateClicksPerVisitInWindow: 2,
            affiliateClicksPerVisitTotal: 2,
          }),
        ]),
        sourceEfficiency: expect.arrayContaining([
          expect.objectContaining({
            key: 'public_copy',
            label: 'Public Copy',
            promotionActionsInWindow: 0,
            promotionVisitsInWindow: 0,
            affiliateClicksInWindow: 1,
          }),
          expect.objectContaining({
            key: 'x',
            label: 'X',
            promotionActionsInWindow: 1,
            promotionActionsTotal: 1,
            promotionVisitsInWindow: 1,
            promotionVisitsTotal: 1,
            affiliateClicksInWindow: 1,
            affiliateClicksTotal: 1,
            affiliateClicksPerActionInWindow: 1,
            affiliateClicksPerActionTotal: 1,
            affiliateClicksPerVisitInWindow: 1,
            affiliateClicksPerVisitTotal: 1,
          }),
          expect.objectContaining({
            key: 'reddit',
            label: 'Reddit',
            promotionActionsInWindow: 1,
            promotionVisitsInWindow: 0,
            affiliateClicksInWindow: 0,
          }),
        ]),
      },
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

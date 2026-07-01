import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ADMIN_COOKIE_NAME, createAdminSession } from '@/lib/admin-auth';
import { getTracker } from '@/lib/trackers';

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
    }));
    const date = new Date().toISOString().slice(0, 10);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(redisFixture.counters.get(`affiliate:clicks:${date}:one-ring:ebay:tracker-marketplace`)).toBe(1);
    expect(redisFixture.counters.get('affiliate:clicks:total:one-ring:ebay:tracker-marketplace')).toBe(1);
    expect(redisFixture.store.get('affiliate:last-click:one-ring:ebay:tracker-marketplace')).toMatchObject({
      tracker: 'one-ring',
      merchant: 'ebay',
      label: link.label,
      placement: 'tracker-marketplace',
    });
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

  it('returns affiliate stats for tracked clicks', async () => {
    const link = tracker.affiliateLinks?.find((affiliateLink) => affiliateLink.merchant === 'ebay');
    if (!link) throw new Error('Expected One Ring eBay affiliate link');

    await trackAffiliateClick(affiliateClickRequest({
      tracker: tracker.slug,
      merchant: link.merchant,
      href: link.href,
      label: link.label,
      placement: 'tracker-marketplace',
    }));
    const response = await getAffiliateStats(affiliateStatsRequest());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      days: 30,
      rows: [
        expect.objectContaining({
          tracker: 'one-ring',
          trackerTitle: 'The One Ring',
          merchant: 'ebay',
          label: link.label,
          href: link.href,
          placement: 'tracker-marketplace',
          clicksInWindow: 1,
          totalClicks: 1,
        }),
      ],
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

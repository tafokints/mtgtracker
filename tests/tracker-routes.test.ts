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

vi.mock('@/lib/redis', () => ({
  getRedis: () => redisFixture.redis,
}));

import { POST as submitDiscovery } from '@/app/api/trackers/[slug]/submit/route';
import { POST as reviewSubmission } from '@/app/api/trackers/[slug]/submissions/route';
import { GET as exportTrackerBackup } from '@/app/api/trackers/[slug]/export/route';

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
    process.env.ADMIN_PASSWORD = 'test-admin-password';
    process.env.ADMIN_SESSION_SECRET = 'test-admin-secret';
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

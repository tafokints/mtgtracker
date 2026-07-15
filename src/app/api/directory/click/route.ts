import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { readJsonBody } from '@/lib/request-json';
import { getTracker } from '@/lib/trackers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DIRECTORY_ACTIONS = ['open-tracker', 'report-find', 'latest-discovery'] as const;

function safeKeyPart(value: string) {
  return value.replace(/[^a-z0-9._-]/gi, '-');
}

function sanitizeInternalPath(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.slice(0, 240);

  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return undefined;
  }

  return trimmed;
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const input = body.value as {
    tracker?: unknown;
    action?: unknown;
    href?: unknown;
    sourcePath?: unknown;
  };

  const trackerSlug = typeof input.tracker === 'string' ? input.tracker : '';
  const action = typeof input.action === 'string' ? input.action : '';
  const href = sanitizeInternalPath(input.href);
  const sourcePath = sanitizeInternalPath(input.sourcePath);
  const tracker = getTracker(trackerSlug);

  if (!tracker || tracker.status !== 'live') {
    return NextResponse.json({ message: 'Unknown tracker' }, { status: 400 });
  }

  if (!DIRECTORY_ACTIONS.includes(action as typeof DIRECTORY_ACTIONS[number])) {
    return NextResponse.json({ message: 'Unknown directory action' }, { status: 400 });
  }

  try {
    const redis = getRedis();
    const date = new Date().toISOString().slice(0, 10);
    const keySuffix = [tracker.slug, action].map(safeKeyPart).join(':');

    await Promise.all([
      redis.incr(`directory:clicks:${date}:${keySuffix}`),
      redis.incr(`directory:clicks:total:${keySuffix}`),
      redis.set(`directory:last-click:${keySuffix}`, {
        tracker: tracker.slug,
        trackerTitle: tracker.title,
        action,
        href,
        sourcePath,
        clickedAt: new Date().toISOString(),
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error tracking directory click:', error);
    return NextResponse.json({ message: 'Directory click tracking failed' }, { status: 500 });
  }
}

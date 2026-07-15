import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { readJsonBody } from '@/lib/request-json';
import { getTracker } from '@/lib/trackers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROMOTION_CAMPAIGN = 'discovery_promotion';
const PROMOTION_SOURCES = ['admin_copy', 'x', 'reddit'] as const;

function safeKeyPart(value: string) {
  return value.replace(/[^a-z0-9._-]/gi, '-');
}

function sanitizeInternalPath(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return undefined;
  }

  return value.slice(0, 240);
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const input = body.value as {
    tracker?: unknown;
    source?: unknown;
    campaign?: unknown;
    content?: unknown;
    card?: unknown;
    serial?: unknown;
    path?: unknown;
  };
  const trackerSlug = typeof input.tracker === 'string' ? input.tracker : '';
  const source = typeof input.source === 'string' ? input.source : '';
  const campaign = typeof input.campaign === 'string' ? input.campaign : '';
  const content = typeof input.content === 'string' ? input.content.slice(0, 120) : undefined;
  const card = typeof input.card === 'string' ? input.card.slice(0, 80) : undefined;
  const serial = typeof input.serial === 'string' ? input.serial.slice(0, 24) : undefined;
  const path = sanitizeInternalPath(input.path);
  const tracker = getTracker(trackerSlug);

  if (!tracker || tracker.status !== 'live') {
    return NextResponse.json({ message: 'Unknown tracker' }, { status: 400 });
  }

  if (campaign !== PROMOTION_CAMPAIGN) {
    return NextResponse.json({ message: 'Unknown promotion campaign' }, { status: 400 });
  }

  if (!PROMOTION_SOURCES.includes(source as typeof PROMOTION_SOURCES[number])) {
    return NextResponse.json({ message: 'Unknown promotion source' }, { status: 400 });
  }

  try {
    const redis = getRedis();
    const now = new Date().toISOString();
    const date = now.slice(0, 10);
    const keyParts = [trackerSlug, source].map(safeKeyPart);
    const contextIncrements: Array<Promise<unknown>> = [];
    const addContextCounter = (field: 'card' | 'serial' | 'content', value?: string) => {
      if (!value) return;

      const contextKeyParts = [trackerSlug, field, value].map(safeKeyPart);
      contextIncrements.push(
        redis.incr(`promotion:visit-context:${date}:${contextKeyParts.join(':')}`),
        redis.incr(`promotion:visit-context:total:${contextKeyParts.join(':')}`),
      );
    };

    addContextCounter('card', card);
    addContextCounter('serial', serial);
    addContextCounter('content', content);

    await Promise.all([
      redis.incr(`promotion:visits:${date}:${keyParts.join(':')}`),
      redis.incr(`promotion:visits:total:${keyParts.join(':')}`),
      redis.set(`promotion:last-visit:${keyParts.join(':')}`, {
        tracker: trackerSlug,
        trackerTitle: tracker.title,
        source,
        campaign,
        content,
        card,
        serial,
        path,
        visitedAt: now,
      }),
      ...contextIncrements,
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error tracking promotion visit:', error);
    return NextResponse.json({ message: 'Promotion visit tracking failed' }, { status: 500 });
  }
}

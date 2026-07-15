import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getRedis } from '@/lib/redis';
import { readJsonBody } from '@/lib/request-json';
import { getTracker } from '@/lib/trackers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROMOTION_ACTIONS = ['copy', 'native-share', 'x', 'reddit'] as const;

function safeKeyPart(value: string) {
  return value.replace(/[^a-z0-9._-]/gi, '-');
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const input = body.value as {
    tracker?: unknown;
    action?: unknown;
    card?: unknown;
    serial?: unknown;
    detailUrl?: unknown;
  };
  const trackerSlug = typeof input.tracker === 'string' ? input.tracker : '';
  const action = typeof input.action === 'string' ? input.action : '';
  const card = typeof input.card === 'string' ? input.card.slice(0, 80) : undefined;
  const serial = typeof input.serial === 'string' ? input.serial.slice(0, 24) : undefined;
  const detailUrl = typeof input.detailUrl === 'string' ? input.detailUrl.slice(0, 240) : undefined;
  const tracker = getTracker(trackerSlug);

  if (!tracker || tracker.status !== 'live') {
    return NextResponse.json({ message: 'Unknown tracker' }, { status: 400 });
  }

  if (!PROMOTION_ACTIONS.includes(action as typeof PROMOTION_ACTIONS[number])) {
    return NextResponse.json({ message: 'Unknown promotion action' }, { status: 400 });
  }

  try {
    const redis = getRedis();
    const now = new Date().toISOString();
    const date = now.slice(0, 10);
    const keyParts = [trackerSlug, action].map(safeKeyPart);
    const contextIncrements: Array<Promise<unknown>> = [];

    if (card) {
      const cardKeyParts = [trackerSlug, 'card', card].map(safeKeyPart);
      contextIncrements.push(
        redis.incr(`promotion:context:${date}:${cardKeyParts.join(':')}`),
        redis.incr(`promotion:context:total:${cardKeyParts.join(':')}`),
      );
    }

    if (serial) {
      const serialKeyParts = [trackerSlug, 'serial', serial].map(safeKeyPart);
      contextIncrements.push(
        redis.incr(`promotion:context:${date}:${serialKeyParts.join(':')}`),
        redis.incr(`promotion:context:total:${serialKeyParts.join(':')}`),
      );
    }

    await Promise.all([
      redis.incr(`promotion:actions:${date}:${keyParts.join(':')}`),
      redis.incr(`promotion:actions:total:${keyParts.join(':')}`),
      redis.set(`promotion:last-action:${keyParts.join(':')}`, {
        tracker: trackerSlug,
        trackerTitle: tracker.title,
        action,
        card,
        serial,
        detailUrl,
        actedAt: now,
      }),
      ...contextIncrements,
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error tracking promotion action:', error);
    return NextResponse.json({ message: 'Promotion tracking failed' }, { status: 500 });
  }
}

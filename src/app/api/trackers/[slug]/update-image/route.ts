import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { requireAdmin } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/request-json';
import { mutateTrackerState, TrackerStoreError } from '@/lib/tracker-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ slug: string }>;
};

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' || value.startsWith('/');
  } catch {
    return value.startsWith('/');
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { slug } = await params;
  const tracker = getTracker(slug);
  if (!tracker || tracker.status !== 'live') {
    return NextResponse.json({ message: 'Tracker not found' }, { status: 404 });
  }

  try {
    const redis = getRedis();
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;

    const { cardId, imageUrl } = body.value as { cardId?: unknown; imageUrl?: unknown };

    if (typeof imageUrl !== 'string' || !isValidHttpUrl(imageUrl)) {
      return NextResponse.json({ message: 'Valid image URL is required' }, { status: 400 });
    }

    await mutateTrackerState(redis, tracker, ({ cards }) => {
      const numericCardId = typeof cardId === 'string' ? parseInt(cardId, 10) : cardId;
      const cardIndex = cards.findIndex((card) => card.id === numericCardId);

      if (cardIndex === -1) {
        throw new TrackerStoreError('Card not found', 404);
      }

      cards[cardIndex].image = imageUrl;
    });

    return NextResponse.json({ message: 'Image updated successfully' });
  } catch (error) {
    if (error instanceof TrackerStoreError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Error updating image:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

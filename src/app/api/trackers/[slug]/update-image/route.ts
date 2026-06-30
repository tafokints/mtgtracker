import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { requireAdmin } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/request-json';
import { getTrackerCards, saveTrackerCards } from '@/lib/tracker-data';

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

    const cards = await getTrackerCards(redis, tracker);
    const numericCardId = typeof cardId === 'string' ? parseInt(cardId, 10) : cardId;
    const cardIndex = cards.findIndex((card) => card.id === numericCardId);

    if (cardIndex === -1) {
      return NextResponse.json({ message: 'Card not found' }, { status: 404 });
    }

    cards[cardIndex].image = imageUrl;
    await saveTrackerCards(redis, tracker, cards);

    return NextResponse.json({ message: 'Image updated successfully' });
  } catch (error) {
    console.error('Error updating image:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

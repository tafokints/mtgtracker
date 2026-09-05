import { NextResponse } from 'next/server';
import { PriceHistoryEntry } from '@/lib/types';
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

    const { cardId, price } = body.value as { cardId?: unknown; price?: unknown };
    const priceValue = Number(price);

    if (!Number.isFinite(priceValue) || priceValue < 0) {
      return NextResponse.json({ message: 'Valid price is required' }, { status: 400 });
    }

    await mutateTrackerState(redis, tracker, ({ cards }) => {
      const numericCardId = typeof cardId === 'string' ? parseInt(cardId, 10) : cardId;
      const cardIndex = cards.findIndex((card) => card.id === numericCardId);

      if (cardIndex === -1) {
        throw new TrackerStoreError('Card not found', 404);
      }

      const currentDate = new Date().toISOString().split('T')[0];
      const historyEntry: PriceHistoryEntry = {
        price: priceValue,
        date: currentDate,
      };

      cards[cardIndex].priceHistory = [
        historyEntry,
        ...(cards[cardIndex].priceHistory || []),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      cards[cardIndex].price = priceValue;
      cards[cardIndex].priceDate = currentDate;

    });

    return NextResponse.json({ message: 'Price updated successfully' });
  } catch (error) {
    if (error instanceof TrackerStoreError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Error updating price:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

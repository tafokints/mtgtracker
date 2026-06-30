import { NextResponse } from 'next/server';
import { PriceHistoryEntry } from '@/lib/types';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { requireAdmin } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/request-json';
import { getTrackerCards, saveTrackerCards } from '@/lib/tracker-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const tracker = getTracker(params.slug);
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

    const cards = await getTrackerCards(redis, tracker);
    const numericCardId = typeof cardId === 'string' ? parseInt(cardId, 10) : cardId;
    const cardIndex = cards.findIndex((card) => card.id === numericCardId);

    if (cardIndex === -1) {
      return NextResponse.json({ message: 'Card not found' }, { status: 404 });
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

    await saveTrackerCards(redis, tracker, cards);

    return NextResponse.json({ message: 'Price updated successfully' });
  } catch (error) {
    console.error('Error updating price:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

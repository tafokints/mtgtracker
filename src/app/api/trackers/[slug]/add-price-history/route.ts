import { NextRequest, NextResponse } from 'next/server';
import { PriceHistoryEntry } from '@/lib/types';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { requireAdmin } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/request-json';
import { getTrackerCards, saveTrackerCards } from '@/lib/tracker-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const tracker = getTracker(params.slug);
  if (!tracker || tracker.status !== 'live') {
    return NextResponse.json({ error: 'Tracker not found' }, { status: 404 });
  }

  try {
    const redis = getRedis();
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;

    const { cardId, entry } = body.value as { cardId?: unknown; entry?: Partial<PriceHistoryEntry> };

    if (!cardId || !entry || entry.price === undefined || !entry.date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (typeof entry.price !== 'number' || entry.price < 0) {
      return NextResponse.json({ error: 'Invalid price value' }, { status: 400 });
    }

    if (typeof entry.date !== 'string' || Number.isNaN(new Date(entry.date).getTime())) {
      return NextResponse.json({ error: 'Invalid sale date' }, { status: 400 });
    }

    const historyEntry: PriceHistoryEntry = {
      price: entry.price,
      date: entry.date,
      soldBy: typeof entry.soldBy === 'string' && entry.soldBy.trim() ? entry.soldBy.trim() : undefined,
      soldTo: typeof entry.soldTo === 'string' && entry.soldTo.trim() ? entry.soldTo.trim() : undefined,
    };

    const cards = await getTrackerCards(redis, tracker);
    const numericCardId = typeof cardId === 'string' ? parseInt(cardId, 10) : cardId;
    const cardIndex = cards.findIndex((card) => card.id === numericCardId);

    if (cardIndex === -1) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    cards[cardIndex].priceHistory = [
      historyEntry,
      ...(cards[cardIndex].priceHistory || []),
    ].sort((a: PriceHistoryEntry, b: PriceHistoryEntry) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const latestEntry = cards[cardIndex].priceHistory[0];
    cards[cardIndex].price = latestEntry.price;
    cards[cardIndex].priceDate = latestEntry.date;

    await saveTrackerCards(redis, tracker, cards);

    return NextResponse.json({ success: true, card: cards[cardIndex] });
  } catch (error) {
    console.error('Error adding price history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

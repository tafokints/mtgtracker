import { NextRequest, NextResponse } from 'next/server';
import { PriceHistoryEntry } from '@/lib/types';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { requireAdmin } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/request-json';
import { mutateTrackerState, TrackerStoreError } from '@/lib/tracker-store';
import { isDateOnly, parseCardId } from '@/lib/admin-validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { slug } = await params;
  const tracker = getTracker(slug);
  if (!tracker || tracker.status !== 'live') {
    return NextResponse.json({ error: 'Tracker not found' }, { status: 404 });
  }

  try {
    const redis = getRedis();
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;

    const { cardId, entry } = body.value as { cardId?: unknown; entry?: Partial<PriceHistoryEntry> };
    const numericCardId = parseCardId(cardId);

    if (!numericCardId || !entry || entry.price === undefined || !entry.date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (typeof entry.price !== 'number' || !Number.isFinite(entry.price) || entry.price < 0) {
      return NextResponse.json({ error: 'Invalid price value' }, { status: 400 });
    }

    if (!isDateOnly(entry.date)) {
      return NextResponse.json({ error: 'Invalid sale date' }, { status: 400 });
    }
    if ([entry.soldBy, entry.soldTo].some((value) => value !== undefined && (typeof value !== 'string' || value.length > 120))) {
      return NextResponse.json({ error: 'Sale parties must be 120 characters or fewer' }, { status: 400 });
    }

    const historyEntry: PriceHistoryEntry = {
      price: entry.price,
      date: entry.date,
      soldBy: typeof entry.soldBy === 'string' && entry.soldBy.trim() ? entry.soldBy.trim() : undefined,
      soldTo: typeof entry.soldTo === 'string' && entry.soldTo.trim() ? entry.soldTo.trim() : undefined,
    };

    const card = await mutateTrackerState(redis, tracker, ({ cards }) => {
      const cardIndex = cards.findIndex((card) => card.id === numericCardId);

      if (cardIndex === -1) {
        throw new TrackerStoreError('Card not found', 404);
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

      return cards[cardIndex];
    });

    return NextResponse.json({ success: true, card });
  } catch (error) {
    if (error instanceof TrackerStoreError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error adding price history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

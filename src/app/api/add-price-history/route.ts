import { NextRequest, NextResponse } from 'next/server';
import { PriceHistoryEntry, SerializedRingCard } from '../../../lib/types';
import { getRedis } from '../../../lib/redis';
import { requireAdmin } from '../../../lib/admin-auth';

// Force dynamic rendering to prevent caching issues
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const redis = getRedis();
    const { cardId, entry } = await request.json();

    if (!cardId || !entry || entry.price === undefined || !entry.date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate price history entry
    if (typeof entry.price !== 'number' || entry.price < 0) {
      return NextResponse.json({ error: 'Invalid price value' }, { status: 400 });
    }

    const cards: SerializedRingCard[] = (await redis.get('one_ring_cards')) || [];

    // Find and update the specific card
    const numericCardId = typeof cardId === 'string' ? parseInt(cardId, 10) : cardId;
    const cardIndex = cards.findIndex((card) => card.id === numericCardId);
    if (cardIndex === -1) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Initialize priceHistory array if it doesn't exist
    if (!cards[cardIndex].priceHistory) {
      cards[cardIndex].priceHistory = [];
    }

    // Add the new price history entry
    cards[cardIndex].priceHistory.push(entry);

    // Sort price history by date (newest first)
    cards[cardIndex].priceHistory.sort((a: PriceHistoryEntry, b: PriceHistoryEntry) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Update the current price to the most recent entry
    if (cards[cardIndex].priceHistory.length > 0) {
      const latestEntry = cards[cardIndex].priceHistory[0];
      cards[cardIndex].price = latestEntry.price;
      cards[cardIndex].priceDate = latestEntry.date;
    }

    await redis.set('one_ring_cards', cards);

    return NextResponse.json({ success: true, card: cards[cardIndex] });
  } catch (error) {
    console.error('Error adding price history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 

import { NextResponse } from 'next/server';
import { DiscoverySubmission, SerializedRingCard } from '@/lib/types';
import { ONE_RING_CARDS_KEY, ONE_RING_SUBMISSIONS_KEY, initialSerializedRingCards, normalizeRingCard, withPendingReportCounts } from '@/lib/ring-data';
import { getRedis } from '@/lib/redis';

// Force dynamic rendering to prevent caching issues
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const redis = getRedis();
    let cards: SerializedRingCard[] = (await redis.get(ONE_RING_CARDS_KEY)) || [];
    
    if (cards.length === 0) {
      const oldCardsData = await redis.get('one-ring-cards');
      const oldCards = Array.isArray(oldCardsData) ? oldCardsData : [];
      
      if (oldCards.length > 0) {
        cards = oldCards.map((card: any) => normalizeRingCard(card));
        await redis.set(ONE_RING_CARDS_KEY, cards);
        await redis.del('one-ring-cards');
      } else {
        cards = initialSerializedRingCards;
        await redis.set(ONE_RING_CARDS_KEY, cards);
      }
    } else {
      cards = cards.map(card => normalizeRingCard(card));
    }

    const submissions: DiscoverySubmission[] = (await redis.get(ONE_RING_SUBMISSIONS_KEY)) || [];

    return NextResponse.json(withPendingReportCounts(cards, submissions));
  } catch (error) {
    console.error('Error fetching cards:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
} 

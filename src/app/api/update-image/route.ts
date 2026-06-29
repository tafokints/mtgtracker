import { NextResponse } from 'next/server';
import { SerializedRingCard } from '@/lib/types';
import { getRedis } from '@/lib/redis';

// Force dynamic rendering to prevent caching issues
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const redis = getRedis();
    const { cardId, imageUrl } = await request.json();
    const cards: SerializedRingCard[] = (await redis.get('one_ring_cards')) || [];

    const cardIndex = cards.findIndex(c => c.id === parseInt(cardId));

    if (cardIndex === -1) {
      return NextResponse.json({ message: 'Card not found' }, { status: 404 });
    }

    cards[cardIndex] = {
      ...cards[cardIndex],
      image: imageUrl,
    };

    await redis.set('one_ring_cards', cards);

    return NextResponse.json({ message: 'Image updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error updating image:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
} 

import { NextRequest, NextResponse } from 'next/server';
import { GradingInfo, SerializedRingCard } from '../../../lib/types';
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
    const { cardId, grading } = await request.json();

    if (!cardId || !grading || !grading.service || grading.grade === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Convert grade to number and validate
    const gradeValue = typeof grading.grade === 'string' ? parseFloat(grading.grade) : grading.grade;
    if (isNaN(gradeValue) || gradeValue < 0) {
      return NextResponse.json({ error: 'Invalid grade value' }, { status: 400 });
    }

    // Update the grading object with the numeric grade
    const validatedGrading = {
      ...grading,
      grade: gradeValue
    };

    const cards: SerializedRingCard[] = (await redis.get('one_ring_cards')) || [];

    const numericCardId = typeof cardId === 'string' ? parseInt(cardId, 10) : cardId;
    const cardIndex = cards.findIndex((card) => card.id === numericCardId);
    if (cardIndex === -1) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    cards[cardIndex].grading = validatedGrading;
    cards[cardIndex].found = true;
    cards[cardIndex].verificationStatus = 'confirmed';

    await redis.set('one_ring_cards', cards);

    return NextResponse.json({ success: true, card: cards[cardIndex] });
  } catch (error) {
    console.error('Error updating grading:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 

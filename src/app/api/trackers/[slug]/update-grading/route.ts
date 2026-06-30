import { NextRequest, NextResponse } from 'next/server';
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

    const { cardId, grading } = body.value as { cardId?: unknown; grading?: any };

    if (!cardId || !grading || !grading.service || grading.grade === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const gradeValue = typeof grading.grade === 'string' ? parseFloat(grading.grade) : grading.grade;
    if (isNaN(gradeValue) || gradeValue < 0) {
      return NextResponse.json({ error: 'Invalid grade value' }, { status: 400 });
    }

    const cards = await getTrackerCards(redis, tracker);
    const numericCardId = typeof cardId === 'string' ? parseInt(cardId, 10) : cardId;
    const cardIndex = cards.findIndex((card) => card.id === numericCardId);

    if (cardIndex === -1) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    cards[cardIndex].grading = {
      ...grading,
      grade: gradeValue,
    };
    cards[cardIndex].found = true;
    cards[cardIndex].verificationStatus = 'confirmed';

    await saveTrackerCards(redis, tracker, cards);

    return NextResponse.json({ success: true, card: cards[cardIndex] });
  } catch (error) {
    console.error('Error updating grading:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

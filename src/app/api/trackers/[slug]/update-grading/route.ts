import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { requireAdmin } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/request-json';
import { mutateTrackerState, TrackerStoreError } from '@/lib/tracker-store';
import { isDateOnly, parseCardId, parseNonNegativeNumber } from '@/lib/admin-validation';

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

    const { cardId, grading } = body.value as { cardId?: unknown; grading?: Record<string, unknown> };
    const numericCardId = parseCardId(cardId);

    if (!numericCardId || !grading || Array.isArray(grading) || typeof grading.service !== 'string' || !grading.service.trim() || grading.service.length > 80) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const gradeValue = parseNonNegativeNumber(grading.grade);
    if (gradeValue === undefined || gradeValue > 10) {
      return NextResponse.json({ error: 'Invalid grade value' }, { status: 400 });
    }

    if (grading.dateGraded && !isDateOnly(grading.dateGraded)) return NextResponse.json({ error: 'Invalid grading date' }, { status: 400 });

    const card = await mutateTrackerState(redis, tracker, ({ cards }) => {
      const cardIndex = cards.findIndex((card) => card.id === numericCardId);

      if (cardIndex === -1) {
        throw new TrackerStoreError('Card not found', 404);
      }

      cards[cardIndex].grading = {
        service: grading.service as string,
        grade: gradeValue,
        dateGraded: typeof grading.dateGraded === 'string' ? grading.dateGraded : undefined,
      };
      cards[cardIndex].found = true;
      cards[cardIndex].verificationStatus = 'confirmed';

      return cards[cardIndex];
    });

    return NextResponse.json({ success: true, card });
  } catch (error) {
    if (error instanceof TrackerStoreError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error updating grading:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { appendCardEvent } from '@/lib/card-history';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { requireAdmin } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/request-json';
import { mutateTrackerState, TrackerStoreError } from '@/lib/tracker-store';
import { parseCardId } from '@/lib/admin-validation';
import { evidenceIdFromUrl } from '@/lib/evidence-policy';

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

    const { cardId, imageUrl } = body.value as { cardId?: unknown; imageUrl?: unknown };

    const numericCardId = parseCardId(cardId);
    if (!numericCardId) return NextResponse.json({ message: 'Valid card ID is required' }, { status: 400 });
    if (!evidenceIdFromUrl(imageUrl)) {
      return NextResponse.json({ message: 'Choose approved uploaded evidence for this card' }, { status: 400 });
    }

    const id = randomUUID();
    const recordedAt = new Date().toISOString();
    await mutateTrackerState(redis, tracker, ({ cards, submissions }) => {
      const cardIndex = cards.findIndex((card) => card.id === numericCardId);

      if (cardIndex === -1) {
        throw new TrackerStoreError('Card not found', 404);
      }

      const image = cards[cardIndex].evidenceImages?.find((image) => image.url === imageUrl);
      if (!image) throw new TrackerStoreError('Image must already be approved evidence for this card', 409);
      const report = submissions.find((report) => report.id === image.sourceSubmissionId);
      const approvalId = report?.status === 'duplicate' ? report.duplicateOf : report?.id;
      if (!approvalId) throw new TrackerStoreError('Evidence approval is unavailable', 409);
      appendCardEvent(cards[cardIndex], { id, kind: 'image', recordedAt, sourceSubmissionId: approvalId, facts: { image: imageUrl as string } });
    });

    return NextResponse.json({ message: 'Image updated successfully' });
  } catch (error) {
    if (error instanceof TrackerStoreError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Error updating image:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

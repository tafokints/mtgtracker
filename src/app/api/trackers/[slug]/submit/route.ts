import { NextResponse } from 'next/server';
import { DiscoverySubmission } from '@/lib/types';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { readJsonBody } from '@/lib/request-json';
import { validateDiscoverySubmission } from '@/lib/submission-validation';
import { formatTrackerSerial, getTrackerTotalSlots } from '@/lib/tracker-data';
import { mutateTrackerState, TrackerStoreError } from '@/lib/tracker-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const tracker = getTracker(slug);

  if (!tracker || tracker.status !== 'live') {
    return NextResponse.json({ message: 'Tracker not found' }, { status: 404 });
  }

  try {
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;

    const validation = validateDiscoverySubmission(body.value, getTrackerTotalSlots(tracker));

    if (validation.errors.length > 0) {
      return NextResponse.json({ message: 'Submission validation failed', errors: validation.errors }, { status: 400 });
    }

    const redis = getRedis();
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimit(redis, {
      key: `rate-limit:${tracker.slug}:submit:${clientIp}`,
      limit: 5,
      windowSeconds: 60 * 60,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: 'Too many submissions. Please try again later.' },
        { status: 429 }
      );
    }

    const input = validation.value;
    const submissionId = crypto.randomUUID();
    const submittedAt = new Date().toISOString();
    await mutateTrackerState(redis, tracker, (state) => {
      const { cards, submissions } = state;
      const card = cards.find((item) => item.id === input.cardId);

      if (!card) {
        throw new TrackerStoreError('Card not found', 404);
      }

      const duplicateCandidates = submissions.filter((existingSubmission) => (
        existingSubmission.cardId === input.cardId &&
        !['rejected', 'cannot-verify'].includes(existingSubmission.status)
      ));

      const submission: DiscoverySubmission = {
        id: submissionId,
        cardId: input.cardId,
        cardSlug: card.cardSlug,
        cardTitle: card.cardTitle,
        serialTotal: card.serialTotal,
        serialNumber: card.serialNumber || formatTrackerSerial(tracker, input.cardId),
        foundBy: input.foundBy,
        dateFound: input.dateFound,
        link: input.link,
        sourceType: input.sourceType,
        requestedVerificationStatus: input.verificationStatus,
        price: input.price,
        imageUrl: input.imageUrl,
        evidenceImages: input.evidenceImages,
        notes: input.notes,
        status: 'pending',
        submittedAt,
        duplicateOf: duplicateCandidates[0]?.id,
        duplicateSubmissionIds: duplicateCandidates.map((candidate) => candidate.id),
      };

      state.submissions = [submission, ...submissions];
    });

    return NextResponse.json(
      {
        message: 'Submission queued for review',
        submissionId,
        remaining: rateLimit.remaining,
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof TrackerStoreError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Error queueing submission:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

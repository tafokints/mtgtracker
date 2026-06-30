import { NextResponse } from 'next/server';
import { DiscoverySubmission } from '@/lib/types';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { readJsonBody } from '@/lib/request-json';
import { validateDiscoverySubmission } from '@/lib/submission-validation';
import { formatTrackerSerial, getTrackerCards, getTrackerSubmissions, saveTrackerSubmissions } from '@/lib/tracker-data';

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

    const validation = validateDiscoverySubmission(body.value, tracker.total);

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
    const cards = await getTrackerCards(redis, tracker);
    const card = cards.find((item) => item.id === input.cardId);

    if (!card) {
      return NextResponse.json({ message: 'Card not found' }, { status: 404 });
    }

    const submission: DiscoverySubmission = {
      id: crypto.randomUUID(),
      cardId: input.cardId,
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
      submittedAt: new Date().toISOString(),
    };

    const submissions = await getTrackerSubmissions(redis, tracker);
    await saveTrackerSubmissions(redis, tracker, [submission, ...submissions]);

    return NextResponse.json(
      {
        message: 'Submission queued for review',
        submissionId: submission.id,
        remaining: rateLimit.remaining,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('Error queueing submission:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

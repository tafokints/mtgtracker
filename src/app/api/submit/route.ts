import { NextResponse } from 'next/server';
import { DiscoverySubmission, SerializedRingCard } from '@/lib/types';
import { getRedis } from '@/lib/redis';
import { formatSerial, ONE_RING_CARDS_KEY, ONE_RING_SUBMISSIONS_KEY, TOTAL_RING_CARDS } from '@/lib/ring-data';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { validateDiscoverySubmission } from '@/lib/submission-validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = validateDiscoverySubmission(body, TOTAL_RING_CARDS);

    if (validation.errors.length > 0) {
      return NextResponse.json({ message: 'Submission validation failed', errors: validation.errors }, { status: 400 });
    }

    const redis = getRedis();
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimit(redis, {
      key: `rate-limit:one-ring-submit:${clientIp}`,
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
    const cards: SerializedRingCard[] = (await redis.get(ONE_RING_CARDS_KEY)) || [];
    const card = cards.find((item) => item.id === input.cardId);

    if (cards.length > 0 && !card) {
      return NextResponse.json({ message: 'Card not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const submission: DiscoverySubmission = {
      id: crypto.randomUUID(),
      cardId: input.cardId,
      serialNumber: card?.serialNumber || formatSerial(input.cardId),
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
      submittedAt: now,
    };

    const submissions: DiscoverySubmission[] = (await redis.get(ONE_RING_SUBMISSIONS_KEY)) || [];
    await redis.set(ONE_RING_SUBMISSIONS_KEY, [submission, ...submissions]);

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

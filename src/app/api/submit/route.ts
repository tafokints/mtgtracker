import { NextResponse } from 'next/server';
import { DiscoverySubmission, EvidenceImage, SerializedRingCard } from '@/lib/types';
import { getRedis } from '@/lib/redis';
import { formatSerial, ONE_RING_CARDS_KEY, ONE_RING_SUBMISSIONS_KEY } from '@/lib/ring-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseEvidenceImages(rawValue: unknown, primaryImageUrl?: string): EvidenceImage[] {
  const values = Array.isArray(rawValue)
    ? rawValue
    : typeof rawValue === 'string'
      ? rawValue.split(/\r?\n|,/)
      : [];

  const urls = [
    primaryImageUrl,
    ...values.map((value) => typeof value === 'string' ? value.trim() : ''),
  ].filter(Boolean) as string[];

  return Array.from(new Set(urls)).map((url) => ({ url }));
}

export async function POST(request: Request) {
  try {
    const redis = getRedis();
    const body = await request.json();
    const cardId = parseInt(body.cardId, 10);

    if (!cardId || cardId < 1 || cardId > 100) {
      return NextResponse.json({ message: 'Valid serial number is required' }, { status: 400 });
    }

    const cards: SerializedRingCard[] = (await redis.get(ONE_RING_CARDS_KEY)) || [];
    const card = cards.find((item) => item.id === cardId);

    if (cards.length > 0 && !card) {
      return NextResponse.json({ message: 'Card not found' }, { status: 404 });
    }

    const submittedPrice = parseFloat(body.price);
    const now = new Date().toISOString();
    const submission: DiscoverySubmission = {
      id: crypto.randomUUID(),
      cardId,
      serialNumber: card?.serialNumber || formatSerial(cardId),
      foundBy: body.foundBy || undefined,
      dateFound: body.dateFound || undefined,
      link: body.link || undefined,
      sourceType: body.sourceType || 'other',
      requestedVerificationStatus: body.verificationStatus || 'source-linked',
      price: !isNaN(submittedPrice) && submittedPrice >= 0 ? submittedPrice : undefined,
      imageUrl: body.imageUrl || undefined,
      evidenceImages: parseEvidenceImages(body.evidenceImageUrls, body.imageUrl),
      notes: body.notes || undefined,
      status: 'pending',
      submittedAt: now,
    };

    const submissions: DiscoverySubmission[] = (await redis.get(ONE_RING_SUBMISSIONS_KEY)) || [];
    await redis.set(ONE_RING_SUBMISSIONS_KEY, [submission, ...submissions]);

    return NextResponse.json({ message: 'Submission queued for review', submissionId: submission.id }, { status: 202 });
  } catch (error) {
    console.error('Error queueing submission:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

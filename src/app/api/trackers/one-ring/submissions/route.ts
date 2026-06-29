import { NextRequest, NextResponse } from 'next/server';
import { DiscoverySubmission, PriceHistoryEntry, SerializedRingCard, VerificationStatus } from '@/lib/types';
import { getRedis } from '@/lib/redis';
import { initialSerializedRingCards, normalizeRingCard, ONE_RING_CARDS_KEY, ONE_RING_SUBMISSIONS_KEY } from '@/lib/ring-data';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function sortSubmissions(submissions: DiscoverySubmission[]) {
  return [...submissions].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

async function getCards() {
  const redis = getRedis();
  const cards: SerializedRingCard[] = (await redis.get(ONE_RING_CARDS_KEY)) || [];
  return cards.length > 0 ? cards.map((card) => normalizeRingCard(card)) : initialSerializedRingCards;
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const redis = getRedis();
    const status = request.nextUrl.searchParams.get('status');
    const submissions: DiscoverySubmission[] = (await redis.get(ONE_RING_SUBMISSIONS_KEY)) || [];

    const filteredSubmissions = status
      ? submissions.filter((submission) => submission.status === status)
      : submissions;

    return NextResponse.json(sortSubmissions(filteredSubmissions));
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const redis = getRedis();
    const body = await request.json();
    const { submissionId, action } = body;

    if (!submissionId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ message: 'Submission id and valid action are required' }, { status: 400 });
    }

    const submissions: DiscoverySubmission[] = (await redis.get(ONE_RING_SUBMISSIONS_KEY)) || [];
    const submissionIndex = submissions.findIndex((submission) => submission.id === submissionId);

    if (submissionIndex === -1) {
      return NextResponse.json({ message: 'Submission not found' }, { status: 404 });
    }

    const submission = submissions[submissionIndex];
    if (submission.status !== 'pending') {
      return NextResponse.json({ message: 'Submission has already been reviewed' }, { status: 409 });
    }

    const reviewedSubmission: DiscoverySubmission = {
      ...submission,
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewedBy: body.reviewedBy || 'admin',
      reviewNotes: body.reviewNotes || undefined,
    };

    submissions[submissionIndex] = reviewedSubmission;

    if (action === 'approve') {
      const cards = await getCards();
      const cardIndex = cards.findIndex((card) => card.id === submission.cardId);

      if (cardIndex === -1) {
        return NextResponse.json({ message: 'Card not found' }, { status: 404 });
      }

      const selectedImageUrl =
        body.imageUrl ||
        submission.imageUrl ||
        submission.evidenceImages?.[0]?.url ||
        cards[cardIndex].image;

      const verificationStatus: VerificationStatus = body.verificationStatus || submission.requestedVerificationStatus || 'source-linked';

      cards[cardIndex] = {
        ...cards[cardIndex],
        found: true,
        foundBy: submission.foundBy,
        dateFound: submission.dateFound,
        link: submission.link,
        sourceType: submission.sourceType,
        verificationStatus,
        notes: [submission.notes, body.reviewNotes].filter(Boolean).join('\n\n') || undefined,
        image: selectedImageUrl,
      };

      if (submission.price !== undefined) {
        const priceEntry: PriceHistoryEntry = {
          price: submission.price,
          date: submission.dateFound || new Date().toISOString().split('T')[0],
          soldBy: submission.foundBy,
        };

        cards[cardIndex].price = submission.price;
        cards[cardIndex].priceDate = priceEntry.date;
        cards[cardIndex].priceHistory = [
          priceEntry,
          ...(cards[cardIndex].priceHistory || []),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }

      await redis.set(ONE_RING_CARDS_KEY, cards);
    }

    await redis.set(ONE_RING_SUBMISSIONS_KEY, submissions);

    return NextResponse.json({ success: true, submission: reviewedSubmission });
  } catch (error) {
    console.error('Error reviewing submission:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

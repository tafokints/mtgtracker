import { NextRequest, NextResponse } from 'next/server';
import { DiscoverySubmission, VerificationStatus } from '@/lib/types';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { requireAdmin } from '@/lib/admin-auth';
import {
  applyApprovedSubmission,
  getTrackerCards,
  getTrackerSubmissions,
  saveTrackerCards,
  saveTrackerSubmissions,
  sortSubmissions,
} from '@/lib/tracker-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const tracker = getTracker(params.slug);
  if (!tracker || tracker.status !== 'live') {
    return NextResponse.json({ message: 'Tracker not found' }, { status: 404 });
  }

  try {
    const redis = getRedis();
    const status = request.nextUrl.searchParams.get('status');
    const submissions = await getTrackerSubmissions(redis, tracker);

    const filteredSubmissions = status
      ? submissions.filter((submission) => submission.status === status)
      : submissions;

    return NextResponse.json(sortSubmissions(filteredSubmissions));
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const tracker = getTracker(params.slug);
  if (!tracker || tracker.status !== 'live') {
    return NextResponse.json({ message: 'Tracker not found' }, { status: 404 });
  }

  try {
    const redis = getRedis();
    const body = await request.json();
    const { submissionId, action } = body;

    if (!submissionId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ message: 'Submission id and valid action are required' }, { status: 400 });
    }

    const submissions = await getTrackerSubmissions(redis, tracker);
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
      const cards = await getTrackerCards(redis, tracker);
      const applied = applyApprovedSubmission(tracker, cards, submission, {
        imageUrl: body.imageUrl,
        verificationStatus: body.verificationStatus as VerificationStatus | undefined,
        reviewNotes: body.reviewNotes,
      });

      if (!applied) {
        return NextResponse.json({ message: 'Card not found' }, { status: 404 });
      }

      await saveTrackerCards(redis, tracker, cards);
    }

    await saveTrackerSubmissions(redis, tracker, submissions);

    return NextResponse.json({ success: true, submission: reviewedSubmission });
  } catch (error) {
    console.error('Error reviewing submission:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { DiscoverySubmission, SubmissionStatus, VerificationStatus } from '@/lib/types';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { requireAdmin } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/request-json';
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

const VERIFICATION_STATUSES: VerificationStatus[] = ['unverified', 'source-linked', 'confirmed'];
const REVIEW_ACTION_TO_STATUS = {
  approve: 'approved',
  reject: 'rejected',
  'needs-more-info': 'needs-more-info',
  duplicate: 'duplicate',
  'cannot-verify': 'cannot-verify',
} as const satisfies Record<string, SubmissionStatus>;

type ReviewAction = keyof typeof REVIEW_ACTION_TO_STATUS;

function isReviewAction(action: unknown): action is ReviewAction {
  return typeof action === 'string' && action in REVIEW_ACTION_TO_STATUS;
}

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { slug } = await params;
  const tracker = getTracker(slug);
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

export async function POST(request: NextRequest, { params }: RouteContext) {
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

    const input = body.value as {
      submissionId?: unknown;
      action?: unknown;
      reviewedBy?: unknown;
      reviewNotes?: unknown;
      imageUrl?: unknown;
      verificationStatus?: unknown;
    };
    const { submissionId, action } = input;

    if (typeof submissionId !== 'string' || !isReviewAction(action)) {
      return NextResponse.json({ message: 'Submission id and valid action are required' }, { status: 400 });
    }

    const verificationStatus =
      typeof input.verificationStatus === 'string' && VERIFICATION_STATUSES.includes(input.verificationStatus as VerificationStatus)
        ? input.verificationStatus as VerificationStatus
        : undefined;

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
      status: REVIEW_ACTION_TO_STATUS[action],
      reviewedAt: new Date().toISOString(),
      reviewedBy: typeof input.reviewedBy === 'string' && input.reviewedBy.trim() ? input.reviewedBy.trim() : 'admin',
      reviewNotes: typeof input.reviewNotes === 'string' && input.reviewNotes.trim() ? input.reviewNotes.trim() : undefined,
    };

    submissions[submissionIndex] = reviewedSubmission;

    if (action === 'approve') {
      const cards = await getTrackerCards(redis, tracker);
      const applied = applyApprovedSubmission(tracker, cards, submission, {
        imageUrl: typeof input.imageUrl === 'string' ? input.imageUrl : undefined,
        verificationStatus,
        reviewNotes: typeof input.reviewNotes === 'string' ? input.reviewNotes : undefined,
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

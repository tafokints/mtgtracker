import { NextRequest, NextResponse } from 'next/server';
import { DiscoverySubmission, SubmissionStatus, VerificationStatus } from '@/lib/types';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { requireAdmin } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/request-json';
import { isSafeImageUrl } from '@/lib/admin-validation';
import {
  applyApprovedSubmission,
  getTrackerSubmissions,
  sortSubmissions,
} from '@/lib/tracker-data';
import { mutateTrackerState, TrackerStoreError } from '@/lib/tracker-store';

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
  return typeof action === 'string' && Object.hasOwn(REVIEW_ACTION_TO_STATUS, action);
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
      mergeSubmissionIds?: unknown;
    };
    const { submissionId, action } = input;

    if (typeof submissionId !== 'string' || !submissionId.trim() || submissionId.length > 200 || !isReviewAction(action)) {
      return NextResponse.json({ message: 'Submission id and valid action are required' }, { status: 400 });
    }

    if (
      (input.reviewedBy !== undefined && (typeof input.reviewedBy !== 'string' || input.reviewedBy.length > 120)) ||
      (input.reviewNotes !== undefined && (typeof input.reviewNotes !== 'string' || input.reviewNotes.length > 5000)) ||
      (input.imageUrl !== undefined && !isSafeImageUrl(input.imageUrl)) ||
      (input.verificationStatus !== undefined && !VERIFICATION_STATUSES.includes(input.verificationStatus as VerificationStatus)) ||
      (input.mergeSubmissionIds !== undefined && (
        !Array.isArray(input.mergeSubmissionIds) || input.mergeSubmissionIds.length > 100 ||
        input.mergeSubmissionIds.some((id) => typeof id !== 'string' || !id.trim() || id.length > 200)
      ))
    ) {
      return NextResponse.json({ message: 'Invalid review details' }, { status: 400 });
    }

    const verificationStatus =
      typeof input.verificationStatus === 'string' && VERIFICATION_STATUSES.includes(input.verificationStatus as VerificationStatus)
        ? input.verificationStatus as VerificationStatus
        : undefined;
    const mergeSubmissionIds = Array.isArray(input.mergeSubmissionIds)
      ? input.mergeSubmissionIds.filter((id): id is string => typeof id === 'string')
      : [];

    const reviewedSubmission = await mutateTrackerState(redis, tracker, ({ cards, submissions }) => {
      const submissionIndex = submissions.findIndex((submission) => submission.id === submissionId);

      if (submissionIndex === -1) {
        throw new TrackerStoreError('Submission not found', 404);
      }

      const submission = submissions[submissionIndex];
      if (submission.status !== 'pending') {
        throw new TrackerStoreError('Submission has already been reviewed', 409);
      }

      const reviewedAt = new Date().toISOString();
      const reviewedBy = typeof input.reviewedBy === 'string' && input.reviewedBy.trim() ? input.reviewedBy.trim() : 'admin';
      const reviewNotes = typeof input.reviewNotes === 'string' && input.reviewNotes.trim() ? input.reviewNotes.trim() : undefined;

      const reviewedSubmission: DiscoverySubmission = {
        ...submission,
        status: REVIEW_ACTION_TO_STATUS[action],
        reviewedAt,
        reviewedBy,
        reviewNotes,
      };

      submissions[submissionIndex] = reviewedSubmission;

      if (action === 'approve') {
        const mergedEvidenceSubmissions = submissions.filter((candidate) => (
          mergeSubmissionIds.includes(candidate.id) &&
          candidate.id !== submission.id &&
          candidate.cardId === submission.cardId &&
          candidate.status === 'pending'
        ));
        const applied = applyApprovedSubmission(tracker, cards, submission, {
          imageUrl: typeof input.imageUrl === 'string' ? input.imageUrl : undefined,
          verificationStatus,
          reviewNotes,
          mergedEvidenceSubmissions,
        });

        if (!applied) {
          throw new TrackerStoreError('Card not found', 404);
        }

        for (const mergedSubmission of mergedEvidenceSubmissions) {
          const mergedSubmissionIndex = submissions.findIndex((candidate) => candidate.id === mergedSubmission.id);
          if (mergedSubmissionIndex === -1) continue;

          submissions[mergedSubmissionIndex] = {
            ...mergedSubmission,
            status: 'duplicate',
            duplicateOf: submission.id,
            reviewedAt,
            reviewedBy,
            reviewNotes: [`Merged evidence into ${submission.id}.`, mergedSubmission.reviewNotes].filter(Boolean).join('\n\n'),
          };
        }

      }

      return reviewedSubmission;
    });

    return NextResponse.json({ success: true, submission: reviewedSubmission });
  } catch (error) {
    if (error instanceof TrackerStoreError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Error reviewing submission:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { DISCOVERY_EVIDENCE_REQUIRED, getSubmissionSourceUrls, hasSubmissionEvidence } from '@/lib/submission-review';
import { retractReportEvents } from '@/lib/card-history';
import { DiscoverySubmission, SubmissionStatus, VerificationStatus } from '@/lib/types';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { getAdminPrincipal, requireAdmin } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/request-json';
import { evidenceIdFromUrl } from '@/lib/evidence-policy';
import { assertReportEvidenceClean, evidenceKey, type EvidenceAsset } from '@/lib/evidence-store';
import { checkSourceReputation } from '@/lib/evidence-scanning';
import { EvidenceUploadError } from '@/lib/evidence-upload';
import {
  applyApprovedSubmission,
  getTrackerSubmissions,
  sortSubmissions,
} from '@/lib/tracker-data';
import { getTrackerState, mutateTrackerState, TrackerStoreError } from '@/lib/tracker-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

const VERIFICATION_STATUSES: VerificationStatus[] = ['unverified', 'source-linked', 'confirmed'];
const REVIEW_ACTION_TO_STATUS = {
  approve: 'approved',
  reject: 'rejected',
  'needs-more-info': 'needs-more-info',
  duplicate: 'duplicate',
  'cannot-verify': 'cannot-verify',
  reopen: 'pending',
  revoke: 'revoked',
} as const satisfies Record<string, SubmissionStatus>;

type ReviewAction = keyof typeof REVIEW_ACTION_TO_STATUS;

function isReviewAction(action: unknown): action is ReviewAction {
  return typeof action === 'string' && Object.hasOwn(REVIEW_ACTION_TO_STATUS, action);
}

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const unauthorized = await requireAdmin(request);
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

    const results = [];
    for (const submission of sortSubmissions(filteredSubmissions)) {
      const evidenceSafety = [];
      for (const image of submission.evidenceImages || []) {
        const id = evidenceIdFromUrl(image.url);
        const asset = id ? await redis.get<EvidenceAsset>(evidenceKey(id)) : null;
        evidenceSafety.push({ url: image.url, status: asset?.scan.status || 'pending', reason: asset?.scan.reason || 'legacy-evidence-requires-upload' });
      }
      results.push({ ...submission, evidenceSafety });
    }
    return NextResponse.json(results, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const unauthorized = await requireAdmin(request);
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
      applyCorrection?: unknown;
    };
    const { submissionId, action } = input;
    const reviewId = randomUUID();
    const actorId = (await getAdminPrincipal(request))!.id;
    const reviewedAt = new Date().toISOString();

    if (typeof submissionId !== 'string' || !submissionId.trim() || submissionId.length > 200 || !isReviewAction(action)) {
      return NextResponse.json({ message: 'Submission id and valid action are required' }, { status: 400 });
    }

    if (
      (input.reviewedBy !== undefined && (typeof input.reviewedBy !== 'string' || input.reviewedBy.length > 120)) ||
      (input.reviewNotes !== undefined && (typeof input.reviewNotes !== 'string' || input.reviewNotes.length > 5000)) ||
      (input.imageUrl !== undefined && !evidenceIdFromUrl(input.imageUrl)) ||
      (input.applyCorrection !== undefined && typeof input.applyCorrection !== 'boolean') ||
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

    const checkedReports = new Map<string, string>();
    if (['needs-more-info', 'reopen', 'revoke'].includes(action) && (typeof input.reviewNotes !== 'string' || !input.reviewNotes.trim())) return NextResponse.json({ message: 'A reason or information request is required' }, { status: 400 });
    if (action === 'approve') {
      if (mergeSubmissionIds.length > 8) return NextResponse.json({ message: 'Merge no more than eight reports at once' }, { status: 400 });
      const snapshot = await getTrackerState(redis, tracker);
      const primary = snapshot.submissions.find((report) => report.id === submissionId);
      if (!primary) return NextResponse.json({ message: 'Submission not found' }, { status: 404 });
      if (primary.status !== 'pending') return NextResponse.json({ message: 'Submission has already been reviewed' }, { status: 409 });
      const reports = [primary, ...snapshot.submissions.filter((report) => report.id !== primary.id && mergeSubmissionIds.includes(report.id) && report.cardId === primary.cardId && report.status === 'pending')];
      if (new Set(mergeSubmissionIds).size !== mergeSubmissionIds.length || reports.length !== mergeSubmissionIds.length + 1) return NextResponse.json({ message: 'Every merged report must still be pending for this copy' }, { status: 409 });
      if (reports.slice(1).some((report) => report.kind === 'correction')) return NextResponse.json({ message: 'Review corrections separately instead of merging them', }, { status: 409 });
      if (primary.kind === 'correction' && input.applyCorrection !== true) return NextResponse.json({ message: 'Explicitly confirm replacement of the supplied facts for this correction' }, { status: 400 });
      const allowedImages: string[] = [];
      const checkedLinks = new Set<string>();
      for (const report of reports) {
        allowedImages.push(...await assertReportEvidenceClean(redis, slug, report));
        for (const link of getSubmissionSourceUrls(report)) {
          if (link && !checkedLinks.has(link)) {
            await checkSourceReputation(link);
            checkedLinks.add(link);
          }
        }
        checkedReports.set(report.id, JSON.stringify(report));
      }
      if (input.imageUrl && !allowedImages.includes(input.imageUrl as string)) return NextResponse.json({ message: 'Choose an image attached to these reports' }, { status: 400 });
    }

    const reviewedSubmission = await mutateTrackerState(redis, tracker, ({ cards, submissions }) => {
      const submissionIndex = submissions.findIndex((submission) => submission.id === submissionId);

      if (submissionIndex === -1) {
        throw new TrackerStoreError('Submission not found', 404);
      }

      const submission = submissions[submissionIndex];
      if (action === 'reopen' && submission.status === 'duplicate' && submissions.some((report) => report.id === submission.duplicateOf && report.status === 'approved')) throw new TrackerStoreError('Retract the parent approval before reopening its merged report', 409);
      const reopening = action === 'reopen' && ['needs-more-info', 'rejected', 'cannot-verify', 'revoked', 'duplicate'].includes(submission.status);
      const revoking = action === 'revoke' && submission.status === 'approved';
      if ((action === 'reopen' && !reopening) || (action === 'revoke' && !revoking) || (!reopening && !revoking && submission.status !== 'pending')) {
        throw new TrackerStoreError('Submission has already been reviewed', 409);
      }

      const reviewedBy = actorId;
      const reviewNotes = typeof input.reviewNotes === 'string' && input.reviewNotes.trim() ? input.reviewNotes.trim() : undefined;

      const reviewedSubmission: DiscoverySubmission = {
        ...submission,
        status: REVIEW_ACTION_TO_STATUS[action],
        reviewedAt,
        reviewedBy,
        reviewNotes,
        duplicateOf: reopening ? undefined : submission.duplicateOf,
        reviewHistory: [...(submission.reviewHistory || []), { id: reviewId, action, at: reviewedAt, actor: 'admin', actorId, notes: reviewNotes }],
      };

      submissions[submissionIndex] = reviewedSubmission;

      if (revoking) {
        const card = cards.find((candidate) => candidate.id === submission.cardId);
        if (!card) throw new TrackerStoreError('Card not found', 404);
        try { retractReportEvents(card, submission.id, reviewId, reviewedAt); }
        catch (error) { throw new TrackerStoreError((error as Error).message, 409); }
      }

      if (action === 'approve') {
        const mergedEvidenceSubmissions = submissions.filter((candidate) => (
          mergeSubmissionIds.includes(candidate.id) &&
          candidate.id !== submission.id &&
          candidate.cardId === submission.cardId &&
          candidate.status === 'pending'
        ));
        if (mergedEvidenceSubmissions.length !== mergeSubmissionIds.length) throw new TrackerStoreError('A merged report changed during review. Please retry.', 409);
        for (const candidate of [submission, ...mergedEvidenceSubmissions]) {
          if (checkedReports.get(candidate.id) !== JSON.stringify(candidate)) throw new TrackerStoreError('Report changed during safety checks. Please retry.', 409);
        }
        const card = cards.find((candidate) => candidate.id === submission.cardId);
        if (!card) throw new TrackerStoreError('Card not found', 404);
        if (!card.found && ![submission, ...mergedEvidenceSubmissions].some(hasSubmissionEvidence)) {
          throw new TrackerStoreError(DISCOVERY_EVIDENCE_REQUIRED, 409);
        }
        const applied = applyApprovedSubmission(tracker, cards, reviewedSubmission, {
          imageUrl: typeof input.imageUrl === 'string' ? input.imageUrl : undefined,
          verificationStatus,
          reviewNotes,
          mergedEvidenceSubmissions,
          applyCorrection: input.applyCorrection === true,
          eventId: reviewId,
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
            reviewHistory: [...(mergedSubmission.reviewHistory || []), { id: `${reviewId}:${mergedSubmission.id}`, action: 'merge', at: reviewedAt, actor: 'admin', actorId, notes: `Merged into ${submission.id}` }],
          };
        }

      }

      return reviewedSubmission;
    });

    return NextResponse.json({ success: true, submission: reviewedSubmission });
  } catch (error) {
    if (error instanceof TrackerStoreError || error instanceof EvidenceUploadError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Error reviewing submission:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

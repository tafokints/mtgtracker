import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createReportAccess } from '@/lib/report-access';
import { DiscoverySubmission } from '@/lib/types';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { readJsonBody } from '@/lib/request-json';
import { validateDiscoverySubmission } from '@/lib/submission-validation';
import { formatTrackerSerial, getTrackerTotalSlots } from '@/lib/tracker-data';
import { mutateTrackerState, TrackerStoreError } from '@/lib/tracker-store';
import { readSubmissionSession } from '@/lib/submission-session';
import { getOwnedEvidence } from '@/lib/evidence-store';
import { evidenceUrl } from '@/lib/evidence-policy';
import { EvidenceUploadError } from '@/lib/evidence-upload';

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
    const body = await readJsonBody(request, 16384);
    if (!body.ok) return body.response;

    const validation = validateDiscoverySubmission(body.value, getTrackerTotalSlots(tracker));

    if (validation.errors.length > 0) {
      return NextResponse.json({ message: 'Submission validation failed', errors: validation.errors }, { status: 400 });
    }

    const redis = getRedis();
    const session = readSubmissionSession(request, slug, validation.value.cardId);
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

    for (const [key, limit, windowSeconds] of [
      [`rate-limit:submit:${clientIp}`, 10, 3600],
      ['rate-limit:submit:site', 1000, 86400],
    ] as const) {
      const budget = await checkRateLimit(redis, { key, limit, windowSeconds });
      if (!budget.allowed) return NextResponse.json({ message: 'Submission capacity reached. Please try again later.' }, { status: 429, headers: { 'Retry-After': String(windowSeconds) } });
    }

    const input = validation.value;
    const submissionId = session.id;
    const assets = await getOwnedEvidence(redis, session, input.evidenceAssetIds);
    const evidenceImages = assets.map((asset) => ({ url: evidenceUrl(asset.id), assetId: asset.id }));
    const submittedAt = new Date().toISOString();
    const payloadHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const savedAt = await mutateTrackerState(redis, tracker, (state) => {
      const { cards, submissions } = state;
      // One session creates one immutable report, including after a lost response.
      const existing = submissions.find((submission) => submission.id === submissionId);
      if (existing) {
        if (existing.payloadHash !== payloadHash) throw new TrackerStoreError('This report was already submitted with different details. Use its private follow-up link.', 409);
        return existing.submittedAt;
      }
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
        copyId: card.copyId,
        kind: input.kind,
        priceKind: input.priceKind,
        currency: input.currency,
        priceDate: input.priceDate,
        grading: input.grading,
        payloadHash,
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
        imageUrl: evidenceImages[0]?.url,
        evidenceImages,
        notes: input.notes,
        status: 'pending',
        submittedAt,
        consentAt: new Date(session.exp - 3600000).toISOString(),
        duplicateOf: duplicateCandidates[0]?.id,
        duplicateSubmissionIds: duplicateCandidates.map((candidate) => candidate.id),
      };

      state.submissions = [submission, ...submissions];
      return submission.submittedAt;
    });

    return NextResponse.json(
      {
        message: 'Submission queued for review',
        submissionId,
        followUpPath: `/reports/${slug}/${submissionId}#${createReportAccess(slug, submissionId, savedAt)}`,
        remaining: rateLimit.remaining,
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof TrackerStoreError || error instanceof EvidenceUploadError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Error queueing submission:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

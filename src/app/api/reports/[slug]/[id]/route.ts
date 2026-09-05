import { NextResponse } from 'next/server';
import { getTracker } from '@/lib/trackers';
import { getRedis } from '@/lib/redis';
import { requireReportAccess } from '@/lib/report-access';
import { getTrackerState, mutateTrackerState, TrackerStoreError } from '@/lib/tracker-store';
import { EvidenceUploadError } from '@/lib/evidence-upload';
import { readJsonBody } from '@/lib/request-json';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { createSubmissionSession } from '@/lib/submission-session';
import { EVIDENCE_ID, MAX_EVIDENCE_IMAGES, evidenceUrl } from '@/lib/evidence-policy';
import { getOwnedEvidence } from '@/lib/evidence-store';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
type Context = { params: Promise<{ slug: string; id: string }> };

function failure(error: unknown) {
  return NextResponse.json({ message: error instanceof EvidenceUploadError || error instanceof TrackerStoreError ? error.message : 'Report access unavailable' }, { status: error instanceof EvidenceUploadError || error instanceof TrackerStoreError ? error.status : 503, headers });
}

export async function GET(request: Request, { params }: Context) {
  try {
    const { slug, id } = await params;
    requireReportAccess(request, slug, id);
    const tracker = getTracker(slug);
    if (!tracker || tracker.status !== 'live') throw new TrackerStoreError('Report not found', 404);
    const redis = getRedis();
    if (!(await checkRateLimit(redis, { key: `rate-limit:receipt-read:${getClientIp(request)}`, limit: 120, windowSeconds: 3600 })).allowed) throw new TrackerStoreError('Report status limit reached. Please try later.', 429);
    const report = (await getTrackerState(redis, tracker)).submissions.find((item) => item.id === id);
    if (!report) throw new TrackerStoreError('Report not found', 404);
    return NextResponse.json({ id, status: report.status, cardTitle: report.cardTitle, serialNumber: report.serialNumber, serialTotal: report.serialTotal, submittedAt: report.submittedAt, request: report.status === 'needs-more-info' ? report.reviewNotes : undefined, followUps: report.followUps || [] }, { headers });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const { slug, id } = await params;
    requireReportAccess(request, slug, id);
    const tracker = getTracker(slug);
    if (!tracker || tracker.status !== 'live') throw new TrackerStoreError('Report not found', 404);
    const redis = getRedis();
    for (const key of [`report:${id}`, `report-ip:${getClientIp(request)}`]) {
      if (!(await checkRateLimit(redis, { key: `rate-limit:${key}`, limit: 20, windowSeconds: 86400 })).allowed) throw new TrackerStoreError('Follow-up limit reached. Please try tomorrow.', 429);
    }
    const body = await readJsonBody(request, 16384);
    if (!body.ok) return body.response;
    const report = (await getTrackerState(redis, tracker)).submissions.find((item) => item.id === id);
    if (!report) throw new TrackerStoreError('Report not found', 404);
    const previous = report.followUps?.find((reply) => reply.id === body.value.replyId);
    if (previous) {
      const ids = body.value.evidenceAssetIds ?? [];
      if (!Array.isArray(ids) || previous.notes !== String(body.value.notes).trim() || JSON.stringify([...(previous.evidenceAssetIds || [])].sort()) !== JSON.stringify([...new Set(ids)].sort())) throw new TrackerStoreError('This reply was already saved with different details', 409);
      return NextResponse.json({ status: report.status }, { headers });
    }
    if (report.status !== 'needs-more-info') throw new TrackerStoreError('This report is not awaiting more information', 409);
    if (body.value.action === 'upload-session') return NextResponse.json(createSubmissionSession(report.originTrackerSlug || slug, report.originCardId || report.cardId, id), { headers });
    const { notes, evidenceAssetIds = [], replyId } = body.value;
    if (typeof notes !== 'string' || !notes.trim() || notes.length > 1200 || typeof replyId !== 'string' || !EVIDENCE_ID.test(replyId) || !Array.isArray(evidenceAssetIds) || evidenceAssetIds.length > MAX_EVIDENCE_IMAGES || evidenceAssetIds.some((asset) => typeof asset !== 'string' || !EVIDENCE_ID.test(asset))) throw new TrackerStoreError('Include a reply of 1 to 1200 characters and valid attachments', 400);
    const assets = await getOwnedEvidence(redis, { id, tracker: report.originTrackerSlug || slug, cardId: report.originCardId || report.cardId }, evidenceAssetIds);
    const at = new Date().toISOString();
    await mutateTrackerState(redis, tracker, ({ submissions }) => {
      const current = submissions.find((item) => item.id === id);
      if (!current) throw new TrackerStoreError('Report not found', 404);
      const saved = current.followUps?.find((reply) => reply.id === replyId);
      if (saved) {
        if (saved.notes !== notes.trim() || JSON.stringify([...(saved.evidenceAssetIds || [])].sort()) !== JSON.stringify([...new Set(evidenceAssetIds)].sort())) throw new TrackerStoreError('This reply was already saved with different details', 409);
        return;
      }
      if (current.status !== 'needs-more-info') throw new TrackerStoreError('This report changed. Refresh its status.', 409);
      const images = [...new Map([...current.evidenceImages, ...assets.map((asset) => ({ url: evidenceUrl(asset.id), assetId: asset.id }))].map((image) => [image.url, image])).values()];
      if (images.length > MAX_EVIDENCE_IMAGES) throw new TrackerStoreError('Too many evidence attachments for this report', 400);
      current.evidenceImages = images;
      current.followUps = [...(current.followUps || []), { id: replyId, at, notes: notes.trim(), evidenceAssetIds: [...new Set(evidenceAssetIds)] }];
      current.reviewHistory = [...(current.reviewHistory || []), { id: `reply:${replyId}`, at, actor: 'submitter', action: 'reply' }];
      current.status = 'pending';
    });
    return NextResponse.json({ status: 'pending' }, { headers });
  } catch (error) { return failure(error); }
}

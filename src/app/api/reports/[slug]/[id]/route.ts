import { NextResponse } from 'next/server';
import { getTracker } from '@/lib/trackers';
import { getRedis } from '@/lib/redis';
import { requireReportAccess } from '@/lib/report-access';
import { getTrackerState, mutateTrackerState, TrackerStoreError } from '@/lib/tracker-store';
import { EvidenceUploadError } from '@/lib/evidence-upload';
import { readJsonBody } from '@/lib/request-json';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { createSubmissionSession } from '@/lib/submission-session';
import { EVIDENCE_ID, MAX_EVIDENCE_IMAGES, evidenceUrl, normalizeSourceUrl } from '@/lib/evidence-policy';
import type { DiscoverySubmission } from '@/lib/types';
import { getSubmissionSourceUrls, MAX_REPORT_SOURCE_LINKS } from '@/lib/submission-review';
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
    if (body.value.action === 'upload-session') {
      if (report.status !== 'needs-more-info') throw new TrackerStoreError('This report is not awaiting more information', 409);
      return NextResponse.json(createSubmissionSession(report.originTrackerSlug || slug, report.originCardId || report.cardId, id), { headers });
    }
    const { notes = '', sourceUrl: sourceInput = '', evidenceAssetIds = [], replyId } = body.value;
    if (typeof notes !== 'string' || notes.length > 1200 || typeof sourceInput !== 'string' || sourceInput.length > 2048 || typeof replyId !== 'string' || !EVIDENCE_ID.test(replyId) || !Array.isArray(evidenceAssetIds) || evidenceAssetIds.length > MAX_EVIDENCE_IMAGES || evidenceAssetIds.some((asset) => typeof asset !== 'string' || !EVIDENCE_ID.test(asset))) throw new TrackerStoreError('Use up to 1200 characters, a supported source link and valid attachments', 400);
    const sourceUrl = sourceInput.trim() ? normalizeSourceUrl(sourceInput.trim()) : undefined;
    if (sourceInput.trim() && !sourceUrl) throw new TrackerStoreError('Use a supported direct HTTPS source link, not a shortener or image URL', 400);
    if (!notes.trim() && !sourceUrl && !evidenceAssetIds.length) throw new TrackerStoreError('Add a source link, notes or an attachment', 400);
    const reply = { id: replyId, notes: notes.trim(), ...(sourceUrl ? { sourceUrl } : {}), evidenceAssetIds: [...new Set<string>(evidenceAssetIds)].sort() };
    const matchesReply = (saved: NonNullable<DiscoverySubmission['followUps']>[number]) => saved.notes === reply.notes && saved.sourceUrl === reply.sourceUrl && JSON.stringify([...(saved.evidenceAssetIds || [])].sort()) === JSON.stringify(reply.evidenceAssetIds);
    const previous = report.followUps?.find((saved) => saved.id === replyId);
    if (previous) {
      if (!matchesReply(previous)) throw new TrackerStoreError('This reply was already saved with different details', 409);
      return NextResponse.json({ status: report.status }, { headers });
    }
    if (report.status !== 'needs-more-info') throw new TrackerStoreError('This report is not awaiting more information', 409);
    const assets = await getOwnedEvidence(redis, { id, tracker: report.originTrackerSlug || slug, cardId: report.originCardId || report.cardId }, evidenceAssetIds);
    const at = new Date().toISOString();
    const status = await mutateTrackerState(redis, tracker, ({ submissions }) => {
      const current = submissions.find((item) => item.id === id);
      if (!current) throw new TrackerStoreError('Report not found', 404);
      const saved = current.followUps?.find((reply) => reply.id === replyId);
      if (saved) {
        if (!matchesReply(saved)) throw new TrackerStoreError('This reply was already saved with different details', 409);
        return current.status;
      }
      if (current.status !== 'needs-more-info') throw new TrackerStoreError('This report changed. Refresh its status.', 409);
      if (sourceUrl && new Set([...getSubmissionSourceUrls(current), sourceUrl]).size > MAX_REPORT_SOURCE_LINKS) throw new TrackerStoreError('This report already has eight source links. Ask the reviewer to review the existing sources.', 400);
      const images = [...new Map([...current.evidenceImages, ...assets.map((asset) => ({ url: evidenceUrl(asset.id), assetId: asset.id }))].map((image) => [image.url, image])).values()];
      if (images.length > MAX_EVIDENCE_IMAGES) throw new TrackerStoreError('Too many evidence attachments for this report', 400);
      current.evidenceImages = images;
      current.followUps = [...(current.followUps || []), { ...reply, at }];
      current.reviewHistory = [...(current.reviewHistory || []), { id: `reply:${replyId}`, at, actor: 'submitter', action: 'reply' }];
      current.status = 'pending';
      return current.status;
    });
    return NextResponse.json({ status }, { headers });
  } catch (error) { return failure(error); }
}

import { NextResponse } from 'next/server';
import { isAdminRequest, requireAdmin } from '@/lib/admin-auth';
import { getRedis } from '@/lib/redis';
import { EVIDENCE_ID, evidenceUrl } from '@/lib/evidence-policy';
import { evidenceKey, readEvidenceBytes, saveEvidenceScan, type EvidenceAsset } from '@/lib/evidence-store';
import { scanEvidenceImage } from '@/lib/evidence-scanning';
import { getTracker } from '@/lib/trackers';
import { getTrackerState } from '@/lib/tracker-store';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex', 'Vary': 'Cookie' };
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  if (!EVIDENCE_ID.test(id)) return new NextResponse(null, { status: 404, headers });
  try {
    const redis = getRedis();
    const asset = await redis.get<EvidenceAsset>(evidenceKey(id));
    if (!asset || asset.id !== id || asset.scan.status !== 'clean' || asset.scan.policyVersion !== 1) return new NextResponse(null, { status: 404, headers });
    if (!isAdminRequest(request)) {
      const tracker = getTracker(asset.tracker);
      if (!tracker || tracker.status !== 'live') return new NextResponse(null, { status: 404, headers });
      const { cards, submissions } = await getTrackerState(redis, tracker);
      const report = submissions.find((submission) => submission.id === asset.submissionId);
      const reviewed = report?.status === 'approved' || (report?.status === 'duplicate' && submissions.some((item) => item.id === report.duplicateOf && item.status === 'approved'));
      const published = cards.some((card) => card.id === asset.cardId && card.found && card.evidenceImages?.some((image) => image.url === evidenceUrl(id) && image.sourceSubmissionId === asset.submissionId));
      if (!reviewed || !published) return new NextResponse(null, { status: 404, headers });
    }
    const bytes = await readEvidenceBytes(asset);
    return new NextResponse(new Uint8Array(bytes), { headers: { ...headers, 'Content-Type': 'image/webp', 'Content-Disposition': `inline; filename="${id}.webp"`, 'Content-Security-Policy': "default-src 'none'; sandbox" } });
  } catch { return new NextResponse(null, { status: 503, headers }); }
}

// Retry interrupted/unavailable checks only. Clean results are immutable for this asset.
export async function POST(request: Request, { params }: Context) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await params;
  if (!EVIDENCE_ID.test(id)) return NextResponse.json({ message: 'Evidence not found' }, { status: 404, headers });
  try {
    const redis = getRedis();
    const asset = await redis.get<EvidenceAsset>(evidenceKey(id));
    if (!asset) return NextResponse.json({ message: 'Evidence not found' }, { status: 404, headers });
    if (asset.scan.status === 'clean' || asset.scan.status === 'flagged') return NextResponse.json({ scan: asset.scan }, { headers });
    for (const [key, limit] of [[`rate-limit:scan:${getClientIp(request)}`, 20], ['rate-limit:scan:site', 100]] as const) {
      if (!(await checkRateLimit(redis, { key, limit, windowSeconds: 3600 })).allowed) return NextResponse.json({ message: 'Scan retry limit reached' }, { status: 429, headers });
    }
    const bytes = await readEvidenceBytes(asset);
    const scan = await scanEvidenceImage(bytes);
    return NextResponse.json({ scan: await saveEvidenceScan(redis, id, scan) }, { headers });
  } catch { return NextResponse.json({ message: 'Evidence checks are unavailable' }, { status: 503, headers }); }
}

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { getTrackerSubmissions } from '@/lib/tracker-data';
import { checkSourceReputation } from '@/lib/evidence-scanning';
import { EvidenceUploadError } from '@/lib/evidence-upload';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { slug, id } = await params;
  const tracker = getTracker(slug);
  if (!tracker || tracker.status !== 'live' || id.length > 200) return NextResponse.json({ message: 'Report not found' }, { status: 404 });
  try {
    const redis = getRedis();
    const limit = await checkRateLimit(redis, { key: `rate-limit:source-check:${getClientIp(request)}`, limit: 60, windowSeconds: 3600 });
    if (!limit.allowed) return NextResponse.json({ message: 'Source check limit reached' }, { status: 429 });
    const report = (await getTrackerSubmissions(redis, tracker)).find((item) => item.id === id);
    if (!report?.link) return NextResponse.json({ message: 'Source not found' }, { status: 404 });
    await checkSourceReputation(report.link);
    return NextResponse.json({ url: report.link }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof EvidenceUploadError ? error.message : 'Source check unavailable' }, { status: error instanceof EvidenceUploadError ? error.status : 503 });
  }
}

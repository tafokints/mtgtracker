import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { getTrackerSubmissions } from '@/lib/tracker-data';
import { checkSourceReputation } from '@/lib/evidence-scanning';
import { EvidenceUploadError } from '@/lib/evidence-upload';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { readJsonBody } from '@/lib/request-json';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { slug, id } = await params;
  const tracker = getTracker(slug);
  if (!tracker || tracker.status !== 'live' || id.length > 200) return NextResponse.json({ message: 'Report not found' }, { status: 404 });
  try {
    const redis = getRedis();
    const limit = await checkRateLimit(redis, { key: `rate-limit:source-check:${getClientIp(request)}`, limit: 60, windowSeconds: 3600 });
    if (!limit.allowed) return NextResponse.json({ message: 'Source check limit reached' }, { status: 429 });
    const report = (await getTrackerSubmissions(redis, tracker)).find((item) => item.id === id);
    let url = report?.link;
    if (request.body) {
      const body = await readJsonBody(request, 4096);
      if (!body.ok) return body.response;
      if (body.value.replyId !== undefined) {
        if (typeof body.value.replyId !== 'string' || body.value.replyId.length > 200) return NextResponse.json({ message: 'Invalid reply selection' }, { status: 400 });
        url = report?.followUps?.find((reply) => reply.id === body.value.replyId)?.sourceUrl;
      }
    }
    if (!url) return NextResponse.json({ message: 'Source not found' }, { status: 404 });
    await checkSourceReputation(url);
    return NextResponse.json({ url }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof EvidenceUploadError ? error.message : 'Source check unavailable' }, { status: error instanceof EvidenceUploadError ? error.status : 503 });
  }
}

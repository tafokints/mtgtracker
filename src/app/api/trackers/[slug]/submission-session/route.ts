import { NextResponse } from 'next/server';
import { getTracker } from '@/lib/trackers';
import { getTrackerTotalSlots } from '@/lib/tracker-data';
import { readJsonBody } from '@/lib/request-json';
import { getRedis } from '@/lib/redis';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { createSubmissionSession, verifyTurnstile } from '@/lib/submission-session';
import { EvidenceUploadError } from '@/lib/evidence-upload';
import { parseCardId } from '@/lib/admin-validation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tracker = getTracker(slug);
  if (!tracker || tracker.status !== 'live') return NextResponse.json({ message: 'Tracker not found' }, { status: 404 });
  try {
    const body = await readJsonBody(request, 8192);
    if (!body.ok) return body.response;
    if (body.value.consent !== true) return NextResponse.json({ message: 'Evidence submission permission is required' }, { status: 400 });
    const cardId = parseCardId(body.value.cardId);
    if (!cardId || cardId > getTrackerTotalSlots(tracker)) return NextResponse.json({ message: 'Select a valid card and serial' }, { status: 400 });
    const redis = getRedis();
    const limit = await checkRateLimit(redis, { key: `rate-limit:submission-session:${getClientIp(request)}`, limit: 15, windowSeconds: 3600 });
    if (!limit.allowed) return NextResponse.json({ message: 'Too many verification attempts. Try again later.' }, { status: 429, headers: { 'Retry-After': '3600' } });
    await verifyTurnstile(body.value.turnstileToken);
    return NextResponse.json(createSubmissionSession(slug, cardId), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof EvidenceUploadError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: 'Submission protection is unavailable' }, { status: 503 });
  }
}

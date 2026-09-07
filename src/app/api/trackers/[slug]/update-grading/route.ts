import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { requireAdmin } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/request-json';
import { TrackerStoreError } from '@/lib/tracker-store';
import { isDateOnly, parseCardId } from '@/lib/admin-validation';
import { parseGradingInfo } from '@/lib/history-validation';
import { recordAdminMutation } from '@/lib/admin-mutation';
import { checkSourceReputation } from '@/lib/evidence-scanning';
import { EvidenceUploadError } from '@/lib/evidence-upload';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { slug } = await params;
  const tracker = getTracker(slug);
  if (!tracker || tracker.status !== 'live') return NextResponse.json({ error: 'Tracker not found' }, { status: 404 });
  try {
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const cardId = parseCardId(body.value.cardId);
    const status = body.value.status ?? 'graded';
    if (!cardId || !['graded', 'ungraded'].includes(String(status))) return NextResponse.json({ error: 'Invalid card or grading status' }, { status: 400 });
    let grading;
    try { grading = status === 'graded' ? parseGradingInfo(body.value.grading) : undefined; }
    catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
    const occurredOn = body.value.occurredOn ?? grading?.dateGraded;
    if (occurredOn !== undefined && !isDateOnly(occurredOn)) return NextResponse.json({ error: 'Invalid grading event date' }, { status: 400 });
    const entry = { status: status as 'graded' | 'ungraded', grading, occurredOn: occurredOn as string | undefined };
    const result = await recordAdminMutation({
      request, redis: getRedis(), tracker, cardId, kind: 'grading', payload: entry,
      check: grading?.sourceUrl ? () => checkSourceReputation(grading.sourceUrl!) : undefined,
      edit: (_card, _submissions, event) => ({ grading: { ...entry, ...event } }),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof TrackerStoreError || error instanceof EvidenceUploadError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Unable to record grading history' }, { status: 500 });
  }
}

import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { requireAdmin } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/request-json';
import { mutateTrackerState, TrackerStoreError } from '@/lib/tracker-store';
import { isDateOnly, parseCardId } from '@/lib/admin-validation';
import { parseGradingInfo } from '@/lib/history-validation';
import { appendCardEvent } from '@/lib/card-history';
import { checkSourceReputation } from '@/lib/evidence-scanning';
import { EvidenceUploadError } from '@/lib/evidence-upload';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const unauthorized = requireAdmin(request);
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
    if (grading?.sourceUrl) await checkSourceReputation(grading.sourceUrl);
    const id = randomUUID();
    const recordedAt = new Date().toISOString();
    const entry = { id, status: status as 'graded' | 'ungraded', grading, occurredOn: occurredOn as string | undefined, recordedAt };
    const card = await mutateTrackerState(getRedis(), tracker, ({ cards }) => {
      const card = cards.find((item) => item.id === cardId);
      if (!card) throw new TrackerStoreError('Card not found', 404);
      if (!card.found) throw new TrackerStoreError('Approve a discovery before adding grading history', 409);
      appendCardEvent(card, { id, kind: 'grading', recordedAt, grading: entry });
      return card;
    });
    return NextResponse.json({ success: true, card });
  } catch (error) {
    if (error instanceof TrackerStoreError || error instanceof EvidenceUploadError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Unable to record grading history' }, { status: 500 });
  }
}

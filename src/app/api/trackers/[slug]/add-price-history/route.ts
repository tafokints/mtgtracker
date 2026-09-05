import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { requireAdmin } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/request-json';
import { mutateTrackerState, TrackerStoreError } from '@/lib/tracker-store';
import { parseCardId } from '@/lib/admin-validation';
import { parsePriceObservation } from '@/lib/history-validation';
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
    if (!cardId || !body.value.entry || typeof body.value.entry !== 'object' || Array.isArray(body.value.entry)) return NextResponse.json({ error: 'Card and price observation are required' }, { status: 400 });
    let entry;
    try { entry = parsePriceObservation(body.value.entry as Record<string, unknown>); }
    catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
    if (entry.sourceUrl) await checkSourceReputation(entry.sourceUrl);
    const id = randomUUID();
    const recordedAt = new Date().toISOString();
    const price = { ...entry, id, recordedAt };
    const card = await mutateTrackerState(getRedis(), tracker, ({ cards }) => {
      const card = cards.find((item) => item.id === cardId);
      if (!card) throw new TrackerStoreError('Card not found', 404);
      if (!card.found) throw new TrackerStoreError('Approve a discovery before adding market history', 409);
      appendCardEvent(card, { id, kind: 'price', recordedAt, price });
      return card;
    });
    return NextResponse.json({ success: true, card });
  } catch (error) {
    if (error instanceof TrackerStoreError || error instanceof EvidenceUploadError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Unable to record price history' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { requireAdmin } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/request-json';
import { TrackerStoreError } from '@/lib/tracker-store';
import { parseCardId } from '@/lib/admin-validation';
import { parsePriceObservation } from '@/lib/history-validation';
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
    if (!cardId || !body.value.entry || typeof body.value.entry !== 'object' || Array.isArray(body.value.entry)) return NextResponse.json({ error: 'Card and price observation are required' }, { status: 400 });
    let entry;
    try { entry = parsePriceObservation(body.value.entry as Record<string, unknown>); }
    catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
    const result = await recordAdminMutation({
      request, redis: getRedis(), tracker, cardId, kind: 'price', payload: entry,
      check: entry.sourceUrl ? () => checkSourceReputation(entry.sourceUrl!) : undefined,
      edit: (_card, _submissions, event) => ({ price: { ...entry, ...event } }),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof TrackerStoreError || error instanceof EvidenceUploadError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Unable to record price history' }, { status: 500 });
  }
}

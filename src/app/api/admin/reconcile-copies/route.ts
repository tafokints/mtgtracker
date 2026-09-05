import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { previewCopyReconciliation, reconcileCopies } from '@/lib/copy-reconciliation';
import { TrackerStoreError } from '@/lib/tracker-store';
import { readJsonBody } from '@/lib/request-json';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const tracker = getTracker('lotr-poster-cards')!;
function failure(error: unknown) { return NextResponse.json({ message: error instanceof TrackerStoreError ? error.message : 'Reconciliation unavailable' }, { status: error instanceof TrackerStoreError ? error.status : 503, headers }); }

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request); if (unauthorized) return unauthorized;
  try { return NextResponse.json(await previewCopyReconciliation(getRedis(), tracker), { headers }); }
  catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request); if (unauthorized) return unauthorized;
  try {
    const body = await readJsonBody(request, 32768); if (!body.ok) return body.response;
    const { confirm, revision, decisions } = body.value;
    if (confirm !== 'RECONCILE_SHARED_COPIES' || typeof revision !== 'string' || !Array.isArray(decisions) || decisions.length > 100 || decisions.some((decision) => !decision || typeof decision.copyId !== 'string' || !['keep-canonical', 'adopt-legacy'].includes(decision.choice))) return NextResponse.json({ message: 'Preview, revision, and explicit decisions are required' }, { status: 400, headers });
    return NextResponse.json(await reconcileCopies(getRedis(), tracker, revision, decisions), { headers });
  } catch (error) { return failure(error); }
}

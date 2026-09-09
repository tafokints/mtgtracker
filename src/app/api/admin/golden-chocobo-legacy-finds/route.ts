import { NextResponse } from 'next/server';
import { getAdminPrincipal, requireAdmin } from '@/lib/admin-auth';
import { validBackupCard, validBackupSubmission } from '@/lib/backup-validation';
import {
  buildGoldenChocoboLegacyFindImport,
  fetchGoldenChocoboLegacyCards,
  GOLDEN_CHOCOBO_LEGACY_CONFIRMATION,
} from '@/lib/golden-chocobo-legacy';
import { readJsonBody } from '@/lib/request-json';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { getTrackerTotalSlots } from '@/lib/tracker-data';
import { restoreTrackerState, TrackerStoreError } from '@/lib/tracker-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;
export const maxDuration = 60;

const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };

function json(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, { ...init, headers });
}

function validateImportState(imported: ReturnType<typeof buildGoldenChocoboLegacyFindImport>, tracker: NonNullable<ReturnType<typeof getTracker>>) {
  const trackerTotal = getTrackerTotalSlots(tracker);
  const cardIds = new Set<number>();
  const submissionIds = new Set<string>();

  if (imported.cards.length !== trackerTotal) return `Import must include exactly ${trackerTotal} cards`;
  for (const card of imported.cards) {
    if (!Number.isInteger(card.id) || card.id < 1 || card.id > trackerTotal || cardIds.has(card.id)) {
      return 'Import contains invalid card ids';
    }
    if (!validBackupCard(card, tracker)) return 'Import contains invalid card details';
    cardIds.add(card.id);
  }

  for (const submission of imported.submissions) {
    if (!submission.id || submissionIds.has(submission.id) || !validBackupSubmission(submission, tracker)) {
      return 'Import contains invalid submission records';
    }
    submissionIds.add(submission.id);
  }

  return undefined;
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) { Object.entries(headers).forEach(([key, value]) => denied.headers.set(key, value)); return denied; }

  const body = await readJsonBody(request, 1024);
  if (!body.ok) { Object.entries(headers).forEach(([key, value]) => body.response.headers.set(key, value)); return body.response; }

  if (Object.keys(body.value).length !== 1 || body.value.confirm !== GOLDEN_CHOCOBO_LEGACY_CONFIRMATION) {
    return json({ message: 'Golden Chocobo legacy import confirmation is required' }, { status: 400 });
  }

  const tracker = getTracker('golden-chocobo');
  if (!tracker || tracker.status !== 'live') return json({ message: 'Golden Chocobo tracker is not live' }, { status: 404 });

  try {
    const legacyCards = await fetchGoldenChocoboLegacyCards();
    const owner = await getAdminPrincipal(request);
    const imported = buildGoldenChocoboLegacyFindImport(tracker, legacyCards, { reviewedBy: owner?.id || 'legacy-import' });
    const validationError = validateImportState(imported, tracker);
    if (validationError) return json({ message: validationError }, { status: 400 });

    await restoreTrackerState(getRedis(), tracker, {
      cards: imported.cards,
      submissions: imported.submissions,
    });

    return json({
      message: 'Golden Chocobo legacy finds imported',
      source: imported.source,
      counts: imported.counts,
      missingSerials: imported.missingSerials,
    });
  } catch (error) {
    if (error instanceof TrackerStoreError) return json({ message: error.message }, { status: error.status });
    console.error('Error importing Golden Chocobo legacy finds:', error);
    return json({ message: 'Golden Chocobo legacy import failed' }, { status: 500 });
  }
}

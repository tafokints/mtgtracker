import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getRedis } from '@/lib/redis';
import { getTracker, type TrackerSummary } from '@/lib/trackers';
import { validBackupCard, validBackupSubmission } from '@/lib/backup-validation';
import { DiscoverySubmission, SerializedRingCard, SubmissionStatus } from '@/lib/types';
import { getTrackerTotalSlots, normalizeTrackerCard } from '@/lib/tracker-data';
import { restoreTrackerState, TrackerStoreError } from '@/lib/tracker-store';
import { readJsonBody } from '@/lib/request-json';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BACKUP_SCHEMA_VERSION = 2;
const RESTORE_CONFIRMATION = 'RESTORE_TRACKER_BACKUP';
const SUBMISSION_STATUSES: SubmissionStatus[] = [
  'pending',
  'approved',
  'rejected',
  'needs-more-info',
  'duplicate',
  'cannot-verify',
  'revoked',
];

type RouteContext = {
  params: Promise<{ slug: string }>;
};

type RestoreBackup = {
  schemaVersion?: unknown;
  tracker?: {
    slug?: unknown;
  };
  cards?: unknown;
  submissions?: unknown;
};

function validateBackup(backup: RestoreBackup, tracker: TrackerSummary) {
  const trackerTotal = getTrackerTotalSlots(tracker);
  if (backup.schemaVersion !== BACKUP_SCHEMA_VERSION && backup.schemaVersion !== 1) {
    return 'Unsupported backup schema version';
  }

  if (backup.tracker?.slug !== tracker.slug) {
    return 'Backup tracker does not match this tracker';
  }

  if (!Array.isArray(backup.cards) || backup.cards.length !== trackerTotal) {
    return `Backup must include exactly ${trackerTotal} cards`;
  }

  const cardIds = new Set<number>();
  for (const card of backup.cards) {
    const cardId = typeof card === 'object' && card !== null && 'id' in card ? (card as { id?: unknown }).id : undefined;
    if (typeof cardId !== 'number' || !Number.isInteger(cardId) || cardId < 1 || cardId > trackerTotal || cardIds.has(cardId)) {
      return 'Backup contains invalid card ids';
    }
    if (!validBackupCard(card, tracker)) return 'Backup contains invalid card details or mismatched serial identity';
    cardIds.add(cardId);
  }

  if (!Array.isArray(backup.submissions)) {
    return 'Backup submissions must be an array';
  }

  const submissionIds = new Set<string>();
  for (const submission of backup.submissions) {
    if (typeof submission !== 'object' || submission === null) {
      return 'Backup contains invalid submissions';
    }

    const item = submission as Partial<DiscoverySubmission>;
    const cardId = item.cardId;
    if (
      typeof item.id !== 'string' ||
      !item.id.trim() || item.id.length > 200 || submissionIds.has(item.id) ||
      typeof cardId !== 'number' ||
      !Number.isInteger(cardId) ||
      cardId < 1 ||
      cardId > trackerTotal ||
      typeof item.serialNumber !== 'string' ||
      !SUBMISSION_STATUSES.includes(item.status as SubmissionStatus) ||
      !validBackupSubmission(item, tracker)
    ) {
      return 'Backup contains invalid submission records';
    }
    submissionIds.add(item.id);
  }

  return undefined;
}

export async function POST(request: Request, { params }: RouteContext) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { slug } = await params;
  const tracker = getTracker(slug);
  if (!tracker || tracker.status !== 'live') {
    return NextResponse.json({ message: 'Tracker not found' }, { status: 404 });
  }

  try {
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;

    const input = body.value as { confirm?: unknown; backup?: RestoreBackup };
    if (input.confirm !== RESTORE_CONFIRMATION) {
      return NextResponse.json({ message: 'Restore confirmation is required' }, { status: 400 });
    }

    if (!input.backup || typeof input.backup !== 'object') {
      return NextResponse.json({ message: 'Backup payload is required' }, { status: 400 });
    }

    const validationError = validateBackup(input.backup, tracker);
    if (validationError) {
      return NextResponse.json({ message: validationError }, { status: 400 });
    }

    const redis = getRedis();
    const cards = (input.backup.cards as Array<Partial<SerializedRingCard> & { id: number }>)
      .map((card) => normalizeTrackerCard(tracker, card))
      .sort((a, b) => a.id - b.id);
    const submissions = input.backup.submissions as DiscoverySubmission[];

    await restoreTrackerState(redis, tracker, { cards, submissions });

    return NextResponse.json({
      message: 'Backup restored',
      counts: {
        cards: cards.length,
        submissions: submissions.length,
      },
    });
  } catch (error) {
    if (error instanceof TrackerStoreError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Error importing tracker backup:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getAdminPrincipal, requireAdmin } from '@/lib/admin-auth';
import { appendCardEvent } from '@/lib/card-history';
import { isBlobStorageConfigured } from '@/lib/blob-config';
import { evidenceUrl, MAX_UPLOAD_BYTES } from '@/lib/evidence-policy';
import { storeTrustedEvidence, type EvidenceAsset } from '@/lib/evidence-store';
import { EvidenceUploadError, prepareEvidenceImage } from '@/lib/evidence-upload';
import {
  GOLDEN_CHOCOBO_LEGACY_IMAGE_CONFIRMATION,
  goldenChocoboLegacyImageUrl,
} from '@/lib/golden-chocobo-legacy';
import { readJsonBody } from '@/lib/request-json';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { getTrackerState, mutateTrackerState, TrackerStoreError } from '@/lib/tracker-store';
import type { DiscoverySubmission, EvidenceImage, SerializedRingCard, SourceType } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;
export const maxDuration = 60;

const trackerSlug = 'golden-chocobo';
const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const legacyUserAgent = 'MTGTrackers/0.1 GoldenChocoboImageMigration contact mtgtrackers.com';
const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

type Target = {
  cardId: number;
  serialNumber: string;
  serialTotal: number;
  submissionId: string;
  sourceUrl?: string;
  sourceType?: SourceType;
};

type ImageOutcome =
  | { status: 'uploaded'; target: Target; asset: EvidenceAsset }
  | { status: 'missing'; target: Target }
  | { status: 'failed'; target: Target; message: string };

function json(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, { ...init, headers });
}

function legacySubmissionId(serialNumber: string) {
  return `legacy-golden-chocobo-${serialNumber}`;
}

function contentType(value: string | null) {
  return value?.split(';', 1)[0]?.trim().toLowerCase();
}

function legacyEvidenceAlreadyImported(card: SerializedRingCard, submissionId: string) {
  return (card.evidenceImages || []).some((image) => image.sourceSubmissionId === submissionId && image.url.startsWith('/api/evidence/'));
}

function imageTargets(cards: SerializedRingCard[], submissions: DiscoverySubmission[]): Target[] {
  return cards.flatMap((card) => {
    if (!card.found) return [];
    const submissionId = legacySubmissionId(card.serialNumber);
    if (legacyEvidenceAlreadyImported(card, submissionId)) return [];
    const submission = submissions.find((candidate) => candidate.id === submissionId && candidate.status === 'approved');
    if (!submission) return [];

    return [{
      cardId: card.id,
      serialNumber: card.serialNumber,
      serialTotal: card.serialTotal || 77,
      submissionId,
      sourceUrl: submission.link,
      sourceType: submission.sourceType,
    }];
  });
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchLegacyImage(target: Target): Promise<ImageOutcome> {
  const source = goldenChocoboLegacyImageUrl(target.serialNumber);
  const requestInit = (headers: HeadersInit = {}) => ({
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
    headers,
  }) satisfies RequestInit;

  try {
    const head = await fetch(source, { ...requestInit({ 'User-Agent': legacyUserAgent }), method: 'HEAD' });
    if (head.status === 404) return { status: 'missing', target };
    if (!head.ok) return { status: 'failed', target, message: `Legacy image returned ${head.status}` };
    const declaredType = contentType(head.headers.get('content-type'));
    const declaredSize = Number(head.headers.get('content-length') || 0);
    if (declaredType && !supportedTypes.has(declaredType)) return { status: 'failed', target, message: `Unsupported legacy image type ${declaredType}` };
    if (declaredSize > MAX_UPLOAD_BYTES) return { status: 'failed', target, message: 'Legacy image is larger than 4 MB' };

    const response = await fetch(source, { ...requestInit({ Accept: 'image/*', 'User-Agent': legacyUserAgent }), method: 'GET' });
    if (response.status === 404) return { status: 'missing', target };
    if (!response.ok) return { status: 'failed', target, message: `Legacy image download returned ${response.status}` };

    const type = contentType(response.headers.get('content-type')) || declaredType || 'image/jpeg';
    if (!supportedTypes.has(type)) return { status: 'failed', target, message: `Unsupported legacy image type ${type}` };
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_UPLOAD_BYTES) return { status: 'failed', target, message: 'Legacy image is larger than 4 MB' };

    const image = await prepareEvidenceImage(new File([new Uint8Array(bytes)], `chocobo-${target.serialNumber}.jpg`, { type }));
    const asset = await storeTrustedEvidence(
      getRedis(),
      { id: target.submissionId, tracker: trackerSlug, cardId: target.cardId },
      image,
      'trusted-legacy-import',
    );
    return { status: 'uploaded', target, asset };
  } catch (error) {
    if (error instanceof EvidenceUploadError) return { status: 'failed', target, message: error.message };
    return { status: 'failed', target, message: 'Legacy image could not be imported' };
  }
}

function mergeEvidenceImages(images: EvidenceImage[]) {
  return [...new Map(images.filter((image) => image.url).map((image) => [image.url, image])).values()];
}

function attachImages(outcomes: Extract<ImageOutcome, { status: 'uploaded' }>[], actorId: string) {
  const now = new Date().toISOString();

  return mutateTrackerState(getRedis(), getTracker(trackerSlug)!, ({ cards, submissions }) => {
    const importedSerials: string[] = [];
    const skippedSerials: string[] = [];

    for (const { target, asset } of outcomes) {
      const card = cards.find((candidate) => candidate.id === target.cardId);
      const submission = submissions.find((candidate) => candidate.id === target.submissionId);
      if (!card?.found || !submission || submission.status !== 'approved' || legacyEvidenceAlreadyImported(card, target.submissionId)) {
        skippedSerials.push(target.serialNumber);
        continue;
      }

      const url = evidenceUrl(asset.id);
      const evidenceImage: EvidenceImage = {
        url,
        assetId: asset.id,
        caption: `Legacy Golden Chocobo ${target.serialNumber}/${target.serialTotal} image`,
        sourceSubmissionId: target.submissionId,
        sourceUrl: target.sourceUrl,
        sourceType: target.sourceType,
      };

      submission.imageUrl ||= url;
      submission.evidenceImages = mergeEvidenceImages([...(submission.evidenceImages || []), evidenceImage]);
      submission.reviewHistory = [...(submission.reviewHistory || []), {
        id: `${target.submissionId}-legacy-image-${asset.id}`,
        action: 'legacy-image-import',
        at: now,
        actor: 'admin',
        actorId,
        notes: 'Imported sanitized evidence image from the legacy Golden Chocobo tracker.',
      }];

      appendCardEvent(card, {
        id: `image:${target.submissionId}:${asset.id}`,
        kind: 'image',
        recordedAt: now,
        sourceSubmissionId: target.submissionId,
        facts: { image: url, evidenceImages: [evidenceImage] },
      });
      importedSerials.push(target.serialNumber);
    }

    const found = cards.filter((card) => card.found).length;
    const withEvidence = cards.filter((card) => card.found && (card.evidenceImages || []).some((image) => image.url.startsWith('/api/evidence/'))).length;
    return { importedSerials, skippedSerials, found, withEvidence };
  });
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) { Object.entries(headers).forEach(([key, value]) => denied.headers.set(key, value)); return denied; }

  const body = await readJsonBody(request, 1024);
  if (!body.ok) { Object.entries(headers).forEach(([key, value]) => body.response.headers.set(key, value)); return body.response; }

  if (Object.keys(body.value).length !== 1 || body.value.confirm !== GOLDEN_CHOCOBO_LEGACY_IMAGE_CONFIRMATION) {
    return json({ message: 'Golden Chocobo legacy image import confirmation is required' }, { status: 400 });
  }
  if (!isBlobStorageConfigured()) return json({ message: 'Private image storage is not configured' }, { status: 503 });

  const tracker = getTracker(trackerSlug);
  if (!tracker || tracker.status !== 'live') return json({ message: 'Golden Chocobo tracker is not live' }, { status: 404 });

  try {
    const redis = getRedis();
    const owner = await getAdminPrincipal(request);
    const state = await getTrackerState(redis, tracker);
    const targets = imageTargets(state.cards, state.submissions);
    const outcomes = await mapWithConcurrency(targets, 4, fetchLegacyImage);
    const uploaded = outcomes.filter((outcome): outcome is Extract<ImageOutcome, { status: 'uploaded' }> => outcome.status === 'uploaded');
    const attached = await attachImages(uploaded, owner?.id || 'legacy-import');
    const missingSerials = outcomes.filter((outcome) => outcome.status === 'missing').map((outcome) => outcome.target.serialNumber);
    const failed = outcomes.filter((outcome): outcome is Extract<ImageOutcome, { status: 'failed' }> => outcome.status === 'failed')
      .map((outcome) => ({ serialNumber: outcome.target.serialNumber, message: outcome.message }));

    return json({
      message: 'Golden Chocobo legacy images imported',
      counts: {
        eligible: targets.length,
        uploaded: uploaded.length,
        imported: attached.importedSerials.length,
        skipped: attached.skippedSerials.length,
        missing: missingSerials.length,
        failed: failed.length,
        found: attached.found,
        withEvidence: attached.withEvidence,
      },
      importedSerials: attached.importedSerials,
      skippedSerials: attached.skippedSerials,
      missingSerials,
      failed,
    });
  } catch (error) {
    if (error instanceof TrackerStoreError) return json({ message: error.message }, { status: error.status });
    console.error('Error importing Golden Chocobo legacy images:', error);
    return json({ message: 'Golden Chocobo legacy image import failed' }, { status: 500 });
  }
}

import { get, put } from '@vercel/blob';
import type { Redis } from '@upstash/redis';
import { createHash, randomUUID } from 'node:crypto';
import { evidenceIdFromUrl, evidenceUrl } from './evidence-policy';
import { EvidenceUploadError, prepareEvidenceImage } from './evidence-upload';
import { scanEvidenceImage, type EvidenceScan } from './evidence-scanning';
import type { SubmissionSession } from './submission-session';
import type { DiscoverySubmission } from './types';

export interface EvidenceAsset {
  id: string;
  tracker: string;
  cardId: number;
  submissionId: string;
  pathname: string;
  sha256: string;
  size: number;
  width: number;
  height: number;
  createdAt: string;
  sessionExpiresAt: number;
  scan: EvidenceScan;
}

export const evidenceKey = (id: string) => `evidence:v1:${id}`;

export const COMMIT_EVIDENCE_SCAN = `
  -- commit evidence scan without overwriting a terminal result
  local raw = redis.call('GET', KEYS[1])
  if not raw then return 0 end
  local asset = cjson.decode(raw)
  if asset.scan.status == 'clean' or asset.scan.status == 'flagged' then return 0 end
  asset.scan = cjson.decode(ARGV[1])
  redis.call('SET', KEYS[1], cjson.encode(asset))
  return 1
`;

export async function storeEvidence(redis: Redis, session: SubmissionSession, image: Awaited<ReturnType<typeof prepareEvidenceImage>>) {
  const id = randomUUID();
  const asset: EvidenceAsset = {
    id, tracker: session.tracker, cardId: session.cardId, submissionId: session.id,
    pathname: `quarantine/${session.tracker}/${id}.webp`,
    sha256: createHash('sha256').update(image.data).digest('hex'),
    size: image.data.length, width: image.width, height: image.height,
    createdAt: new Date().toISOString(), sessionExpiresAt: session.exp,
    scan: { status: 'pending', reason: 'awaiting-checks', policyVersion: 1 },
  };
  // Register first: interrupted uploads remain discoverable for reconciliation.
  await redis.set(evidenceKey(id), asset, { nx: true });
  await put(asset.pathname, image.data, {
    access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'image/webp',
    token: process.env.BLOB_READ_WRITE_TOKEN, abortSignal: AbortSignal.timeout(15000),
  });
  asset.scan = await saveEvidenceScan(redis, id, await scanEvidenceImage(image.data));
  return asset;
}

export async function storeTrustedEvidence(
  redis: Redis,
  session: Pick<SubmissionSession, 'id' | 'tracker' | 'cardId'> & { exp?: number },
  image: Awaited<ReturnType<typeof prepareEvidenceImage>>,
  reason: string,
) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const asset: EvidenceAsset = {
    id,
    tracker: session.tracker,
    cardId: session.cardId,
    submissionId: session.id,
    pathname: `quarantine/${session.tracker}/${id}.webp`,
    sha256: createHash('sha256').update(image.data).digest('hex'),
    size: image.data.length,
    width: image.width,
    height: image.height,
    createdAt,
    sessionExpiresAt: session.exp ?? Date.now() + 60 * 60 * 1000,
    scan: { status: 'clean', reason, checkedAt: createdAt, policyVersion: 1 },
  };

  if (!await redis.set(evidenceKey(id), asset, { nx: true })) throw new EvidenceUploadError('Evidence record collision. Retry the import.', 409);
  try {
    await put(asset.pathname, image.data, {
      access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'image/webp',
      token: process.env.BLOB_READ_WRITE_TOKEN, abortSignal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    await redis.del(evidenceKey(id));
    throw error;
  }
  return asset;
}

export async function saveEvidenceScan(redis: Redis, id: string, scan: EvidenceScan) {
  await redis.eval(COMMIT_EVIDENCE_SCAN, [evidenceKey(id)], [JSON.stringify(scan)]);
  const saved = await redis.get<EvidenceAsset>(evidenceKey(id));
  if (!saved) throw new EvidenceUploadError('Evidence record is unavailable', 503);
  return saved.scan;
}

export async function readEvidenceBytes(asset: EvidenceAsset) {
  // Never accept a caller-supplied storage URL/path.
  if (asset.pathname !== `quarantine/${asset.tracker}/${asset.id}.webp`) throw new EvidenceUploadError('Invalid evidence record', 409);
  const blob = await get(asset.pathname, { access: 'private', token: process.env.BLOB_READ_WRITE_TOKEN, abortSignal: AbortSignal.timeout(10000) });
  if (blob?.statusCode !== 200 || !blob.stream || blob.blob.size !== asset.size || asset.size > 4 * 1024 * 1024) {
    throw new EvidenceUploadError('Evidence file is unavailable', 503);
  }
  const reader = blob.stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > asset.size) throw new Error();
      chunks.push(part.value);
    }
  } finally { await reader.cancel(); }
  const bytes = Buffer.concat(chunks);
  if (bytes.length !== asset.size || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) {
    throw new EvidenceUploadError('Evidence integrity check failed', 409);
  }
  return bytes;
}

export async function getOwnedEvidence(redis: Redis, session: Pick<SubmissionSession, 'id' | 'tracker' | 'cardId'>, ids: string[]) {
  const assets: EvidenceAsset[] = [];
  for (const id of ids) {
    const asset = await redis.get<EvidenceAsset>(evidenceKey(id));
    if (!asset || asset.id !== id || asset.tracker !== session.tracker || asset.cardId !== session.cardId || asset.submissionId !== session.id) {
      throw new EvidenceUploadError('An attachment does not belong to this report. Upload it again.', 403);
    }
    assets.push(asset);
  }
  return assets;
}

export async function assertReportEvidenceClean(redis: Redis, tracker: string, report: DiscoverySubmission) {
  const urls = [...new Set([report.imageUrl, ...(report.evidenceImages || []).map((image) => image.url)].filter(Boolean) as string[])];
  const ids = urls.map(evidenceIdFromUrl);
  if (ids.some((id) => !id)) throw new EvidenceUploadError('External or legacy evidence must be uploaded through the protected form before approval.', 409);
  const assets = await getOwnedEvidence(redis, { id: report.id, tracker: report.originTrackerSlug || tracker, cardId: report.originCardId || report.cardId }, ids as string[]);
  if (assets.some((asset) => asset.scan.status !== 'clean' || asset.scan.policyVersion !== 1)) {
    throw new EvidenceUploadError('Evidence safety checks have not passed. This report remains pending.', 409);
  }
  return assets.map((asset) => evidenceUrl(asset.id));
}

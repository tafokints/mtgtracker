import sharp from 'sharp';
import { normalizeSourceUrl } from './evidence-policy';
import { EvidenceUploadError } from './evidence-upload';

export interface EvidenceScan {
  status: 'pending' | 'clean' | 'flagged' | 'error';
  reason: string;
  checkedAt?: string;
  policyVersion: 1;
}

function contentSafetyEndpoint() {
  try {
    const url = new URL(process.env.AZURE_CONTENT_SAFETY_ENDPOINT || '');
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !/^[a-z0-9-]+\.cognitiveservices\.azure\.com$/.test(url.hostname)) return undefined;
    return `${url.origin}/contentsafety/image:analyze?api-version=2024-09-01`;
  } catch { return undefined; }
}

export function isImageScanningConfigured() {
  return Boolean(process.env.CLOUDMERSIVE_API_KEY && process.env.AZURE_CONTENT_SAFETY_KEY && contentSafetyEndpoint());
}

export async function scanEvidenceImage(data: Buffer): Promise<EvidenceScan> {
  const checkedAt = new Date().toISOString();
  const result = (status: EvidenceScan['status'], reason: string): EvidenceScan => ({ status, reason, checkedAt, policyVersion: 1 });
  if (!isImageScanningConfigured()) return result('pending', 'scanners-not-configured');
  try {
    const form = new FormData();
    form.set('inputFile', new Blob([new Uint8Array(data)], { type: 'image/webp' }), 'evidence.webp');
    const antivirus = await fetch('https://api.cloudmersive.com/virus/scan/file', {
      method: 'POST', headers: { Apikey: process.env.CLOUDMERSIVE_API_KEY! }, body: form,
      redirect: 'error', signal: AbortSignal.timeout(15000), cache: 'no-store',
    });
    if (!antivirus.ok) throw new Error();
    const virusResult = await antivirus.json();
    if (virusResult.CleanResult === false) return result('flagged', 'malware-detected');
    if (virusResult.CleanResult !== true || (virusResult.FoundViruses && (!Array.isArray(virusResult.FoundViruses) || virusResult.FoundViruses.length))) throw new Error();

    // Azure accepts PNG, not WebP. Analyze a bounded derivative of the stored image.
    const png = await sharp(data).resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    if (png.length > 4 * 1024 * 1024) return result('error', 'moderation-image-too-large');
    const moderation = await fetch(contentSafetyEndpoint()!, {
      method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': process.env.AZURE_CONTENT_SAFETY_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: { content: png.toString('base64') }, categories: ['Sexual'], outputType: 'FourSeverityLevels' }),
      redirect: 'error', signal: AbortSignal.timeout(15000), cache: 'no-store',
    });
    if (!moderation.ok) throw new Error();
    const moderationResult = await moderation.json();
    const categories = moderationResult.categoriesAnalysis;
    if (!Array.isArray(categories)) throw new Error();
    const sexual = categories.filter((item) => item?.category === 'Sexual');
    if (sexual.length !== 1 || ![0, 2, 4, 6].includes(sexual[0].severity)) throw new Error();
    return sexual[0].severity > 0 ? result('flagged', 'sexual-content-review-required') : result('clean', 'checks-passed');
  } catch { return result('error', 'scanner-unavailable'); }
}

export async function checkSourceReputation(value: string) {
  const url = normalizeSourceUrl(value);
  if (!url || url !== value) throw new EvidenceUploadError('Source must be a supported direct HTTPS link', 409);
  if (!process.env.GOOGLE_WEB_RISK_API_KEY) throw new EvidenceUploadError('Link screening is not configured. This report remains pending.', 503);
  const endpoint = new URL('https://webrisk.googleapis.com/v1/uris:search');
  endpoint.searchParams.set('uri', url);
  for (const threat of ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE']) endpoint.searchParams.append('threatTypes', threat);
  try {
    const response = await fetch(endpoint, {
      headers: { 'X-Goog-Api-Key': process.env.GOOGLE_WEB_RISK_API_KEY },
      redirect: 'error', signal: AbortSignal.timeout(10000), cache: 'no-store',
    });
    if (!response.ok) throw new Error();
    const result = await response.json();
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error();
    if ('threat' in result) throw new EvidenceUploadError('Source link was flagged. This report cannot be approved.', 409);
    if (Object.keys(result).length !== 0) throw new Error();
  } catch (error) {
    if (error instanceof EvidenceUploadError) throw error;
    throw new EvidenceUploadError('Link screening is unavailable. This report remains pending.', 503);
  }
}

import { MAX_UPLOAD_BYTES, normalizeSourceUrl } from './evidence-policy';
import type { SourceType } from './types';

export function inferReportSourceType(link: string): SourceType {
  const normalized = normalizeSourceUrl(link.trim());
  if (!normalized) return 'other';
  const hostname = new URL(normalized).hostname.replace(/^www\./, '');
  if (['ebay.com', 'tcgplayer.com'].includes(hostname)) return 'marketplace';
  if (['psacard.com', 'cgccards.com'].includes(hostname)) return 'grading-pop';
  if (['reddit.com', 'x.com', 'twitter.com', 'instagram.com'].includes(hostname)) return 'social';
  if (hostname === 'magic.wizards.com') return 'article';
  return 'other';
}

// Convenience checks only; the server still decodes and screens actual image bytes.
export function evidenceFileError(file: { size: number; type: string }) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Use a JPEG, PNG, or WebP image.';
  if (file.size === 0) return 'This image is empty.';
  if (file.size > MAX_UPLOAD_BYTES) return 'Image must be 4 MB or smaller.';
  return undefined;
}

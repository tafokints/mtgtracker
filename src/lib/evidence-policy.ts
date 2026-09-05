export const MAX_EVIDENCE_IMAGES = 8;
export const EVIDENCE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function evidenceUrl(id: string) {
  return `/api/evidence/${id}`;
}

export function evidenceIdFromUrl(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/api/evidence/')) return undefined;
  const id = value.slice('/api/evidence/'.length);
  return EVIDENCE_ID.test(id) ? id : undefined;
}

// Only direct source pages, not redirectors, shorteners, or arbitrary image hosts.
const SOURCE_PATHS: Record<string, RegExp> = {
  'ebay.com': /^\/itm\/(?:[^/]+\/)?\d{9,15}\/?$/,
  'www.ebay.com': /^\/itm\/(?:[^/]+\/)?\d{9,15}\/?$/,
  'tcgplayer.com': /^\/product\/\d+(?:\/[a-zA-Z0-9-]+)*\/?$/,
  'www.tcgplayer.com': /^\/product\/\d+(?:\/[a-zA-Z0-9-]+)*\/?$/,
  'reddit.com': /^\/r\/[\w]+\/comments\/[a-z0-9]+(?:\/[\w-]+)*\/?$/i,
  'www.reddit.com': /^\/r\/[\w]+\/comments\/[a-z0-9]+(?:\/[\w-]+)*\/?$/i,
  'x.com': /^\/[\w]+\/status\/\d+\/?$/,
  'twitter.com': /^\/[\w]+\/status\/\d+\/?$/,
  'www.instagram.com': /^\/(?:p|reel)\/[\w-]+\/?$/,
  'www.psacard.com': /^\/cert\/[a-zA-Z0-9/.-]+$/,
  'www.cgccards.com': /^\/certlookup\/[a-zA-Z0-9/.-]+$/,
  'magic.wizards.com': /^\/en\/news\/[a-zA-Z0-9/-]+$/,
};

export function normalizeSourceUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\\]/.test(value)) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !SOURCE_PATHS[url.hostname]?.test(url.pathname)) return undefined;
    // Tracking and arbitrary redirect parameters are never retained.
    url.search = '';
    url.hash = '';
    return url.href;
  } catch { return undefined; }
}

import { NextResponse } from 'next/server';
import { isAffiliatePlacement } from '@/lib/affiliate-placements';
import { getRedis } from '@/lib/redis';
import { readJsonBody } from '@/lib/request-json';
import { AffiliateLink, defaultAffiliateLinks, getTracker, trackers } from '@/lib/trackers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MERCHANTS: AffiliateLink['merchant'][] = ['tcgplayer', 'ebay', 'amazon', 'other'];
const PROMOTION_CAMPAIGN = 'discovery_promotion';
const PROMOTION_SOURCES = ['admin_copy', 'x', 'reddit'] as const;

function getAllowedLinks(trackerSlug: string) {
  if (trackerSlug === 'default') {
    return defaultAffiliateLinks;
  }

  const tracker = getTracker(trackerSlug);
  if (!tracker) return [];

  return tracker.affiliateLinks && tracker.affiliateLinks.length > 0
    ? tracker.affiliateLinks
    : defaultAffiliateLinks;
}

function getAllowedAffiliateLink(trackerSlug: string, merchant: string, href: string) {
  const allowedLinks = getAllowedLinks(trackerSlug);
  const exactLink = allowedLinks.find((link) => link.href === href && link.merchant === merchant);
  if (exactLink) {
    return exactLink;
  }

  if (merchant !== 'ebay') {
    return undefined;
  }

  const baseEbayLink = allowedLinks.find((link) => link.merchant === 'ebay');
  if (!baseEbayLink) {
    return undefined;
  }

  try {
    const candidateUrl = new URL(href);
    const baseUrl = new URL(baseEbayLink.href);

    if (!/(^|\.)ebay\.com$/.test(candidateUrl.hostname)) return undefined;
    if (candidateUrl.protocol !== 'https:') return undefined;
    if (candidateUrl.pathname !== baseUrl.pathname) return undefined;
    if (candidateUrl.searchParams.get('mkcid') !== baseUrl.searchParams.get('mkcid')) return undefined;
    if (candidateUrl.searchParams.get('mkrid') !== baseUrl.searchParams.get('mkrid')) return undefined;
    if (candidateUrl.searchParams.get('siteid') !== baseUrl.searchParams.get('siteid')) return undefined;
    if (candidateUrl.searchParams.get('campid') !== baseUrl.searchParams.get('campid')) return undefined;
    if (candidateUrl.searchParams.get('customid') !== baseUrl.searchParams.get('customid')) return undefined;
    if (candidateUrl.searchParams.get('mkevt') !== baseUrl.searchParams.get('mkevt')) return undefined;
    if (candidateUrl.searchParams.get('toolid') !== baseUrl.searchParams.get('toolid')) return undefined;
    if (!candidateUrl.searchParams.get('_nkw')) return undefined;

    return baseEbayLink;
  } catch {
    return undefined;
  }
}

function isKnownTrackerSlug(trackerSlug: string) {
  return trackerSlug === 'default' || trackers.some((tracker) => tracker.slug === trackerSlug);
}

function safeKeyPart(value: string) {
  return value.replace(/[^a-z0-9._-]/gi, '-');
}

function readPromotionSource(sourcePath?: string) {
  if (!sourcePath || !sourcePath.startsWith('/') || sourcePath.startsWith('//')) {
    return undefined;
  }

  try {
    const url = new URL(sourcePath, 'https://mtgtrackers.com');
    const source = url.searchParams.get('utm_source') || '';

    if (url.searchParams.get('utm_campaign') !== PROMOTION_CAMPAIGN) {
      return undefined;
    }

    return PROMOTION_SOURCES.includes(source as typeof PROMOTION_SOURCES[number])
      ? source
      : undefined;
  } catch {
    return undefined;
  }
}

function sanitizeViewContext(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const input = value as Record<string, unknown>;
  const context = {
    query: typeof input.query === 'string' ? input.query.slice(0, 80) : undefined,
    filter: typeof input.filter === 'string' ? input.filter.slice(0, 80) : undefined,
    sort: typeof input.sort === 'string' ? input.sort.slice(0, 80) : undefined,
    cardFilter: typeof input.cardFilter === 'string' ? input.cardFilter.slice(0, 80) : undefined,
    card: typeof input.card === 'string' ? input.card.slice(0, 80) : undefined,
    serial: typeof input.serial === 'string' ? input.serial.slice(0, 24) : undefined,
    slot: typeof input.slot === 'string' ? input.slot.slice(0, 24) : undefined,
  };
  const entries = Object.entries(context).filter(([, item]) => Boolean(item));

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const input = body.value as {
    tracker?: unknown;
    merchant?: unknown;
    href?: unknown;
    label?: unknown;
    intent?: unknown;
    placement?: unknown;
    sourcePath?: unknown;
    viewContext?: unknown;
  };

  const trackerSlug = typeof input.tracker === 'string' ? input.tracker : '';
  const merchant = typeof input.merchant === 'string' ? input.merchant : '';
  const href = typeof input.href === 'string' ? input.href : '';
  const label = typeof input.label === 'string' ? input.label.slice(0, 120) : undefined;
  const placement = typeof input.placement === 'string' ? input.placement.slice(0, 80) : '';
  const sourcePath = typeof input.sourcePath === 'string' ? input.sourcePath.slice(0, 200) : undefined;
  const viewContext = sanitizeViewContext(input.viewContext);

  if (!trackerSlug || !isKnownTrackerSlug(trackerSlug)) {
    return NextResponse.json({ message: 'Unknown tracker' }, { status: 400 });
  }

  if (!MERCHANTS.includes(merchant as AffiliateLink['merchant'])) {
    return NextResponse.json({ message: 'Unknown merchant' }, { status: 400 });
  }

  if (!isAffiliatePlacement(placement)) {
    return NextResponse.json({ message: 'Unknown affiliate placement' }, { status: 400 });
  }

  const allowedLink = getAllowedAffiliateLink(trackerSlug, merchant, href);
  if (!allowedLink) {
    return NextResponse.json({ message: 'Unknown affiliate link' }, { status: 400 });
  }

  try {
    const redis = getRedis();
    const date = new Date().toISOString().slice(0, 10);
    const keyParts = [trackerSlug, merchant, placement].map(safeKeyPart);
    const contextCounterIncrements: Array<Promise<unknown>> = [];
    const promotionSource = readPromotionSource(sourcePath);
    const addContextCounter = (field: 'filter' | 'sort' | 'cardFilter' | 'card' | 'serial', value?: unknown) => {
      if (typeof value !== 'string' || !value) return;

      const contextKeyParts = [trackerSlug, field, value].map(safeKeyPart);
      contextCounterIncrements.push(
        redis.incr(`affiliate:context:${date}:${contextKeyParts.join(':')}`),
        redis.incr(`affiliate:context:total:${contextKeyParts.join(':')}`)
      );
    };

    addContextCounter('filter', viewContext?.filter);
    addContextCounter('sort', viewContext?.sort);
    addContextCounter('cardFilter', viewContext?.cardFilter);
    addContextCounter('card', viewContext?.card);
    addContextCounter('serial', viewContext?.serial);

    await Promise.all([
      redis.incr(`affiliate:clicks:${date}:${keyParts.join(':')}`),
      redis.incr(`affiliate:clicks:total:${keyParts.join(':')}`),
      ...(promotionSource ? [
        redis.incr(`affiliate:promotion-source:${date}:${safeKeyPart(promotionSource)}`),
        redis.incr(`affiliate:promotion-source:total:${safeKeyPart(promotionSource)}`),
      ] : []),
      redis.set(`affiliate:last-click:${keyParts.join(':')}`, {
        tracker: trackerSlug,
        merchant,
        label: label || allowedLink.label,
        href,
        intent: allowedLink.intent,
        placement,
        sourcePath,
        viewContext,
        clickedAt: new Date().toISOString(),
      }),
      ...contextCounterIncrements,
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error tracking affiliate click:', error);
    return NextResponse.json({ message: 'Affiliate click tracking failed' }, { status: 500 });
  }
}

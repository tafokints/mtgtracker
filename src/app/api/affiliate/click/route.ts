import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { readJsonBody } from '@/lib/request-json';
import { AffiliateLink, defaultAffiliateLinks, getTracker, trackers } from '@/lib/trackers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MERCHANTS: AffiliateLink['merchant'][] = ['tcgplayer', 'ebay', 'amazon', 'other'];

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

function isKnownTrackerSlug(trackerSlug: string) {
  return trackerSlug === 'default' || trackers.some((tracker) => tracker.slug === trackerSlug);
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
  };

  const trackerSlug = typeof input.tracker === 'string' ? input.tracker : '';
  const merchant = typeof input.merchant === 'string' ? input.merchant : '';
  const href = typeof input.href === 'string' ? input.href : '';
  const label = typeof input.label === 'string' ? input.label.slice(0, 120) : undefined;
  const placement = typeof input.placement === 'string' ? input.placement.slice(0, 80) : 'unknown';
  const sourcePath = typeof input.sourcePath === 'string' ? input.sourcePath.slice(0, 200) : undefined;

  if (!trackerSlug || !isKnownTrackerSlug(trackerSlug)) {
    return NextResponse.json({ message: 'Unknown tracker' }, { status: 400 });
  }

  if (!MERCHANTS.includes(merchant as AffiliateLink['merchant'])) {
    return NextResponse.json({ message: 'Unknown merchant' }, { status: 400 });
  }

  const allowedLink = getAllowedLinks(trackerSlug).find((link) => link.href === href && link.merchant === merchant);
  if (!allowedLink) {
    return NextResponse.json({ message: 'Unknown affiliate link' }, { status: 400 });
  }

  try {
    const redis = getRedis();
    const date = new Date().toISOString().slice(0, 10);
    const keyParts = [trackerSlug, merchant, placement].map((part) => part.replace(/[^a-z0-9._-]/gi, '-'));

    await Promise.all([
      redis.incr(`affiliate:clicks:${date}:${keyParts.join(':')}`),
      redis.incr(`affiliate:clicks:total:${keyParts.join(':')}`),
      redis.set(`affiliate:last-click:${keyParts.join(':')}`, {
        tracker: trackerSlug,
        merchant,
        label: label || allowedLink.label,
        intent: allowedLink.intent,
        placement,
        sourcePath,
        clickedAt: new Date().toISOString(),
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error tracking affiliate click:', error);
    return NextResponse.json({ message: 'Affiliate click tracking failed' }, { status: 500 });
  }
}

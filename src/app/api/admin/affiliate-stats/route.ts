import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getRedis } from '@/lib/redis';
import { defaultAffiliateLinks, trackers } from '@/lib/trackers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;
const PLACEMENTS = ['tracker-marketplace', 'marketplace-links'];

function dateKey(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function readCount(value: unknown) {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const requestedDays = Number(request.nextUrl.searchParams.get('days') || DEFAULT_DAYS);
  const days = Number.isInteger(requestedDays)
    ? Math.min(Math.max(requestedDays, 1), MAX_DAYS)
    : DEFAULT_DAYS;

  try {
    const redis = getRedis();
    const trackerEntries = [
      { slug: 'default', title: 'Default Links', affiliateLinks: defaultAffiliateLinks },
      ...trackers.map((tracker) => ({
        slug: tracker.slug,
        title: tracker.title,
        affiliateLinks: tracker.affiliateLinks && tracker.affiliateLinks.length > 0
          ? tracker.affiliateLinks
          : defaultAffiliateLinks,
      })),
    ];
    const dateKeys = Array.from({ length: days }, (_, index) => dateKey(index));
    const rows = [];

    for (const tracker of trackerEntries) {
      for (const link of tracker.affiliateLinks) {
        for (const placement of PLACEMENTS) {
          const keyParts = [tracker.slug, link.merchant, placement].map((part) => part.replace(/[^a-z0-9._-]/gi, '-'));
          const keySuffix = keyParts.join(':');
          const [totalValue, lastClickValue, ...dailyValues] = await Promise.all([
            redis.get(`affiliate:clicks:total:${keySuffix}`),
            redis.get(`affiliate:last-click:${keySuffix}`),
            ...dateKeys.map((date) => redis.get(`affiliate:clicks:${date}:${keySuffix}`)),
          ]);
          const daily = dateKeys.map((date, index) => ({
            date,
            clicks: readCount(dailyValues[index]),
          }));
          const clicksInWindow = daily.reduce((total, item) => total + item.clicks, 0);
          const totalClicks = readCount(totalValue);

          if (totalClicks === 0 && clicksInWindow === 0) {
            continue;
          }

          rows.push({
            tracker: tracker.slug,
            trackerTitle: tracker.title,
            merchant: link.merchant,
            label: link.label,
            href: link.href,
            placement,
            clicksInWindow,
            totalClicks,
            lastClick: lastClickValue || null,
            daily,
          });
        }
      }
    }

    rows.sort((a, b) => b.clicksInWindow - a.clicksInWindow || b.totalClicks - a.totalClicks);

    return NextResponse.json({
      days,
      generatedAt: new Date().toISOString(),
      rows,
    });
  } catch (error) {
    console.error('Error loading affiliate stats:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getRedis } from '@/lib/redis';
import { defaultAffiliateLinks, trackers } from '@/lib/trackers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;
const PLACEMENTS = ['tracker-top-cta', 'tracker-directory', 'tracker-marketplace', 'marketplace-links'];

function dateKey(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function readCount(value: unknown) {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function summarizeRows(rows: Array<{
  tracker: string;
  trackerTitle: string;
  merchant: string;
  intent: string;
  placement: string;
  clicksInWindow: number;
  totalClicks: number;
}>) {
  const byTracker = new Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>();
  const byMerchant = new Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>();
  const byIntent = new Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>();
  const byPlacement = new Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>();

  const add = (
    map: Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>,
    key: string,
    label: string,
    row: { clicksInWindow: number; totalClicks: number }
  ) => {
    const current = map.get(key) || { key, label, clicksInWindow: 0, totalClicks: 0 };
    current.clicksInWindow += row.clicksInWindow;
    current.totalClicks += row.totalClicks;
    map.set(key, current);
  };
  const sortBreakdown = (items: Iterable<{ key: string; label: string; clicksInWindow: number; totalClicks: number }>) => (
    [...items].sort((a, b) => b.clicksInWindow - a.clicksInWindow || b.totalClicks - a.totalClicks || a.label.localeCompare(b.label))
  );

  for (const row of rows) {
    add(byTracker, row.tracker, row.trackerTitle, row);
    add(byMerchant, row.merchant, row.merchant, row);
    add(byIntent, row.intent, row.intent, row);
    add(byPlacement, row.placement, row.placement, row);
  }

  const clicksInWindow = rows.reduce((total, row) => total + row.clicksInWindow, 0);
  const totalClicks = rows.reduce((total, row) => total + row.totalClicks, 0);

  return {
    clicksInWindow,
    totalClicks,
    bestTracker: sortBreakdown(byTracker.values())[0] || null,
    bestMerchant: sortBreakdown(byMerchant.values())[0] || null,
    bestIntent: sortBreakdown(byIntent.values())[0] || null,
    bestPlacement: sortBreakdown(byPlacement.values())[0] || null,
    byTracker: sortBreakdown(byTracker.values()),
    byMerchant: sortBreakdown(byMerchant.values()),
    byIntent: sortBreakdown(byIntent.values()),
    byPlacement: sortBreakdown(byPlacement.values()),
  };
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
            intent: link.intent,
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
      summary: summarizeRows(rows),
      rows,
    });
  } catch (error) {
    console.error('Error loading affiliate stats:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

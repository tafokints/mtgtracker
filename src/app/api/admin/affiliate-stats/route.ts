import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getRedis } from '@/lib/redis';
import { defaultAffiliateLinks, trackers } from '@/lib/trackers';
import { formatTrackerSerial, getTrackerCardDefinitions } from '@/lib/tracker-data';
import { getAffiliateCoverageRows, getAffiliateCoverageSummary } from '@/lib/affiliate-coverage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;
const PLACEMENTS = ['tracker-top-cta', 'tracker-filtered-cta', 'tracker-stats-cta', 'tracker-directory', 'tracker-marketplace', 'tracker-card-serial', 'serial-detail', 'marketplace-links'];
const PROMOTION_ACTIONS = ['copy', 'native-share', 'x', 'reddit'];
const PROMOTION_SOURCES = ['admin_copy', 'x', 'reddit'];
const DIRECTORY_ACTIONS = ['open-tracker', 'report-find', 'latest-discovery'];
const VIEW_FILTERS = [
  'found',
  'pending',
  'confirmed',
  'source-linked',
  'has-evidence',
  'source-marketplace',
  'source-grading-pop',
  'source-social',
  'source-article',
  'source-private-sale',
  'source-other',
  'not-found',
];
const VIEW_SORTS = ['id-desc', 'price-desc', 'price-asc', 'date-desc', 'date-asc', 'evidence-desc'];

interface AffiliateStatsTrackerEntry {
  slug: string;
  title: string;
  affiliateLinks: typeof defaultAffiliateLinks;
  cardFilterValues: string[];
  cardValues: string[];
  serialValues: string[];
}

interface RedisCounterReader {
  get(key: string): Promise<unknown>;
}

function dateKey(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function readCount(value: unknown) {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function safeKeyPart(value: string) {
  return value.replace(/[^a-z0-9._-]/gi, '-');
}

function addBreakdown(
  map: Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>,
  key: string,
  label: string,
  row: { clicksInWindow: number; totalClicks: number }
) {
  const current = map.get(key) || { key, label, clicksInWindow: 0, totalClicks: 0 };
  current.clicksInWindow += row.clicksInWindow;
  current.totalClicks += row.totalClicks;
  map.set(key, current);
}

function sortBreakdown(items: Iterable<{ key: string; label: string; clicksInWindow: number; totalClicks: number }>) {
  return [...items].sort((a, b) => b.clicksInWindow - a.clicksInWindow || b.totalClicks - a.totalClicks || a.label.localeCompare(b.label));
}

function actionLabel(action: string) {
  return action === 'x'
    ? 'X'
    : action.split(/[-_]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function readLastClickViewContext(lastClick: unknown) {
  if (!lastClick || typeof lastClick !== 'object' || Array.isArray(lastClick)) {
    return undefined;
  }

  const value = lastClick as { viewContext?: unknown };
  if (!value.viewContext || typeof value.viewContext !== 'object' || Array.isArray(value.viewContext)) {
    return undefined;
  }

  return value.viewContext as {
    filter?: string;
    sort?: string;
    cardFilter?: string;
    card?: string;
    serial?: string;
  };
}

function summarizeRows(rows: Array<{
  tracker: string;
  trackerTitle: string;
  merchant: string;
  intent: string;
  placement: string;
  clicksInWindow: number;
  totalClicks: number;
  lastClick?: unknown;
}>) {
  const byTracker = new Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>();
  const byMerchant = new Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>();
  const byIntent = new Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>();
  const byPlacement = new Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>();
  const byLastClickFilter = new Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>();
  const byLastClickSort = new Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>();
  const byLastClickCardFilter = new Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>();
  const byLastClickCard = new Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>();
  const byLastClickSerial = new Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>();

  for (const row of rows) {
    addBreakdown(byTracker, row.tracker, row.trackerTitle, row);
    addBreakdown(byMerchant, row.merchant, row.merchant, row);
    addBreakdown(byIntent, row.intent, row.intent, row);
    addBreakdown(byPlacement, row.placement, row.placement, row);

    const viewContext = readLastClickViewContext(row.lastClick);
    if (viewContext?.filter) {
      addBreakdown(byLastClickFilter, viewContext.filter, viewContext.filter, row);
    }
    if (viewContext?.sort) {
      addBreakdown(byLastClickSort, viewContext.sort, viewContext.sort, row);
    }
    if (viewContext?.cardFilter) {
      addBreakdown(byLastClickCardFilter, viewContext.cardFilter, viewContext.cardFilter, row);
    }
    if (viewContext?.card) {
      addBreakdown(byLastClickCard, viewContext.card, viewContext.card, row);
    }
    if (viewContext?.serial) {
      addBreakdown(byLastClickSerial, viewContext.serial, viewContext.serial, row);
    }
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
    byLastClickFilter: sortBreakdown(byLastClickFilter.values()),
    byLastClickSort: sortBreakdown(byLastClickSort.values()),
    byLastClickCardFilter: sortBreakdown(byLastClickCardFilter.values()),
    byLastClickCard: sortBreakdown(byLastClickCard.values()),
    byLastClickSerial: sortBreakdown(byLastClickSerial.values()),
  };
}

function readBreakdownCount(
  breakdowns: Array<{ key: string; clicksInWindow: number; totalClicks: number }>,
  key: string,
) {
  return breakdowns.find((item) => item.key === key) || { clicksInWindow: 0, totalClicks: 0 };
}

function sourceFromAction(action: string) {
  return action === 'copy' ? 'admin_copy' : action;
}

function buildPromotionEfficiency(
  promotionTrackers: Array<{ key: string; label: string; clicksInWindow: number; totalClicks: number }>,
  promotionVisitTrackers: Array<{ key: string; label: string; clicksInWindow: number; totalClicks: number }>,
  affiliateTrackers: Array<{ key: string; label: string; clicksInWindow: number; totalClicks: number }>,
) {
  const trackerKeys = new Set([
    ...promotionTrackers.map((tracker) => tracker.key),
    ...promotionVisitTrackers.map((tracker) => tracker.key),
    ...affiliateTrackers.filter((tracker) => tracker.key !== 'default').map((tracker) => tracker.key),
  ]);

  return [...trackerKeys]
    .map((key) => {
      const promotion = readBreakdownCount(promotionTrackers, key);
      const visits = readBreakdownCount(promotionVisitTrackers, key);
      const affiliate = readBreakdownCount(affiliateTrackers, key);
      const label = promotionTrackers.find((tracker) => tracker.key === key)?.label
        || promotionVisitTrackers.find((tracker) => tracker.key === key)?.label
        || affiliateTrackers.find((tracker) => tracker.key === key)?.label
        || key;

      return {
        key,
        label,
        promotionActionsInWindow: promotion.clicksInWindow,
        promotionActionsTotal: promotion.totalClicks,
        promotionVisitsInWindow: visits.clicksInWindow,
        promotionVisitsTotal: visits.totalClicks,
        affiliateClicksInWindow: affiliate.clicksInWindow,
        affiliateClicksTotal: affiliate.totalClicks,
        affiliateClicksPerActionInWindow: promotion.clicksInWindow > 0
          ? Number((affiliate.clicksInWindow / promotion.clicksInWindow).toFixed(2))
          : null,
        affiliateClicksPerActionTotal: promotion.totalClicks > 0
          ? Number((affiliate.totalClicks / promotion.totalClicks).toFixed(2))
          : null,
        affiliateClicksPerVisitInWindow: visits.clicksInWindow > 0
          ? Number((affiliate.clicksInWindow / visits.clicksInWindow).toFixed(2))
          : null,
        affiliateClicksPerVisitTotal: visits.totalClicks > 0
          ? Number((affiliate.totalClicks / visits.totalClicks).toFixed(2))
          : null,
      };
    })
    .sort((a, b) => (
      (b.affiliateClicksPerVisitInWindow || 0) - (a.affiliateClicksPerVisitInWindow || 0) ||
      (b.affiliateClicksPerActionInWindow || 0) - (a.affiliateClicksPerActionInWindow || 0) ||
      b.affiliateClicksInWindow - a.affiliateClicksInWindow ||
      b.promotionVisitsInWindow - a.promotionVisitsInWindow ||
      b.promotionActionsInWindow - a.promotionActionsInWindow ||
      a.label.localeCompare(b.label)
    ));
}

function buildPromotionSourceEfficiency(
  promotionActions: Array<{ key: string; label: string; clicksInWindow: number; totalClicks: number }>,
  promotionVisitSources: Array<{ key: string; label: string; clicksInWindow: number; totalClicks: number }>,
  affiliatePromotionSources: Array<{ key: string; label: string; clicksInWindow: number; totalClicks: number }>,
) {
  const actionBySource = promotionActions.map((action) => ({
    ...action,
    key: sourceFromAction(action.key),
    label: actionLabel(sourceFromAction(action.key)),
  }));
  const sourceKeys = new Set([
    ...actionBySource.map((source) => source.key),
    ...promotionVisitSources.map((source) => source.key),
    ...affiliatePromotionSources.map((source) => source.key),
  ]);

  return [...sourceKeys]
    .map((key) => {
      const action = readBreakdownCount(actionBySource, key);
      const visits = readBreakdownCount(promotionVisitSources, key);
      const affiliate = readBreakdownCount(affiliatePromotionSources, key);
      const label = actionBySource.find((source) => source.key === key)?.label
        || promotionVisitSources.find((source) => source.key === key)?.label
        || affiliatePromotionSources.find((source) => source.key === key)?.label
        || actionLabel(key);

      return {
        key,
        label,
        promotionActionsInWindow: action.clicksInWindow,
        promotionActionsTotal: action.totalClicks,
        promotionVisitsInWindow: visits.clicksInWindow,
        promotionVisitsTotal: visits.totalClicks,
        affiliateClicksInWindow: affiliate.clicksInWindow,
        affiliateClicksTotal: affiliate.totalClicks,
        affiliateClicksPerActionInWindow: action.clicksInWindow > 0
          ? Number((affiliate.clicksInWindow / action.clicksInWindow).toFixed(2))
          : null,
        affiliateClicksPerActionTotal: action.totalClicks > 0
          ? Number((affiliate.totalClicks / action.totalClicks).toFixed(2))
          : null,
        affiliateClicksPerVisitInWindow: visits.clicksInWindow > 0
          ? Number((affiliate.clicksInWindow / visits.clicksInWindow).toFixed(2))
          : null,
        affiliateClicksPerVisitTotal: visits.totalClicks > 0
          ? Number((affiliate.totalClicks / visits.totalClicks).toFixed(2))
          : null,
      };
    })
    .sort((a, b) => (
      (b.affiliateClicksPerVisitInWindow || 0) - (a.affiliateClicksPerVisitInWindow || 0) ||
      (b.affiliateClicksPerActionInWindow || 0) - (a.affiliateClicksPerActionInWindow || 0) ||
      b.affiliateClicksInWindow - a.affiliateClicksInWindow ||
      b.promotionVisitsInWindow - a.promotionVisitsInWindow ||
      b.promotionActionsInWindow - a.promotionActionsInWindow ||
      a.label.localeCompare(b.label)
    ));
}

async function readViewContextBreakdown(
  redis: RedisCounterReader,
  trackerEntries: AffiliateStatsTrackerEntry[],
  dateKeys: string[],
  field: 'filter' | 'sort' | 'cardFilter' | 'card' | 'serial',
  getValues: (tracker: AffiliateStatsTrackerEntry) => string[]
) {
  const byValue = new Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>();

  for (const tracker of trackerEntries) {
    for (const value of getValues(tracker)) {
      const keyParts = [tracker.slug, field, value].map(safeKeyPart);
      const keySuffix = keyParts.join(':');
      const [totalValue, ...dailyValues] = await Promise.all([
        redis.get(`affiliate:context:total:${keySuffix}`),
        ...dateKeys.map((date) => redis.get(`affiliate:context:${date}:${keySuffix}`)),
      ]);
      const clicksInWindow = dailyValues.reduce<number>((total, item) => total + readCount(item), 0);
      const totalClicks = readCount(totalValue);

      if (totalClicks === 0 && clicksInWindow === 0) {
        continue;
      }

      addBreakdown(byValue, value, value, { clicksInWindow, totalClicks });
    }
  }

  return sortBreakdown(byValue.values());
}

async function readViewContextBreakdowns(redis: RedisCounterReader, trackerEntries: AffiliateStatsTrackerEntry[], dateKeys: string[]) {
  const [byViewFilter, byViewSort, byViewCardFilter, byViewCard, byViewSerial] = await Promise.all([
    readViewContextBreakdown(redis, trackerEntries, dateKeys, 'filter', () => VIEW_FILTERS),
    readViewContextBreakdown(redis, trackerEntries, dateKeys, 'sort', () => VIEW_SORTS),
    readViewContextBreakdown(redis, trackerEntries, dateKeys, 'cardFilter', (tracker) => tracker.cardFilterValues),
    readViewContextBreakdown(redis, trackerEntries, dateKeys, 'card', (tracker) => tracker.cardValues),
    readViewContextBreakdown(redis, trackerEntries, dateKeys, 'serial', (tracker) => tracker.serialValues),
  ]);

  return {
    byViewFilter,
    byViewSort,
    byViewCardFilter,
    byViewCard,
    byViewSerial,
  };
}

async function readPromotionStats(redis: RedisCounterReader, trackerEntries: AffiliateStatsTrackerEntry[], dateKeys: string[]) {
  const rows = [];

  for (const tracker of trackerEntries.filter((entry) => entry.slug !== 'default')) {
    for (const action of PROMOTION_ACTIONS) {
      const keyParts = [tracker.slug, action].map(safeKeyPart);
      const keySuffix = keyParts.join(':');
      const [totalValue, lastActionValue, ...dailyValues] = await Promise.all([
        redis.get(`promotion:actions:total:${keySuffix}`),
        redis.get(`promotion:last-action:${keySuffix}`),
        ...dateKeys.map((date) => redis.get(`promotion:actions:${date}:${keySuffix}`)),
      ]);
      const clicksInWindow = dailyValues.reduce<number>((total, item) => total + readCount(item), 0);
      const totalClicks = readCount(totalValue);

      if (clicksInWindow === 0 && totalClicks === 0) {
        continue;
      }

      rows.push({
        tracker: tracker.slug,
        trackerTitle: tracker.title,
        action,
        label: actionLabel(action),
        clicksInWindow,
        totalClicks,
        lastAction: lastActionValue || null,
      });
    }
  }

  const byTracker = new Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>();
  const byAction = new Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>();

  for (const row of rows) {
    addBreakdown(byTracker, row.tracker, row.trackerTitle, row);
    addBreakdown(byAction, row.action, row.label, row);
  }

  return {
    rows: rows.sort((a, b) => b.clicksInWindow - a.clicksInWindow || b.totalClicks - a.totalClicks),
    summary: {
      clicksInWindow: rows.reduce((total, row) => total + row.clicksInWindow, 0),
      totalClicks: rows.reduce((total, row) => total + row.totalClicks, 0),
      byTracker: sortBreakdown(byTracker.values()),
      byAction: sortBreakdown(byAction.values()),
    },
  };
}

async function readPromotionVisitStats(redis: RedisCounterReader, trackerEntries: AffiliateStatsTrackerEntry[], dateKeys: string[]) {
  const rows = [];

  for (const tracker of trackerEntries.filter((entry) => entry.slug !== 'default')) {
    for (const source of PROMOTION_SOURCES) {
      const keyParts = [tracker.slug, source].map(safeKeyPart);
      const keySuffix = keyParts.join(':');
      const [totalValue, lastVisitValue, ...dailyValues] = await Promise.all([
        redis.get(`promotion:visits:total:${keySuffix}`),
        redis.get(`promotion:last-visit:${keySuffix}`),
        ...dateKeys.map((date) => redis.get(`promotion:visits:${date}:${keySuffix}`)),
      ]);
      const clicksInWindow = dailyValues.reduce<number>((total, item) => total + readCount(item), 0);
      const totalClicks = readCount(totalValue);

      if (clicksInWindow === 0 && totalClicks === 0) {
        continue;
      }

      rows.push({
        tracker: tracker.slug,
        trackerTitle: tracker.title,
        source,
        label: actionLabel(source),
        clicksInWindow,
        totalClicks,
        lastVisit: lastVisitValue || null,
      });
    }
  }

  const byTracker = new Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>();
  const bySource = new Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>();

  for (const row of rows) {
    addBreakdown(byTracker, row.tracker, row.trackerTitle, row);
    addBreakdown(bySource, row.source, row.label, row);
  }

  return {
    rows: rows.sort((a, b) => b.clicksInWindow - a.clicksInWindow || b.totalClicks - a.totalClicks),
    summary: {
      clicksInWindow: rows.reduce((total, row) => total + row.clicksInWindow, 0),
      totalClicks: rows.reduce((total, row) => total + row.totalClicks, 0),
      byTracker: sortBreakdown(byTracker.values()),
      bySource: sortBreakdown(bySource.values()),
    },
  };
}

async function readAffiliatePromotionSourceStats(redis: RedisCounterReader, dateKeys: string[]) {
  const rows = [];

  for (const source of PROMOTION_SOURCES) {
    const key = safeKeyPart(source);
    const [totalValue, ...dailyValues] = await Promise.all([
      redis.get(`affiliate:promotion-source:total:${key}`),
      ...dateKeys.map((date) => redis.get(`affiliate:promotion-source:${date}:${key}`)),
    ]);
    const clicksInWindow = dailyValues.reduce<number>((total, item) => total + readCount(item), 0);
    const totalClicks = readCount(totalValue);

    if (clicksInWindow === 0 && totalClicks === 0) {
      continue;
    }

    rows.push({
      key: source,
      label: actionLabel(source),
      clicksInWindow,
      totalClicks,
    });
  }

  return sortBreakdown(rows);
}

async function readDirectoryCtaStats(redis: RedisCounterReader, trackerEntries: AffiliateStatsTrackerEntry[], dateKeys: string[]) {
  const rows = [];

  for (const tracker of trackerEntries.filter((entry) => entry.slug !== 'default')) {
    for (const action of DIRECTORY_ACTIONS) {
      const keyParts = [tracker.slug, action].map(safeKeyPart);
      const keySuffix = keyParts.join(':');
      const [totalValue, lastClickValue, ...dailyValues] = await Promise.all([
        redis.get(`directory:clicks:total:${keySuffix}`),
        redis.get(`directory:last-click:${keySuffix}`),
        ...dateKeys.map((date) => redis.get(`directory:clicks:${date}:${keySuffix}`)),
      ]);
      const clicksInWindow = dailyValues.reduce<number>((total, item) => total + readCount(item), 0);
      const totalClicks = readCount(totalValue);

      if (clicksInWindow === 0 && totalClicks === 0) {
        continue;
      }

      rows.push({
        tracker: tracker.slug,
        trackerTitle: tracker.title,
        action,
        label: actionLabel(action),
        clicksInWindow,
        totalClicks,
        lastClick: lastClickValue || null,
      });
    }
  }

  const byTracker = new Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>();
  const byAction = new Map<string, { key: string; label: string; clicksInWindow: number; totalClicks: number }>();

  for (const row of rows) {
    addBreakdown(byTracker, row.tracker, row.trackerTitle, row);
    addBreakdown(byAction, row.action, row.label, row);
  }

  return {
    rows: rows.sort((a, b) => b.clicksInWindow - a.clicksInWindow || b.totalClicks - a.totalClicks),
    summary: {
      clicksInWindow: rows.reduce((total, row) => total + row.clicksInWindow, 0),
      totalClicks: rows.reduce((total, row) => total + row.totalClicks, 0),
      byTracker: sortBreakdown(byTracker.values()),
      byAction: sortBreakdown(byAction.values()),
    },
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
      {
        slug: 'default',
        title: 'Default Links',
        affiliateLinks: defaultAffiliateLinks,
        cardFilterValues: ['all'],
        cardValues: [],
        serialValues: [],
      },
      ...trackers.map((tracker) => {
        const cardDefinitions = getTrackerCardDefinitions(tracker);

        return {
          slug: tracker.slug,
          title: tracker.title,
          affiliateLinks: tracker.affiliateLinks && tracker.affiliateLinks.length > 0
            ? tracker.affiliateLinks
            : defaultAffiliateLinks,
          cardFilterValues: ['all', ...cardDefinitions.map((definition) => definition.slug)],
          cardValues: cardDefinitions.length > 1 ? cardDefinitions.map((definition) => definition.slug) : [],
          serialValues: Array.from({ length: tracker.total }, (_, index) => formatTrackerSerial(tracker, index + 1)),
        };
      }),
    ] satisfies AffiliateStatsTrackerEntry[];
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

    const summary = {
      ...summarizeRows(rows),
      ...await readViewContextBreakdowns(redis, trackerEntries, dateKeys),
    };
    const promotion = await readPromotionStats(redis, trackerEntries, dateKeys);
    const promotionVisits = await readPromotionVisitStats(redis, trackerEntries, dateKeys);
    const affiliatePromotionSources = await readAffiliatePromotionSourceStats(redis, dateKeys);
    const directory = await readDirectoryCtaStats(redis, trackerEntries, dateKeys);
    const affiliateCoverageRows = getAffiliateCoverageRows(trackers);

    return NextResponse.json({
      days,
      generatedAt: new Date().toISOString(),
      affiliateCoverage: {
        summary: getAffiliateCoverageSummary(affiliateCoverageRows),
        rows: affiliateCoverageRows,
      },
      summary,
      directory,
      promotion: {
        ...promotion,
        visits: promotionVisits,
        affiliateSources: affiliatePromotionSources,
        efficiency: buildPromotionEfficiency(promotion.summary.byTracker, promotionVisits.summary.byTracker, summary.byTracker),
        sourceEfficiency: buildPromotionSourceEfficiency(promotion.summary.byAction, promotionVisits.summary.bySource, affiliatePromotionSources),
      },
      rows,
    });
  } catch (error) {
    console.error('Error loading affiliate stats:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

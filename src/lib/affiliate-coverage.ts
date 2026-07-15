import type { AffiliateLink, TrackerSummary } from '@/lib/trackers';

const REQUIRED_LIVE_MERCHANTS: AffiliateLink['merchant'][] = ['tcgplayer', 'ebay', 'amazon'];
const TCGPLAYER_PARTNER_PATH = '/DyJ25G';
const AMAZON_ASSOCIATE_TAG = 'meleeitonme0a-20';
const EBAY_CAMPAIGN_ID = '5339113954';
const EXPECTED_INTENT_BY_MERCHANT: Partial<Record<AffiliateLink['merchant'], AffiliateLink['intent']>> = {
  tcgplayer: 'singles',
  ebay: 'auction-comps',
  amazon: 'sealed-product',
};

export interface AffiliateCoverageIssue {
  severity: 'error' | 'warning';
  merchant?: AffiliateLink['merchant'];
  message: string;
}

export interface AffiliateCoverageRow {
  tracker: string;
  trackerTitle: string;
  status: TrackerSummary['status'];
  linkCount: number;
  merchants: AffiliateLink['merchant'][];
  score: number;
  issues: AffiliateCoverageIssue[];
}

function addIssue(
  issues: AffiliateCoverageIssue[],
  severity: AffiliateCoverageIssue['severity'],
  message: string,
  merchant?: AffiliateLink['merchant'],
) {
  issues.push({ severity, merchant, message });
}

function safeUrl(href: string) {
  try {
    return new URL(href);
  } catch {
    return undefined;
  }
}

function validateLink(tracker: TrackerSummary, link: AffiliateLink, issues: AffiliateCoverageIssue[]) {
  const url = safeUrl(link.href);
  const expectedIntent = EXPECTED_INTENT_BY_MERCHANT[link.merchant];

  if (!url) {
    addIssue(issues, 'error', 'Affiliate link URL is invalid.', link.merchant);
    return;
  }

  if (url.protocol !== 'https:') {
    addIssue(issues, 'error', 'Affiliate link must use HTTPS.', link.merchant);
  }

  if (expectedIntent && link.intent !== expectedIntent) {
    addIssue(issues, 'error', `${link.merchant} intent should be ${expectedIntent}.`, link.merchant);
  }

  if (!link.ctaEyebrow || !link.ctaDetail) {
    addIssue(issues, 'warning', 'Top CTA copy is missing eyebrow or detail text.', link.merchant);
  }

  if (link.merchant === 'tcgplayer') {
    if (url.hostname !== 'partner.tcgplayer.com' || url.pathname !== TCGPLAYER_PARTNER_PATH) {
      addIssue(issues, 'error', 'TCGplayer link must use the configured partner redirect.', link.merchant);
    }
  }

  if (link.merchant === 'ebay') {
    const expectedCustomId = tracker.slug;

    if (!/(^|\.)ebay\.com$/.test(url.hostname)) {
      addIssue(issues, 'error', 'eBay link must point to ebay.com.', link.merchant);
    }
    if (url.searchParams.get('campid') !== EBAY_CAMPAIGN_ID) {
      addIssue(issues, 'error', 'eBay link is missing the configured campaign id.', link.merchant);
    }
    if (url.searchParams.get('customid') !== expectedCustomId) {
      addIssue(issues, 'error', `eBay customid should be ${expectedCustomId}.`, link.merchant);
    }
    if (url.searchParams.get('mkevt') !== '1') {
      addIssue(issues, 'error', 'eBay link is missing mkevt=1.', link.merchant);
    }
    if (!url.searchParams.get('_nkw')) {
      addIssue(issues, 'error', 'eBay link is missing a search query.', link.merchant);
    }
  }

  if (link.merchant === 'amazon') {
    if (!/(^|\.)amazon\.com$/.test(url.hostname)) {
      addIssue(issues, 'error', 'Amazon link must point to amazon.com.', link.merchant);
    }
    if (url.searchParams.get('tag') !== AMAZON_ASSOCIATE_TAG) {
      addIssue(issues, 'error', 'Amazon link is missing the configured associate tag.', link.merchant);
    }
    if (!url.searchParams.get('k')) {
      addIssue(issues, 'error', 'Amazon link is missing a search query.', link.merchant);
    }
  }
}

export function getAffiliateCoverageRows(trackers: TrackerSummary[]): AffiliateCoverageRow[] {
  return trackers.map((tracker) => {
    const links = tracker.affiliateLinks || [];
    const merchants = [...new Set(links.map((link) => link.merchant))].sort();
    const issues: AffiliateCoverageIssue[] = [];

    if (tracker.status === 'live') {
      for (const merchant of REQUIRED_LIVE_MERCHANTS) {
        if (!merchants.includes(merchant)) {
          addIssue(issues, 'error', `Live tracker is missing a ${merchant} affiliate link.`, merchant);
        }
      }
    }

    if (links.length === 0) {
      addIssue(issues, tracker.status === 'live' ? 'error' : 'warning', 'Tracker has no tracker-specific affiliate links.');
    }

    for (const link of links) {
      validateLink(tracker, link, issues);
    }

    const errorCount = issues.filter((issue) => issue.severity === 'error').length;
    const warningCount = issues.filter((issue) => issue.severity === 'warning').length;

    return {
      tracker: tracker.slug,
      trackerTitle: tracker.title,
      status: tracker.status,
      linkCount: links.length,
      merchants,
      score: Math.max(0, 100 - errorCount * 25 - warningCount * 10),
      issues,
    };
  }).sort((a, b) => a.score - b.score || a.trackerTitle.localeCompare(b.trackerTitle));
}

export function getAffiliateCoverageSummary(rows: AffiliateCoverageRow[]) {
  const issueCount = rows.reduce((total, row) => total + row.issues.length, 0);
  const errorCount = rows.reduce((total, row) => total + row.issues.filter((issue) => issue.severity === 'error').length, 0);
  const warningCount = issueCount - errorCount;
  const readyCount = rows.filter((row) => row.score === 100).length;

  return {
    trackerCount: rows.length,
    readyCount,
    issueCount,
    errorCount,
    warningCount,
    averageScore: rows.length > 0
      ? Math.round(rows.reduce((total, row) => total + row.score, 0) / rows.length)
      : 0,
  };
}

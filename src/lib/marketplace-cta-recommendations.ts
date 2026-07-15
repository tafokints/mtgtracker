interface AffiliateStatsRow {
  tracker: string;
  trackerTitle: string;
  merchant: string;
  placement: string;
  clicksInWindow: number;
  totalClicks: number;
}

interface AffiliateCoverageRow {
  tracker: string;
  trackerTitle: string;
  score: number;
  issues: Array<{ severity: 'error' | 'warning'; merchant?: string; message: string }>;
}

interface DirectoryCtaRow {
  tracker: string;
  trackerTitle: string;
  action: string;
  clicksInWindow: number;
}

export interface MarketplaceCtaRecommendationInput {
  affiliateCoverage?: {
    rows: AffiliateCoverageRow[];
  };
  directory?: {
    rows: DirectoryCtaRow[];
  };
  rows: AffiliateStatsRow[];
}

export interface MarketplaceCtaRecommendation {
  key: string;
  tracker: string;
  trackerTitle: string;
  priority: 'high' | 'medium' | 'low';
  merchant: string;
  action: string;
  detail: string;
}

interface TrackerCtaSignals {
  tracker: string;
  trackerTitle: string;
  directoryClicks: number;
  merchantClicks: Map<string, number>;
  placementClicks: Map<string, number>;
  coverage?: AffiliateCoverageRow;
}

function addMapCount(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) || 0) + value);
}

function topEntry(map: Map<string, number>) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
}

function merchantAction(merchant: string) {
  if (merchant === 'ebay') {
    return 'Lead with exact-serial eBay searches';
  }

  if (merchant === 'tcgplayer') {
    return 'Keep TCGplayer singles CTA prominent';
  }

  if (merchant === 'amazon') {
    return 'Keep sealed-product CTA secondary';
  }

  return 'Review marketplace CTA relevance';
}

export function getMarketplaceCtaRecommendations(stats: MarketplaceCtaRecommendationInput): MarketplaceCtaRecommendation[] {
  const signals = new Map<string, TrackerCtaSignals>();

  for (const row of stats.affiliateCoverage?.rows || []) {
    signals.set(row.tracker, {
      tracker: row.tracker,
      trackerTitle: row.trackerTitle,
      directoryClicks: 0,
      merchantClicks: new Map(),
      placementClicks: new Map(),
      coverage: row,
    });
  }

  for (const row of stats.directory?.rows || []) {
    const signal = signals.get(row.tracker) || {
      tracker: row.tracker,
      trackerTitle: row.trackerTitle,
      directoryClicks: 0,
      merchantClicks: new Map(),
      placementClicks: new Map(),
    };
    signal.directoryClicks += row.clicksInWindow;
    signals.set(row.tracker, signal);
  }

  for (const row of stats.rows) {
    if (row.tracker === 'default') continue;
    const signal = signals.get(row.tracker) || {
      tracker: row.tracker,
      trackerTitle: row.trackerTitle,
      directoryClicks: 0,
      merchantClicks: new Map(),
      placementClicks: new Map(),
    };
    addMapCount(signal.merchantClicks, row.merchant, row.clicksInWindow);
    addMapCount(signal.placementClicks, row.placement, row.clicksInWindow);
    signals.set(row.tracker, signal);
  }

  const recommendations: MarketplaceCtaRecommendation[] = [];

  for (const signal of signals.values()) {
    const coverageErrors = signal.coverage?.issues.filter((issue) => issue.severity === 'error') || [];
    if (coverageErrors.length > 0) {
      recommendations.push({
        key: `${signal.tracker}-fix-affiliate-coverage`,
        tracker: signal.tracker,
        trackerTitle: signal.trackerTitle,
        priority: 'high',
        merchant: coverageErrors[0].merchant || 'affiliate',
        action: 'Fix affiliate coverage before promotion',
        detail: `${coverageErrors.length} attribution or merchant coverage error${coverageErrors.length === 1 ? '' : 's'} could leak monetizable clicks.`,
      });
      continue;
    }

    const bestMerchant = topEntry(signal.merchantClicks);
    const bestPlacement = topEntry(signal.placementClicks);
    const totalAffiliateClicks = [...signal.merchantClicks.values()].reduce((total, value) => total + value, 0);

    if (bestMerchant && bestMerchant[1] > 0) {
      recommendations.push({
        key: `${signal.tracker}-${bestMerchant[0]}-winner`,
        tracker: signal.tracker,
        trackerTitle: signal.trackerTitle,
        priority: bestMerchant[0] === 'ebay' ? 'high' : 'medium',
        merchant: bestMerchant[0],
        action: merchantAction(bestMerchant[0]),
        detail: `${bestMerchant[0]} has ${bestMerchant[1]} recent click${bestMerchant[1] === 1 ? '' : 's'}${bestPlacement ? `, with ${bestPlacement[0]} as the strongest placement` : ''}. Reinforce that path in top and serial-detail CTAs.`,
      });
      continue;
    }

    if (signal.directoryClicks > 0 && totalAffiliateClicks === 0) {
      recommendations.push({
        key: `${signal.tracker}-directory-no-marketplace`,
        tracker: signal.tracker,
        trackerTitle: signal.trackerTitle,
        priority: 'high',
        merchant: 'ebay',
        action: 'Test eBay serial-search CTA above the fold',
        detail: `${signal.directoryClicks} directory action${signal.directoryClicks === 1 ? '' : 's'} but no marketplace clicks yet. Use exact-serial eBay copy near the first tracker action.`,
      });
      continue;
    }

    if (signal.coverage?.score === 100) {
      recommendations.push({
        key: `${signal.tracker}-seed-marketplace-clicks`,
        tracker: signal.tracker,
        trackerTitle: signal.trackerTitle,
        priority: 'low',
        merchant: 'tcgplayer',
        action: 'Seed marketplace CTA test',
        detail: 'Affiliate coverage is ready, but this tracker has no recent marketplace signal. Start with a TCGplayer singles CTA plus eBay comps in the tracker header.',
      });
    }
  }

  return recommendations
    .sort((a, b) => {
      const priorityScore = { high: 3, medium: 2, low: 1 };
      return priorityScore[b.priority] - priorityScore[a.priority] || a.trackerTitle.localeCompare(b.trackerTitle);
    })
    .slice(0, 6);
}

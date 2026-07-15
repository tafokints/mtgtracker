interface BreakdownRow {
  key: string;
  label: string;
  clicksInWindow: number;
  totalClicks: number;
}

interface DirectoryCtaRow {
  tracker: string;
  trackerTitle: string;
  action: string;
  clicksInWindow: number;
  totalClicks: number;
}

interface PromotionEfficiencyRow {
  key: string;
  label: string;
  promotionActionsInWindow: number;
  promotionVisitsInWindow: number;
  affiliateClicksInWindow: number;
}

export interface TrackerGrowthRecommendationInput {
  summary: {
    byTracker: BreakdownRow[];
  };
  directory?: {
    rows: DirectoryCtaRow[];
    summary: {
      byTracker: BreakdownRow[];
    };
  };
  promotion?: {
    efficiency: PromotionEfficiencyRow[];
  };
}

export interface TrackerGrowthRecommendation {
  key: string;
  label: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  detail: string;
}

interface TrackerSignals {
  key: string;
  label: string;
  directoryClicks: number;
  reportClicks: number;
  latestClicks: number;
  affiliateClicks: number;
  promotionActions: number;
  promotionVisits: number;
}

function incrementSignal(map: Map<string, TrackerSignals>, key: string, label: string, values: Partial<TrackerSignals>) {
  const current = map.get(key) || {
    key,
    label,
    directoryClicks: 0,
    reportClicks: 0,
    latestClicks: 0,
    affiliateClicks: 0,
    promotionActions: 0,
    promotionVisits: 0,
  };

  map.set(key, {
    ...current,
    ...values,
    directoryClicks: current.directoryClicks + (values.directoryClicks || 0),
    reportClicks: current.reportClicks + (values.reportClicks || 0),
    latestClicks: current.latestClicks + (values.latestClicks || 0),
    affiliateClicks: current.affiliateClicks + (values.affiliateClicks || 0),
    promotionActions: current.promotionActions + (values.promotionActions || 0),
    promotionVisits: current.promotionVisits + (values.promotionVisits || 0),
  });
}

function recommendationRank(recommendation: TrackerGrowthRecommendation) {
  const priorityScore = { high: 3, medium: 2, low: 1 }[recommendation.priority];
  return priorityScore * 1000;
}

export function getTrackerGrowthRecommendations(stats: TrackerGrowthRecommendationInput): TrackerGrowthRecommendation[] {
  const signals = new Map<string, TrackerSignals>();

  for (const row of stats.summary.byTracker) {
    if (row.key === 'default') continue;
    incrementSignal(signals, row.key, row.label, { affiliateClicks: row.clicksInWindow });
  }

  for (const row of stats.directory?.summary.byTracker || []) {
    incrementSignal(signals, row.key, row.label, { directoryClicks: row.clicksInWindow });
  }

  for (const row of stats.directory?.rows || []) {
    incrementSignal(signals, row.tracker, row.trackerTitle, {
      reportClicks: row.action === 'report-find' ? row.clicksInWindow : 0,
      latestClicks: row.action === 'latest-discovery' ? row.clicksInWindow : 0,
    });
  }

  for (const row of stats.promotion?.efficiency || []) {
    incrementSignal(signals, row.key, row.label, {
      promotionActions: row.promotionActionsInWindow,
      promotionVisits: row.promotionVisitsInWindow,
    });
  }

  const recommendations: TrackerGrowthRecommendation[] = [];

  for (const signal of signals.values()) {
    if (signal.reportClicks > 0) {
      recommendations.push({
        key: `${signal.key}-review-reports`,
        label: signal.label,
        priority: 'high',
        action: 'Review report demand',
        detail: `${signal.reportClicks} directory report click${signal.reportClicks === 1 ? '' : 's'} in the current window. Keep the review queue fast so crowd-sourced discoveries stay fresh.`,
      });
    }

    if (signal.directoryClicks >= 2 && signal.affiliateClicks === 0) {
      recommendations.push({
        key: `${signal.key}-monetize-directory-interest`,
        label: signal.label,
        priority: 'high',
        action: 'Improve marketplace CTAs',
        detail: `${signal.directoryClicks} directory clicks but no affiliate clicks yet. Check above-the-fold marketplace links, exact-serial eBay searches, and tracker-specific affiliate relevance.`,
      });
    }

    if (signal.latestClicks > 0 && signal.promotionActions === 0) {
      recommendations.push({
        key: `${signal.key}-share-latest-discovery`,
        label: signal.label,
        priority: 'medium',
        action: 'Share latest discovery',
        detail: `${signal.latestClicks} latest-discovery click${signal.latestClicks === 1 ? '' : 's'} from the directory. Turn that proof into a campaign-tagged X or Reddit post.`,
      });
    }

    if (signal.affiliateClicks > 0 && signal.promotionVisits === 0) {
      recommendations.push({
        key: `${signal.key}-promote-converter`,
        label: signal.label,
        priority: 'medium',
        action: 'Promote converting tracker',
        detail: `${signal.affiliateClicks} affiliate click${signal.affiliateClicks === 1 ? '' : 's'} without promoted visits. This tracker is already monetizing organic traffic; give it a campaign push.`,
      });
    }
  }

  return recommendations
    .sort((a, b) => (
      recommendationRank(b) - recommendationRank(a) ||
      a.label.localeCompare(b.label) ||
      a.action.localeCompare(b.action)
    ))
    .slice(0, 5);
}

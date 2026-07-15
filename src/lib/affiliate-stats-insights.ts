interface AffiliateStatsBreakdown {
  label: string;
  clicksInWindow: number;
  totalClicks: number;
}

interface AffiliateStatsInsightRow {
  trackerTitle: string;
  merchant: string;
  placement: string;
  clicksInWindow: number;
  totalClicks: number;
  lastClick?: {
    clickedAt?: string;
    sourcePath?: string;
  } | null;
}

interface PromotionEfficiencyInsightRow {
  label: string;
  promotionActionsInWindow: number;
  promotionVisitsInWindow: number;
  affiliateClicksInWindow: number;
  affiliateClicksPerActionInWindow: number | null;
  affiliateClicksPerVisitInWindow: number | null;
}

export interface AffiliateStatsInsightInput {
  summary: {
    bestPlacement: AffiliateStatsBreakdown | null;
  };
  promotion?: {
    efficiency: PromotionEfficiencyInsightRow[];
  };
  rows: AffiliateStatsInsightRow[];
}

export interface AffiliateStatsInsight {
  label: string;
  value: string;
  detail: string;
}

function formatPlacement(placement: string) {
  return placement.replace(/-/g, ' ');
}

function formatMerchant(merchant: string) {
  return merchant.charAt(0).toUpperCase() + merchant.slice(1);
}

function formatRatio(value: number | null) {
  return value === null ? 'n/a' : value.toFixed(2);
}

function getPromotionFunnelInsights(efficiencyRows: PromotionEfficiencyInsightRow[]): AffiliateStatsInsight[] {
  const activeRows = efficiencyRows.filter((row) => (
    row.promotionActionsInWindow > 0 ||
    row.promotionVisitsInWindow > 0 ||
    row.affiliateClicksInWindow > 0
  ));

  if (activeRows.length === 0) {
    return [];
  }

  const insights: AffiliateStatsInsight[] = [];
  const bestVisitConverter = [...activeRows]
    .filter((row) => row.promotionVisitsInWindow > 0)
    .sort((a, b) => (
      (b.affiliateClicksPerVisitInWindow || 0) - (a.affiliateClicksPerVisitInWindow || 0) ||
      b.affiliateClicksInWindow - a.affiliateClicksInWindow ||
      b.promotionVisitsInWindow - a.promotionVisitsInWindow ||
      a.label.localeCompare(b.label)
    ))[0];

  if (bestVisitConverter) {
    insights.push({
      label: 'Best Funnel',
      value: bestVisitConverter.label,
      detail: `${bestVisitConverter.promotionVisitsInWindow} promoted visits created ${bestVisitConverter.affiliateClicksInWindow} affiliate clicks (${formatRatio(bestVisitConverter.affiliateClicksPerVisitInWindow)} clicks/visit).`,
    });
  }

  const needsWork = [...activeRows]
    .filter((row) => row.promotionVisitsInWindow > 0 && row.affiliateClicksInWindow === 0)
    .sort((a, b) => b.promotionVisitsInWindow - a.promotionVisitsInWindow || a.label.localeCompare(b.label))[0];

  if (needsWork) {
    insights.push({
      label: 'Funnel Gap',
      value: needsWork.label,
      detail: `${needsWork.promotionVisitsInWindow} promoted visits but no affiliate clicks yet. Check CTA relevance, above-the-fold links, and source match.`,
    });
  }

  const actionGap = [...activeRows]
    .filter((row) => row.promotionActionsInWindow > 0 && row.promotionVisitsInWindow === 0)
    .sort((a, b) => b.promotionActionsInWindow - a.promotionActionsInWindow || a.label.localeCompare(b.label))[0];

  if (actionGap && insights.length < 2) {
    insights.push({
      label: 'Distribution Gap',
      value: actionGap.label,
      detail: `${actionGap.promotionActionsInWindow} promotion actions but no promoted visits yet. Recheck posted links and audience fit.`,
    });
  }

  return insights.slice(0, 2);
}

export function getAffiliateStatsInsights(stats: AffiliateStatsInsightInput): AffiliateStatsInsight[] {
  const insights: AffiliateStatsInsight[] = [];
  const topRow = stats.rows[0];

  if (topRow) {
    insights.push({
      label: 'Top CTA',
      value: `${topRow.trackerTitle} / ${formatMerchant(topRow.merchant)}`,
      detail: `${topRow.clicksInWindow} recent clicks from ${formatPlacement(topRow.placement)}.`,
    });
  }

  if (stats.summary.bestPlacement) {
    insights.push({
      label: 'Best Placement',
      value: formatPlacement(stats.summary.bestPlacement.label),
      detail: `${stats.summary.bestPlacement.clicksInWindow} recent clicks, ${stats.summary.bestPlacement.totalClicks} all time.`,
    });
  }

  const staleWinner = [...stats.rows]
    .filter((row) => row.totalClicks > 0 && row.clicksInWindow === 0)
    .sort((a, b) => b.totalClicks - a.totalClicks)[0];

  if (staleWinner) {
    insights.push({
      label: 'Refresh Candidate',
      value: `${staleWinner.trackerTitle} / ${formatMerchant(staleWinner.merchant)}`,
      detail: `${formatPlacement(staleWinner.placement)} has ${staleWinner.totalClicks} lifetime clicks but none in the current window.`,
    });
  }

  const newestClick = [...stats.rows]
    .filter((row) => row.lastClick?.clickedAt)
    .sort((a, b) => (
      new Date(b.lastClick?.clickedAt || 0).getTime() -
      new Date(a.lastClick?.clickedAt || 0).getTime()
    ))[0];

  if (newestClick?.lastClick?.clickedAt) {
    insights.push({
      label: 'Latest Click',
      value: `${newestClick.trackerTitle} / ${formatMerchant(newestClick.merchant)}`,
      detail: newestClick.lastClick.sourcePath
        ? `${formatPlacement(newestClick.placement)} from ${newestClick.lastClick.sourcePath}.`
        : `${formatPlacement(newestClick.placement)} at ${newestClick.lastClick.clickedAt}.`,
    });
  }

  return [
    ...getPromotionFunnelInsights(stats.promotion?.efficiency || []),
    ...insights,
  ].slice(0, 6);
}

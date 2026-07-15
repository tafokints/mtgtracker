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

export interface AffiliateStatsInsightInput {
  summary: {
    bestPlacement: AffiliateStatsBreakdown | null;
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

  return insights.slice(0, 4);
}

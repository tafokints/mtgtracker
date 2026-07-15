export interface AffiliateStatsCsvRow {
  tracker: string;
  trackerTitle: string;
  merchant: string;
  intent: string;
  label: string;
  href: string;
  placement: string;
  clicksInWindow: number;
  totalClicks: number;
  lastClick?: {
    clickedAt?: string;
    href?: string;
    sourcePath?: string;
    viewContext?: {
      query?: string;
      filter?: string;
      sort?: string;
      cardFilter?: string;
      card?: string;
      serial?: string;
      slot?: string;
    };
  } | null;
}

export interface AffiliateStatsCsvInput {
  generatedAt: string;
  directory?: {
    rows?: DirectoryCtaCsvRow[];
  };
  promotion?: {
    sourceEfficiency?: PromotionSourceEfficiencyCsvRow[];
  };
  rows: AffiliateStatsCsvRow[];
}

export interface DirectoryCtaCsvRow {
  tracker: string;
  trackerTitle: string;
  action: string;
  label: string;
  clicksInWindow: number;
  totalClicks: number;
  lastClick?: {
    clickedAt?: string;
    href?: string;
    sourcePath?: string;
  } | null;
}

export interface PromotionSourceEfficiencyCsvRow {
  key: string;
  label: string;
  promotionActionsInWindow: number;
  promotionActionsTotal: number;
  promotionVisitsInWindow: number;
  promotionVisitsTotal: number;
  affiliateClicksInWindow: number;
  affiliateClicksTotal: number;
  affiliateClicksPerActionInWindow: number | null;
  affiliateClicksPerActionTotal: number | null;
  affiliateClicksPerVisitInWindow: number | null;
  affiliateClicksPerVisitTotal: number | null;
}

const AFFILIATE_STATS_CSV_HEADERS = [
  'tracker',
  'trackerTitle',
  'merchant',
  'intent',
  'placement',
  'label',
  'rowHref',
  'lastClickHref',
  'sourcePath',
  'clicksInWindow',
  'totalClicks',
  'lastClickedAt',
  'lastFilter',
  'lastSort',
  'lastCardFilter',
  'lastQuery',
  'lastCard',
  'lastSerial',
  'lastSlot',
  'rowType',
  'promotionKey',
  'promotionLabel',
  'promotionActionsInWindow',
  'promotionActionsTotal',
  'promotionVisitsInWindow',
  'promotionVisitsTotal',
  'promotionAffiliateClicksInWindow',
  'promotionAffiliateClicksTotal',
  'promotionAffiliateClicksPerActionInWindow',
  'promotionAffiliateClicksPerActionTotal',
  'promotionAffiliateClicksPerVisitInWindow',
  'promotionAffiliateClicksPerVisitTotal',
  'directoryAction',
  'directoryLabel',
  'directoryHref',
];

function csvCell(value: unknown) {
  const text = value === undefined || value === null ? '' : String(value);
  return `"${text.replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`;
}

export function buildAffiliateStatsCsv(stats: AffiliateStatsCsvInput) {
  const lines = [
    AFFILIATE_STATS_CSV_HEADERS.map(csvCell).join(','),
    ...stats.rows.map((row) => {
      const viewContext = row.lastClick?.viewContext;

      return [
        row.tracker,
        row.trackerTitle,
        row.merchant,
        row.intent,
        row.placement,
        row.label,
        row.href,
        row.lastClick?.href,
        row.lastClick?.sourcePath,
        row.clicksInWindow,
        row.totalClicks,
        row.lastClick?.clickedAt,
        viewContext?.filter,
        viewContext?.sort,
        viewContext?.cardFilter,
        viewContext?.query,
        viewContext?.card,
        viewContext?.serial,
        viewContext?.slot,
        'affiliate-click',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ].map(csvCell).join(',');
    }),
    ...(stats.directory?.rows || []).map((row) => [
      row.tracker,
      row.trackerTitle,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      row.lastClick?.href,
      row.lastClick?.sourcePath,
      row.clicksInWindow,
      row.totalClicks,
      row.lastClick?.clickedAt,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'directory-cta',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      row.action,
      row.label,
      row.lastClick?.href,
    ].map(csvCell).join(',')),
    ...(stats.promotion?.sourceEfficiency || []).map((row) => [
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'promotion-source-efficiency',
      row.key,
      row.label,
      row.promotionActionsInWindow,
      row.promotionActionsTotal,
      row.promotionVisitsInWindow,
      row.promotionVisitsTotal,
      row.affiliateClicksInWindow,
      row.affiliateClicksTotal,
      row.affiliateClicksPerActionInWindow,
      row.affiliateClicksPerActionTotal,
      row.affiliateClicksPerVisitInWindow,
      row.affiliateClicksPerVisitTotal,
      undefined,
      undefined,
      undefined,
    ].map(csvCell).join(',')),
  ];

  return `${lines.join('\n')}\n`;
}

export function affiliateStatsCsvFilename(generatedAt: string) {
  const date = /^\d{4}-\d{2}-\d{2}/.test(generatedAt)
    ? generatedAt.slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return `mtgtrackers-affiliate-stats-${date}.csv`;
}

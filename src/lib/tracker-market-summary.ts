import type { SerializedRingCard } from '@/lib/types';
import type { AffiliateLink, TrackerSummary } from '@/lib/trackers';

export interface TrackerMarketSummary {
  foundCount: number;
  confirmedCount: number;
  sourceLinkedCount: number;
  evidenceBackedCount: number;
  marketplaceSourceCount: number;
  saleDataCount: number;
  pendingReportCount: number;
  primaryMerchant: AffiliateLink['merchant'] | 'none';
  primaryMerchantLabel: string;
  trustSignals: Array<{ label: string; value: string; detail: string }>;
}

function merchantLabel(merchant: AffiliateLink['merchant'] | 'none') {
  if (merchant === 'tcgplayer') return 'TCGplayer';
  if (merchant === 'ebay') return 'eBay';
  if (merchant === 'amazon') return 'Amazon';
  if (merchant === 'other') return 'Marketplace';
  return 'Marketplace';
}

function choosePrimaryMerchant(tracker: TrackerSummary, cards: SerializedRingCard[]) {
  const links = tracker.affiliateLinks || [];
  const hasMerchant = (merchant: AffiliateLink['merchant']) => links.some((link) => link.merchant === merchant);
  const hasFoundCards = cards.some((card) => card.found);

  if (hasFoundCards && hasMerchant('ebay')) {
    return 'ebay';
  }

  if (hasMerchant('tcgplayer')) {
    return 'tcgplayer';
  }

  if (hasMerchant('amazon')) {
    return 'amazon';
  }

  return links[0]?.merchant || 'none';
}

export function getTrackerMarketSummary(tracker: TrackerSummary, cards: SerializedRingCard[]): TrackerMarketSummary {
  const foundCards = cards.filter((card) => card.found);
  const confirmedCount = cards.filter((card) => card.verificationStatus === 'confirmed').length;
  const sourceLinkedCount = cards.filter((card) => card.verificationStatus === 'source-linked').length;
  const evidenceBackedCount = cards.filter((card) => (card.evidenceImages || []).length > 0 || Boolean(card.image)).length;
  const marketplaceSourceCount = cards.filter((card) => card.sourceType === 'marketplace').length;
  const saleDataCount = cards.filter((card) => typeof card.price === 'number' && Number.isFinite(card.price)).length;
  const pendingReportCount = cards.reduce((total, card) => total + (card.pendingReports || 0), 0);
  const primaryMerchant = choosePrimaryMerchant(tracker, cards);
  const totalCount = cards.length || tracker.total;

  return {
    foundCount: foundCards.length,
    confirmedCount,
    sourceLinkedCount,
    evidenceBackedCount,
    marketplaceSourceCount,
    saleDataCount,
    pendingReportCount,
    primaryMerchant,
    primaryMerchantLabel: merchantLabel(primaryMerchant),
    trustSignals: [
      {
        label: 'Reviewed discoveries',
        value: `${foundCards.length}/${totalCount}`,
        detail: `${confirmedCount} confirmed, ${sourceLinkedCount} source-linked`,
      },
      {
        label: 'Evidence coverage',
        value: String(evidenceBackedCount),
        detail: 'cards with saved image evidence or canonical images',
      },
      {
        label: 'Market signals',
        value: String(marketplaceSourceCount + saleDataCount),
        detail: `${marketplaceSourceCount} marketplace sources, ${saleDataCount} sale data points`,
      },
      {
        label: 'Crowd queue',
        value: String(pendingReportCount),
        detail: 'pending public reports awaiting admin review',
      },
    ],
  };
}

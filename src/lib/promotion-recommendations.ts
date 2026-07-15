export interface PromotionSourceEfficiency {
  key: string;
  label: string;
  promotionActionsInWindow: number;
  promotionVisitsInWindow: number;
  affiliateClicksInWindow: number;
  affiliateClicksPerActionInWindow: number | null;
  affiliateClicksPerVisitInWindow: number | null;
}

export interface PromotionCandidateSummary {
  score: number;
  reasons: string[];
}

export interface PromoteNextRecommendation<TCandidate extends PromotionCandidateSummary> {
  candidate: TCandidate;
  source: PromotionSourceEfficiency;
  detail: string;
}

const DEFAULT_SOURCE: PromotionSourceEfficiency = {
  key: 'x',
  label: 'X',
  promotionActionsInWindow: 0,
  promotionVisitsInWindow: 0,
  affiliateClicksInWindow: 0,
  affiliateClicksPerActionInWindow: null,
  affiliateClicksPerVisitInWindow: null,
};

export function choosePromotionSource(sourceEfficiency: PromotionSourceEfficiency[] = []) {
  return [...sourceEfficiency]
    .filter((source) => ['admin_copy', 'x', 'reddit'].includes(source.key))
    .sort((a, b) => (
      (b.affiliateClicksPerVisitInWindow || 0) - (a.affiliateClicksPerVisitInWindow || 0) ||
      (b.affiliateClicksPerActionInWindow || 0) - (a.affiliateClicksPerActionInWindow || 0) ||
      b.affiliateClicksInWindow - a.affiliateClicksInWindow ||
      b.promotionVisitsInWindow - a.promotionVisitsInWindow ||
      b.promotionActionsInWindow - a.promotionActionsInWindow ||
      a.label.localeCompare(b.label)
    ))[0] || DEFAULT_SOURCE;
}

export function getPromoteNextRecommendation<TCandidate extends PromotionCandidateSummary>(
  candidates: TCandidate[],
  sourceEfficiency: PromotionSourceEfficiency[] = [],
): PromoteNextRecommendation<TCandidate> | null {
  const candidate = [...candidates].sort((a, b) => b.score - a.score)[0];

  if (!candidate) {
    return null;
  }

  const source = choosePromotionSource(sourceEfficiency);
  const proof = candidate.reasons.slice(0, 3).join(', ') || 'approved evidence';
  const detail = source.affiliateClicksInWindow > 0
    ? `${source.label} is the best current source; use this ${proof} discovery while it is converting.`
    : `No source has converted yet; start with ${source.label} using this ${proof} discovery.`;

  return {
    candidate,
    source,
    detail,
  };
}

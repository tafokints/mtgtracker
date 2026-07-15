import type { DiscoverySubmission, SerializedRingCard } from '@/lib/types';
import type { TrackerSummary } from '@/lib/trackers';
import { formatTrackerCardLabel, getTrackerCardDeepLinkParams } from '@/lib/tracker-data';
import { siteUrl } from '@/lib/seo';

export interface PromotionCandidate {
  card: SerializedRingCard;
  submission: DiscoverySubmission;
  detailUrl: string;
  promotionUrls: {
    copy: string;
    x: string;
    reddit: string;
  };
  shareText: string;
  score: number;
  reasons: string[];
}

function formatStatus(value: string) {
  return value.replace(/-/g, ' ');
}

function formatPrice(value?: number) {
  return value === undefined ? undefined : `$${value.toLocaleString()}`;
}

export function buildDiscoveryShareText(tracker: TrackerSummary, card: SerializedRingCard, detailUrl: string) {
  const label = formatTrackerCardLabel(tracker, card);
  const lines = [
    `MTG serialized discovery: ${tracker.title} ${label}`,
    `Status: ${card.found ? 'Located' : 'Not found'} (${formatStatus(card.verificationStatus)})`,
    card.sourceType ? `Source: ${formatStatus(card.sourceType)}` : undefined,
    card.foundBy ? `Found by: ${card.foundBy}` : undefined,
    card.dateFound ? `Date found: ${card.dateFound}` : undefined,
    card.price !== undefined ? `Reported price: ${formatPrice(card.price)}` : undefined,
    `Track it: ${detailUrl}`,
  ];

  return lines.filter(Boolean).join('\n');
}

export function buildDiscoveryShareTitle(tracker: TrackerSummary, card: SerializedRingCard) {
  const label = formatTrackerCardLabel(tracker, card);
  return `${tracker.title} ${label} spotted on MTG Trackers`;
}

export function buildDiscoveryShareLinks(tracker: TrackerSummary, card: SerializedRingCard, detailUrl: string) {
  const title = buildDiscoveryShareTitle(tracker, card);

  return {
    x: `https://twitter.com/intent/tweet?${new URLSearchParams({
      text: `${title}\n${detailUrl}`,
    }).toString()}`,
    reddit: `https://www.reddit.com/submit?${new URLSearchParams({
      url: detailUrl,
      title,
    }).toString()}`,
  };
}

export function buildDiscoveryDetailUrl(tracker: TrackerSummary, card: SerializedRingCard, baseUrl = siteUrl) {
  return `${baseUrl.replace(/\/+$/, '')}${tracker.href}?${getTrackerCardDeepLinkParams(tracker, card).toString()}`;
}

export function buildPromotionUrl(detailUrl: string, options: { source: string; content: string }) {
  const url = new URL(detailUrl);

  url.searchParams.set('utm_source', options.source);
  url.searchParams.set('utm_medium', 'social');
  url.searchParams.set('utm_campaign', 'discovery_promotion');
  url.searchParams.set('utm_content', options.content);

  return url.toString();
}

function promotionScore(submission: DiscoverySubmission, card: SerializedRingCard) {
  const reasons: string[] = [];
  let score = 0;

  if (submission.requestedVerificationStatus === 'confirmed' || card.verificationStatus === 'confirmed') {
    score += 4;
    reasons.push('confirmed');
  } else if (submission.requestedVerificationStatus === 'source-linked' || card.verificationStatus === 'source-linked') {
    score += 3;
    reasons.push('source linked');
  }

  if (submission.link || card.link) {
    score += 2;
    reasons.push('source');
  }

  const evidenceImageCount = (submission.evidenceImages || []).length + (submission.imageUrl ? 1 : 0) + (card.evidenceImages || []).length;
  if (evidenceImageCount > 0) {
    score += 2;
    reasons.push(`${evidenceImageCount} image${evidenceImageCount === 1 ? '' : 's'}`);
  }

  if (submission.price !== undefined || card.price !== undefined) {
    score += 1;
    reasons.push('price');
  }

  if (submission.foundBy || card.foundBy) {
    score += 1;
    reasons.push('finder');
  }

  if (submission.dateFound || card.dateFound) {
    score += 1;
    reasons.push('date');
  }

  return { reasons, score };
}

export function getPromotionCandidates(
  tracker: TrackerSummary,
  cards: SerializedRingCard[],
  submissions: DiscoverySubmission[],
  limit = 3,
): PromotionCandidate[] {
  return submissions
    .filter((submission) => submission.status === 'approved')
    .map((submission) => {
      const card = cards.find((candidate) => candidate.id === submission.cardId);
      if (!card || !card.found) {
        return undefined;
      }

      const { reasons, score } = promotionScore(submission, card);
      const detailUrl = buildDiscoveryDetailUrl(tracker, card);
      const promotionContent = [
        tracker.slug,
        card.cardSlug || tracker.slug,
        card.serialNumber,
      ].join('-');
      const promotionUrls = {
        copy: buildPromotionUrl(detailUrl, { source: 'admin_copy', content: promotionContent }),
        x: buildPromotionUrl(detailUrl, { source: 'x', content: promotionContent }),
        reddit: buildPromotionUrl(detailUrl, { source: 'reddit', content: promotionContent }),
      };

      return {
        card,
        detailUrl,
        promotionUrls,
        reasons,
        score,
        shareText: buildDiscoveryShareText(tracker, card, promotionUrls.copy),
        submission,
      };
    })
    .filter((candidate): candidate is PromotionCandidate => Boolean(candidate))
    .sort((a, b) => {
      const scoreDifference = b.score - a.score;
      if (scoreDifference !== 0) return scoreDifference;

      const bDate = new Date(b.submission.reviewedAt || b.submission.submittedAt).getTime();
      const aDate = new Date(a.submission.reviewedAt || a.submission.submittedAt).getTime();
      return bDate - aDate;
    })
    .slice(0, limit);
}

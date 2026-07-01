import { Redis } from '@upstash/redis';
import { DiscoverySubmission, EvidenceImage, PriceHistoryEntry, SerializedRingCard, VerificationStatus } from './types';
import { TrackerSummary } from './trackers';

export function formatTrackerSerial(tracker: TrackerSummary, id: number) {
  return id.toString().padStart(tracker.serialPadding, '0');
}

export function getTrackerCardName(tracker: TrackerSummary, id: number) {
  return `${tracker.title} ${formatTrackerSerial(tracker, id)}/${tracker.total}`;
}

export function createInitialTrackerCards(tracker: TrackerSummary): SerializedRingCard[] {
  return Array.from({ length: tracker.total }, (_, index) => {
    const id = index + 1;

    return {
      id,
      serialNumber: formatTrackerSerial(tracker, id),
      name: getTrackerCardName(tracker, id),
      found: false,
      verificationStatus: 'unverified',
      image: tracker.referenceImage,
      priceHistory: [],
    };
  });
}

export function normalizeTrackerCard(tracker: TrackerSummary, card: Partial<SerializedRingCard> & { id: number }): SerializedRingCard {
  return {
    id: card.id,
    serialNumber: card.serialNumber || formatTrackerSerial(tracker, card.id),
    name: card.name || getTrackerCardName(tracker, card.id),
    found: Boolean(card.found),
    foundBy: card.foundBy,
    dateFound: card.dateFound,
    link: card.link,
    sourceType: card.sourceType,
    verificationStatus: card.verificationStatus || 'unverified',
    notes: card.notes,
    image: card.image || tracker.referenceImage,
    evidenceImages: card.evidenceImages || [],
    price: card.price,
    priceDate: card.priceDate,
    priceHistory: card.priceHistory || [],
    grading: card.grading,
    pendingReports: card.pendingReports || 0,
  };
}

export function withPendingReportCounts(cards: SerializedRingCard[], submissions: DiscoverySubmission[]) {
  const pendingCounts = submissions
    .filter((submission) => submission.status === 'pending')
    .reduce((counts, submission) => {
      counts[submission.cardId] = (counts[submission.cardId] || 0) + 1;
      return counts;
    }, {} as Record<number, number>);

  return cards.map((card) => ({
    ...card,
    pendingReports: pendingCounts[card.id] || 0,
  }));
}

export function getTrackerDirectoryStats(cards: SerializedRingCard[], submissions: DiscoverySubmission[]) {
  const foundCards = cards.filter((card) => card.found);

  return {
    foundCount: foundCards.length,
    confirmedCount: foundCards.filter((card) => card.verificationStatus === 'confirmed').length,
    pendingReportCount: submissions.filter((submission) => submission.status === 'pending').length,
  };
}

export async function getTrackerCards(redis: Redis, tracker: TrackerSummary) {
  let cards: SerializedRingCard[] = (await redis.get(tracker.storage.cardsKey)) || [];

  if (cards.length === 0) {
    for (const legacyKey of tracker.storage.legacyCardsKeys || []) {
      const legacyCards = await redis.get(legacyKey);
      if (Array.isArray(legacyCards) && legacyCards.length > 0) {
        cards = legacyCards.map((card: any) => normalizeTrackerCard(tracker, card));
        await redis.set(tracker.storage.cardsKey, cards);
        await redis.del(legacyKey);
        return cards;
      }
    }

    cards = createInitialTrackerCards(tracker);
    await redis.set(tracker.storage.cardsKey, cards);
    return cards;
  }

  return cards.map((card) => normalizeTrackerCard(tracker, card));
}

export async function getTrackerSubmissions(redis: Redis, tracker: TrackerSummary) {
  const submissions: DiscoverySubmission[] = (await redis.get(tracker.storage.submissionsKey)) || [];
  return submissions;
}

export function sortSubmissions(submissions: DiscoverySubmission[]) {
  return [...submissions].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

export async function saveTrackerCards(redis: Redis, tracker: TrackerSummary, cards: SerializedRingCard[]) {
  await redis.set(tracker.storage.cardsKey, cards);
}

export async function saveTrackerSubmissions(redis: Redis, tracker: TrackerSummary, submissions: DiscoverySubmission[]) {
  await redis.set(tracker.storage.submissionsKey, submissions);
}

function evidenceFromSubmission(submission: DiscoverySubmission, label: string): EvidenceImage[] {
  const provenance = {
    sourceSubmissionId: submission.id,
    sourceUrl: submission.link,
    sourceType: submission.sourceType,
  };

  return [
    submission.imageUrl
      ? {
          url: submission.imageUrl,
          caption: `${label} primary image`,
          ...provenance,
        }
      : undefined,
    ...(submission.evidenceImages || []).map((image, index) => ({
      ...image,
      caption: image.caption || `${label} evidence ${index + 1}`,
      ...provenance,
    })),
  ].filter(Boolean) as EvidenceImage[];
}

function mergeEvidenceImages(existingImages: EvidenceImage[], incomingImages: EvidenceImage[]) {
  const imagesByUrl = new Map<string, EvidenceImage>();

  for (const image of [...existingImages, ...incomingImages]) {
    if (!image.url) continue;
    imagesByUrl.set(image.url, {
      ...imagesByUrl.get(image.url),
      ...image,
    });
  }

  return [...imagesByUrl.values()];
}

export function applyApprovedSubmission(
  tracker: TrackerSummary,
  cards: SerializedRingCard[],
  submission: DiscoverySubmission,
  options: {
    imageUrl?: string;
    verificationStatus?: VerificationStatus;
    reviewNotes?: string;
    mergedEvidenceSubmissions?: DiscoverySubmission[];
  }
) {
  const cardIndex = cards.findIndex((card) => card.id === submission.cardId);
  if (cardIndex === -1) {
    return false;
  }

  const selectedImageUrl =
    options.imageUrl ||
    submission.imageUrl ||
    submission.evidenceImages?.[0]?.url ||
    cards[cardIndex].image ||
    tracker.referenceImage;

  const approvedEvidence = evidenceFromSubmission(submission, 'Approved report');
  const mergedEvidence = (options.mergedEvidenceSubmissions || []).flatMap((mergedSubmission) => (
    evidenceFromSubmission(mergedSubmission, 'Merged report')
  ));
  const selectedImageEvidence =
    options.imageUrl && !approvedEvidence.some((image) => image.url === options.imageUrl)
      ? [{
          url: options.imageUrl,
          caption: 'Admin selected primary image',
          sourceSubmissionId: submission.id,
          sourceUrl: submission.link,
          sourceType: submission.sourceType,
        }]
      : [];

  cards[cardIndex] = {
    ...cards[cardIndex],
    found: true,
    foundBy: submission.foundBy,
    dateFound: submission.dateFound,
    link: submission.link,
    sourceType: submission.sourceType,
    verificationStatus: options.verificationStatus || submission.requestedVerificationStatus || 'source-linked',
    notes: [submission.notes, options.reviewNotes].filter(Boolean).join('\n\n') || undefined,
    image: selectedImageUrl,
    evidenceImages: mergeEvidenceImages(cards[cardIndex].evidenceImages || [], [
      ...selectedImageEvidence,
      ...approvedEvidence,
      ...mergedEvidence,
    ]),
  };

  if (submission.price !== undefined) {
    const priceEntry: PriceHistoryEntry = {
      price: submission.price,
      date: submission.dateFound || new Date().toISOString().split('T')[0],
      soldBy: submission.foundBy,
    };

    cards[cardIndex].price = submission.price;
    cards[cardIndex].priceDate = priceEntry.date;
    cards[cardIndex].priceHistory = [
      priceEntry,
      ...(cards[cardIndex].priceHistory || []),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  return true;
}

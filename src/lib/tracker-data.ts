import { Redis } from '@upstash/redis';
import { DiscoverySubmission, EvidenceImage, PriceHistoryEntry, SerializedRingCard, VerificationStatus } from './types';
import { TrackerCardDefinition, TrackerSummary } from './trackers';

export type ResolvedTrackerCardDefinition = Required<Pick<TrackerCardDefinition, 'slug' | 'title'>> & {
  total: number;
  serialPadding: number;
  referenceImage?: string;
  scryfallUrl?: string;
};

export interface RecentTrackerDiscovery {
  trackerSlug: string;
  trackerTitle: string;
  trackerHref: string;
  detailHref: string;
  cardId: number;
  cardTitle?: string;
  serialNumber: string;
  serialTotal?: number;
  label: string;
  foundBy?: string;
  dateFound?: string;
  verificationStatus: VerificationStatus;
  sourceType?: string;
  price?: number;
}

export function getTrackerCardDefinitions(tracker: TrackerSummary): ResolvedTrackerCardDefinition[] {
  if (tracker.cardDefinitions?.length) {
    return tracker.cardDefinitions.map((definition) => ({
      slug: definition.slug,
      title: definition.title,
      total: definition.total || tracker.total,
      serialPadding: definition.serialPadding || tracker.serialPadding,
      referenceImage: definition.referenceImage || tracker.referenceImage,
      scryfallUrl: definition.scryfallUrl,
    }));
  }

  return [{
    slug: tracker.slug,
    title: tracker.title,
    total: tracker.total,
    serialPadding: tracker.serialPadding,
    referenceImage: tracker.referenceImage,
  }];
}

export function getTrackerTotalSlots(tracker: TrackerSummary) {
  return getTrackerCardDefinitions(tracker).reduce((total, definition) => total + definition.total, 0);
}

export function formatTrackerSerial(tracker: TrackerSummary, id: number, definition?: Pick<ResolvedTrackerCardDefinition, 'serialPadding'>) {
  return id.toString().padStart(definition?.serialPadding || tracker.serialPadding, '0');
}

export function getTrackerSlotId(tracker: TrackerSummary, cardSlug: string, serialId: number) {
  let offset = 0;

  for (const definition of getTrackerCardDefinitions(tracker)) {
    if (definition.slug === cardSlug) {
      return serialId >= 1 && serialId <= definition.total ? offset + serialId : undefined;
    }

    offset += definition.total;
  }

  return undefined;
}

function buildTrackerCardSlot(tracker: TrackerSummary, definition: ResolvedTrackerCardDefinition, id: number, serialId: number): SerializedRingCard {
  const serialNumber = formatTrackerSerial(tracker, serialId, definition);

  return {
    id,
    cardSlug: definition.slug,
    cardTitle: definition.title,
    serialTotal: definition.total,
    serialNumber,
    name: `${definition.title} ${serialNumber}/${definition.total}`,
    found: false,
    verificationStatus: 'unverified',
    image: definition.referenceImage,
    priceHistory: [],
  };
}

export function getTrackerCardSlot(tracker: TrackerSummary, id: number) {
  let offset = 0;

  for (const definition of getTrackerCardDefinitions(tracker)) {
    if (id > offset && id <= offset + definition.total) {
      return buildTrackerCardSlot(tracker, definition, id, id - offset);
    }

    offset += definition.total;
  }

  return undefined;
}

export function getTrackerCardName(tracker: TrackerSummary, id: number) {
  return getTrackerCardSlot(tracker, id)?.name || `${tracker.title} ${formatTrackerSerial(tracker, id)}/${tracker.total}`;
}

export function formatTrackerCardLabel(tracker: TrackerSummary, card: Pick<SerializedRingCard, 'cardTitle' | 'serialNumber' | 'serialTotal'>) {
  const serialLabel = `${card.serialNumber}/${card.serialTotal || tracker.total}`;
  return card.cardTitle && card.cardTitle !== tracker.title ? `${card.cardTitle} ${serialLabel}` : serialLabel;
}

export function getTrackerCardDeepLinkParams(tracker: TrackerSummary, card: Pick<SerializedRingCard, 'cardSlug' | 'serialNumber'>) {
  const params = new URLSearchParams();

  if (getTrackerCardDefinitions(tracker).length > 1 && card.cardSlug) {
    params.set('card', card.cardSlug);
  }

  params.set('serial', card.serialNumber);
  return params;
}

export function findTrackerCardByDeepLinkParams(
  tracker: TrackerSummary,
  cards: SerializedRingCard[],
  params: URLSearchParams
) {
  const slotId = getTrackerSlotIdFromDeepLinkParams(tracker, params);

  if (slotId) {
    return cards.find((card) => card.id === slotId);
  }

  return undefined;
}

export function getTrackerSlotIdFromDeepLinkParams(tracker: TrackerSummary, params: URLSearchParams) {
  const exactSlotId = Number(params.get('slot') || params.get('id') || '');

  if (Number.isInteger(exactSlotId) && exactSlotId > 0 && exactSlotId <= getTrackerTotalSlots(tracker)) {
    return exactSlotId;
  }

  const serial = params.get('serial');
  if (!serial) return undefined;

  const serialId = Number(serial);
  if (!Number.isInteger(serialId) || serialId < 1) return undefined;

  const cardSlug = params.get('card') || getTrackerCardDefinitions(tracker)[0]?.slug;
  if (!cardSlug) return undefined;

  return getTrackerSlotId(tracker, cardSlug, serialId);
}

export function createInitialTrackerCards(tracker: TrackerSummary): SerializedRingCard[] {
  const cards: SerializedRingCard[] = [];

  getTrackerCardDefinitions(tracker).forEach((definition) => {
    for (let index = 0; index < definition.total; index += 1) {
      cards.push(buildTrackerCardSlot(tracker, definition, cards.length + 1, index + 1));
    }
  });

  return cards;
}

export function normalizeTrackerCard(tracker: TrackerSummary, card: Partial<SerializedRingCard> & { id: number }): SerializedRingCard {
  const slot = getTrackerCardSlot(tracker, card.id);

  return {
    id: card.id,
    cardSlug: card.cardSlug || slot?.cardSlug,
    cardTitle: card.cardTitle || slot?.cardTitle,
    serialTotal: card.serialTotal || slot?.serialTotal || tracker.total,
    serialNumber: card.serialNumber || slot?.serialNumber || formatTrackerSerial(tracker, card.id),
    name: card.name || slot?.name || getTrackerCardName(tracker, card.id),
    found: Boolean(card.found),
    foundBy: card.foundBy,
    dateFound: card.dateFound,
    link: card.link,
    sourceType: card.sourceType,
    verificationStatus: card.verificationStatus || 'unverified',
    notes: card.notes,
    image: card.image || slot?.image || tracker.referenceImage,
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
  const latestDiscovery = [...foundCards].sort((a, b) => {
    const dateDifference = new Date(b.dateFound || 0).getTime() - new Date(a.dateFound || 0).getTime();
    if (dateDifference !== 0) return dateDifference;
    return b.id - a.id;
  })[0];

  return {
    foundCount: foundCards.length,
    confirmedCount: foundCards.filter((card) => card.verificationStatus === 'confirmed').length,
    pendingReportCount: submissions.filter((submission) => submission.status === 'pending').length,
    latestDiscovery: latestDiscovery ? {
      cardId: latestDiscovery.id,
      label: latestDiscovery.name,
      serialNumber: latestDiscovery.serialNumber,
      cardSlug: latestDiscovery.cardSlug,
      cardTitle: latestDiscovery.cardTitle,
      dateFound: latestDiscovery.dateFound,
      verificationStatus: latestDiscovery.verificationStatus,
    } : null,
  };
}

async function getStoredTrackerCardsSnapshot(redis: Pick<Redis, 'get'>, tracker: TrackerSummary) {
  const cards = await redis.get(tracker.storage.cardsKey);
  if (Array.isArray(cards) && cards.length > 0) {
    return cards.map((card) => normalizeTrackerCard(tracker, card));
  }

  for (const legacyKey of tracker.storage.legacyCardsKeys || []) {
    const legacyCards = await redis.get(legacyKey);
    if (Array.isArray(legacyCards) && legacyCards.length > 0) {
      return legacyCards.map((card) => normalizeTrackerCard(tracker, card));
    }
  }

  return [];
}

export async function getTrackerDirectoryStatsSnapshot(redis: Pick<Redis, 'get'>, tracker: TrackerSummary) {
  const [cards, submissions] = await Promise.all([
    getStoredTrackerCardsSnapshot(redis, tracker),
    redis.get(tracker.storage.submissionsKey),
  ]);

  return getTrackerDirectoryStats(
    cards,
    Array.isArray(submissions) ? submissions : []
  );
}

export async function getRecentTrackerDiscoveriesSnapshot(redis: Pick<Redis, 'get'>, trackers: TrackerSummary[], limit = 6) {
  const discoveries = await Promise.all(trackers.map(async (tracker) => {
    const cards = await getStoredTrackerCardsSnapshot(redis, tracker);

    return cards
      .filter((card) => card.found)
      .map((card): RecentTrackerDiscovery => ({
        trackerSlug: tracker.slug,
        trackerTitle: tracker.title,
        trackerHref: tracker.href,
        detailHref: `${tracker.href}?${getTrackerCardDeepLinkParams(tracker, card).toString()}`,
        cardId: card.id,
        cardTitle: card.cardTitle,
        serialNumber: card.serialNumber,
        serialTotal: card.serialTotal || tracker.total,
        label: formatTrackerCardLabel(tracker, card),
        foundBy: card.foundBy,
        dateFound: card.dateFound,
        verificationStatus: card.verificationStatus,
        sourceType: card.sourceType,
        price: card.price,
      }));
  }));

  return discoveries
    .flat()
    .sort((a, b) => {
      const dateDifference = new Date(b.dateFound || 0).getTime() - new Date(a.dateFound || 0).getTime();
      if (dateDifference !== 0) return dateDifference;
      return a.trackerTitle.localeCompare(b.trackerTitle) || a.label.localeCompare(b.label);
    })
    .slice(0, limit);
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

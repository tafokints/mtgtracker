import { Redis } from '@upstash/redis';
import { DiscoverySubmission, EvidenceImage, SerializedRingCard, VerificationStatus } from './types';
import { getDefinitionPrintingId, TrackerCardDefinition, TrackerSummary } from './trackers';
import { appendCardEvent, rebuildCardHistory } from './card-history';

export type ResolvedTrackerCardDefinition = Required<Pick<TrackerCardDefinition, 'slug' | 'title'>> & {
  total: number;
  serialPadding: number;
  referenceImage?: string;
  scryfallUrl?: string;
  canonicalTrackerSlug?: string;
  printingId?: string;
};

export interface RecentTrackerDiscovery {
  copyId?: string;
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
      canonicalTrackerSlug: definition.canonicalTrackerSlug,
      printingId: getDefinitionPrintingId(tracker, definition),
    }));
  }

  return [{
    slug: tracker.slug,
    title: tracker.title,
    total: tracker.total,
    serialPadding: tracker.serialPadding,
    referenceImage: tracker.referenceImage,
    printingId: getDefinitionPrintingId(tracker),
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
    copyId: `copy:${definition.printingId || `${tracker.slug}:${definition.slug}`}:${serialId}`,
    printingId: definition.printingId,
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

  const normalized: SerializedRingCard = {
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
    copyId: slot?.copyId,
    printingId: slot?.printingId,
    historyBaseline: card.historyBaseline,
    history: card.history || [],
    gradingHistory: card.gradingHistory || [],
    pendingReports: card.pendingReports || 0,
  };
  rebuildCardHistory(normalized);
  return normalized;
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
  const related = await relatedSnapshot(redis, tracker);
  if (related) return related.cards;
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
  const related = await relatedSnapshot(redis, tracker);
  if (related) return getTrackerDirectoryStats(related.cards, related.submissions);
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
        copyId: card.copyId,
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
    .filter((card, index, all) => all.findIndex((candidate) => (candidate.copyId || `${candidate.trackerSlug}:${candidate.cardId}`) === (card.copyId || `${card.trackerSlug}:${card.cardId}`)) === index)
    .sort((a, b) => {
      const dateDifference = new Date(b.dateFound || 0).getTime() - new Date(a.dateFound || 0).getTime();
      if (dateDifference !== 0) return dateDifference;
      return a.trackerTitle.localeCompare(b.trackerTitle) || a.label.localeCompare(b.label);
    })
    .slice(0, limit);
}

async function relatedSnapshot(redis: Pick<Redis, 'get'>, tracker: TrackerSummary) {
  const { relatedTrackers, decodeRelatedCards, projectRelatedState, cardOwner, hasRecordedFacts } = await import('./tracker-relationships');
  const related = relatedTrackers(tracker);
  if (related.length <= 1) return undefined;
  const states = new Map<string, { cards: SerializedRingCard[]; submissions: DiscoverySubmission[] }>();
  for (const candidate of related) {
    let stored = await redis.get(candidate.storage.cardsKey);
    if (stored == null) {
      for (const key of candidate.storage.legacyCardsKeys || []) {
        stored = await redis.get(key);
        if (stored != null) break;
      }
    }
    const cards = decodeRelatedCards(candidate, stored);
    if (cards.some((card) => cardOwner(candidate, card).slug !== candidate.slug && hasRecordedFacts(card))) throw new Error('Legacy shared copies require reconciliation');
    const submissions = await redis.get<DiscoverySubmission[]>(candidate.storage.submissionsKey);
    states.set(candidate.slug, { cards, submissions: submissions || [] });
  }
  return projectRelatedState(tracker, states);
}

export async function getTrackerCards(redis: Redis, tracker: TrackerSummary): Promise<SerializedRingCard[]> {
  const stored = await redis.get<SerializedRingCard[]>(tracker.storage.cardsKey);
  if (stored !== null && stored !== undefined) {
    if (!Array.isArray(stored) || stored.length === 0) throw new Error('Invalid stored tracker cards');
    return stored.map((card) => normalizeTrackerCard(tracker, card));
  }

  let cards = createInitialTrackerCards(tracker);
  for (const legacyKey of tracker.storage.legacyCardsKeys || []) {
    const legacyCards = await redis.get<SerializedRingCard[]>(legacyKey);
    if (Array.isArray(legacyCards) && legacyCards.length > 0) {
      cards = legacyCards.map((card) => normalizeTrackerCard(tracker, card));
      break;
    }
  }

  const initialized = await redis.set(tracker.storage.cardsKey, cards, { nx: true });
  if (initialized) return cards;

  const winner = await redis.get<SerializedRingCard[]>(tracker.storage.cardsKey);
  if (!Array.isArray(winner) || winner.length === 0) throw new Error('Invalid stored tracker cards');
  return winner.map((card) => normalizeTrackerCard(tracker, card));
}

export async function getTrackerSubmissions(redis: Redis, tracker: TrackerSummary) {
  const { getTrackerState } = await import('./tracker-store');
  return (await getTrackerState(redis, tracker)).submissions;
}

export function sortSubmissions(submissions: DiscoverySubmission[]) {
  return [...submissions].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
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
    applyCorrection?: boolean;
    eventId?: string;
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
  const recordedAt = submission.reviewedAt || submission.submittedAt;
  const eventId = options.eventId || `report:${submission.id}:${recordedAt}`;
  const facts = {
    found: true,
    foundBy: submission.foundBy,
    dateFound: submission.dateFound,
    link: submission.link,
    sourceType: submission.sourceType,
    verificationStatus: options.verificationStatus || submission.requestedVerificationStatus || 'source-linked',
    notes: submission.notes,
    image: approvedEvidence.concat(mergedEvidence).some((image) => image.url === selectedImageUrl) ? selectedImageUrl : undefined,
    evidenceImages: mergeEvidenceImages([], [
      ...approvedEvidence,
      ...mergedEvidence,
    ]),
  };
  appendCardEvent(cards[cardIndex], {
    id: eventId,
    kind: submission.kind === 'correction' && options.applyCorrection ? 'correction' : (cards[cardIndex].found ? 'sighting' : 'discovery'),
    recordedAt,
    sourceSubmissionId: submission.id,
    facts: Object.fromEntries(Object.entries(facts).filter(([, value]) => value !== undefined)),
    price: submission.price !== undefined ? {
      id: `price:${eventId}`, price: submission.price,
      date: submission.priceDate || '', kind: submission.priceKind || 'unknown', currency: submission.currency,
      sourceUrl: submission.link, sourceSubmissionId: submission.id, recordedAt,
    } : undefined,
    grading: submission.grading ? {
      id: `grading:${eventId}`, status: 'graded', grading: submission.grading,
      occurredOn: submission.grading.dateGraded, recordedAt, sourceSubmissionId: submission.id,
    } : undefined,
  });
  for (const merged of options.mergedEvidenceSubmissions || []) {
    const mergedId = `${eventId}:merged:${merged.id}`;
    appendCardEvent(cards[cardIndex], {
      id: mergedId, kind: 'sighting', recordedAt, sourceSubmissionId: submission.id,
      facts: Object.fromEntries(Object.entries({ notes: merged.notes, link: merged.link, dateFound: merged.dateFound, sourceType: merged.sourceType }).filter(([, value]) => value !== undefined)),
      price: merged.price !== undefined ? {
        id: `price:${mergedId}`, price: merged.price, kind: merged.priceKind || 'unknown', currency: merged.currency,
        date: merged.priceDate || '', sourceUrl: merged.link, sourceSubmissionId: merged.id, recordedAt,
      } : undefined,
      grading: merged.grading ? { id: `grading:${mergedId}`, status: 'graded', grading: merged.grading, occurredOn: merged.grading.dateGraded, recordedAt, sourceSubmissionId: merged.id } : undefined,
    });
  }

  return true;
}

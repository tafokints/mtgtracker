import { appendCardEvent } from './card-history';
import { normalizeSourceUrl } from './evidence-policy';
import { createInitialTrackerCards, getTrackerTotalSlots } from './tracker-data';
import type { DiscoverySubmission, GradingInfo, PriceHistoryEntry, SerializedRingCard, SourceType } from './types';
import type { TrackerSummary } from './trackers';

export const GOLDEN_CHOCOBO_LEGACY_SOURCE_URL = 'https://goldenchocobotracker.vercel.app/api/cards';
export const GOLDEN_CHOCOBO_LEGACY_CONFIRMATION = 'IMPORT_GOLDEN_CHOCOBO_LEGACY_FINDS';

const deterministicPrefix = 'legacy-golden-chocobo';
const migrationNote = 'Imported from the legacy Golden Chocobo tracker.';

interface NormalizedLegacyCard {
  id: number;
  name: string;
  found: boolean;
  foundBy?: string;
  dateFound?: string;
  link?: string;
  image?: string;
  price?: number;
  priceDate?: string;
  priceHistory: PriceHistoryEntry[];
  grading?: GradingInfo;
}

export interface GoldenChocoboLegacyImport {
  source: string;
  generatedAt: string;
  cards: SerializedRingCard[];
  submissions: DiscoverySubmission[];
  counts: {
    cards: number;
    found: number;
    submissions: number;
    sourceLinked: number;
    unverified: number;
    prices: number;
    graded: number;
  };
  missingSerials: string[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function serialForId(id: number, padding: number) {
  return String(id).padStart(padding, '0');
}

function normalizeGrading(value: unknown): GradingInfo | undefined {
  if (!record(value)) return undefined;
  const service = cleanString(value.service);
  const grade = parseNumber(value.grade);
  if (!service || grade === undefined || grade < 0 || grade > 10) return undefined;
  const sourceUrl = normalizeSourceUrl(value.sourceUrl);

  return {
    service,
    grade,
    dateGraded: cleanString(value.dateGraded) || undefined,
    certificateNumber: cleanString(value.certificateNumber) || undefined,
    sourceUrl,
  };
}

function normalizePriceHistory(value: unknown): PriceHistoryEntry[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry, index): PriceHistoryEntry[] => {
    if (!record(entry)) return [];
    const price = parseNumber(entry.price);
    if (price === undefined || price < 0) return [];
    const kind = ['asking-price', 'completed-sale', 'unknown'].includes(String(entry.kind))
      ? entry.kind as PriceHistoryEntry['kind']
      : 'unknown';
    const currency = cleanString(entry.currency);

    return [{
      id: cleanString(entry.id) || `${deterministicPrefix}-price-${index + 1}`,
      price,
      date: cleanString(entry.date),
      kind,
      currency: /^[A-Z]{3}$/.test(currency) ? currency : undefined,
      sourceUrl: normalizeSourceUrl(entry.sourceUrl),
      recordedAt: cleanString(entry.recordedAt) || undefined,
      soldBy: cleanString(entry.soldBy) || undefined,
      soldTo: cleanString(entry.soldTo) || undefined,
    }];
  });
}

function normalizeLegacyCard(rawCard: unknown, tracker: TrackerSummary): NormalizedLegacyCard {
  if (!record(rawCard)) throw new Error('Legacy API returned an invalid card record.');
  const id = parseNumber(rawCard.id);
  const total = getTrackerTotalSlots(tracker);
  if (!Number.isInteger(id) || id! < 1 || id! > total) {
    throw new Error(`Invalid Golden Chocobo id: ${rawCard.id}`);
  }

  return {
    id: id!,
    name: cleanString(rawCard.name) || `Golden Chocobo #${serialForId(id!, tracker.serialPadding)}`,
    found: Boolean(rawCard.found),
    foundBy: cleanString(rawCard.foundBy) || undefined,
    dateFound: cleanString(rawCard.dateFound) || undefined,
    link: cleanString(rawCard.link) || undefined,
    image: cleanString(rawCard.image) || undefined,
    price: parseNumber(rawCard.price),
    priceDate: cleanString(rawCard.priceDate) || undefined,
    priceHistory: normalizePriceHistory(rawCard.priceHistory),
    grading: normalizeGrading(rawCard.grading),
  };
}

export function inferGoldenChocoboLegacySourceType(url: string | undefined): SourceType {
  if (!url) return 'other';
  let hostname = '';
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'other';
  }

  if (['ebay.com', 'ebay.us', 'i.ebayimg.com', 'tcgplayer.com'].includes(hostname)) return 'marketplace';
  if (['psacard.com', 'cgccards.com'].includes(hostname)) return 'grading-pop';
  if (['instagram.com', 'facebook.com', 'reddit.com', 'x.com', 'twitter.com', 'youtube.com', 'youtu.be', 'imgur.com'].includes(hostname)) return 'social';
  if (hostname === 'magic.wizards.com') return 'article';
  return 'other';
}

function legacyNotes(card: NormalizedLegacyCard, normalizedLink: string | undefined) {
  return [
    'Prepared from the legacy Golden Chocobo tracker API for migration.',
    card.link && !normalizedLink ? `Legacy source link needs manual review: ${card.link}` : undefined,
    card.image ? `Legacy image path: ${card.image}` : undefined,
    card.priceDate && card.price !== undefined ? `Legacy price date: ${card.priceDate}` : undefined,
  ].filter(Boolean).join('\n');
}

export function buildGoldenChocoboLegacySummary(rawCards: unknown[], tracker: TrackerSummary) {
  const normalized = rawCards.map((card) => normalizeLegacyCard(card, tracker));
  const found = normalized.filter((card) => card.found);

  return {
    total: normalized.length,
    found: found.length,
    missing: normalized.length - found.length,
    foundSerials: found.map((card) => serialForId(card.id, tracker.serialPadding)),
  };
}

export function buildGoldenChocoboLegacyFindImport(
  tracker: TrackerSummary,
  rawCards: unknown[],
  options: {
    generatedAt?: string;
    reviewedBy?: string;
    source?: string;
  } = {},
): GoldenChocoboLegacyImport {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const source = options.source || GOLDEN_CHOCOBO_LEGACY_SOURCE_URL;
  const reviewedBy = options.reviewedBy || 'legacy-import';
  const trackerTotal = getTrackerTotalSlots(tracker);
  const normalized = rawCards.map((card) => normalizeLegacyCard(card, tracker));
  if (normalized.length !== trackerTotal) {
    throw new Error(`Legacy API returned ${normalized.length} records; expected ${trackerTotal}.`);
  }

  const seen = new Set<number>();
  for (const card of normalized) {
    if (seen.has(card.id)) throw new Error(`Legacy API returned duplicate Golden Chocobo id ${card.id}.`);
    seen.add(card.id);
  }

  const cards = createInitialTrackerCards(tracker);
  const submissions: DiscoverySubmission[] = [];

  for (const legacyCard of normalized) {
    const card = cards.find((candidate) => candidate.id === legacyCard.id);
    if (!card || !legacyCard.found) continue;

    const normalizedLink = normalizeSourceUrl(legacyCard.link);
    const sourceType = inferGoldenChocoboLegacySourceType(normalizedLink || legacyCard.link);
    const verificationStatus = normalizedLink ? 'source-linked' : 'unverified';
    const notes = legacyNotes(legacyCard, normalizedLink);
    const submissionId = `${deterministicPrefix}-${card.serialNumber}`;
    const submittedAt = legacyCard.dateFound
      ? `${legacyCard.dateFound}T00:00:00.000Z`
      : generatedAt;
    const priceHistory = [
      ...legacyCard.priceHistory,
      legacyCard.price !== undefined
        ? {
            id: `${submissionId}-price`,
            price: legacyCard.price,
            date: legacyCard.priceDate || '',
            kind: 'unknown' as const,
            currency: 'USD',
            sourceUrl: normalizedLink,
            sourceSubmissionId: submissionId,
            recordedAt: generatedAt,
          }
        : undefined,
    ].filter(Boolean) as PriceHistoryEntry[];

    const submission: DiscoverySubmission = {
      id: submissionId,
      copyId: card.copyId,
      originTrackerSlug: tracker.slug,
      originCardId: card.id,
      kind: 'discovery',
      cardId: card.id,
      cardSlug: card.cardSlug,
      cardTitle: card.cardTitle,
      serialTotal: card.serialTotal,
      serialNumber: card.serialNumber,
      foundBy: legacyCard.foundBy,
      dateFound: legacyCard.dateFound,
      link: normalizedLink,
      sourceType,
      requestedVerificationStatus: verificationStatus,
      price: legacyCard.price,
      priceKind: legacyCard.price !== undefined ? 'unknown' : undefined,
      currency: legacyCard.price !== undefined ? 'USD' : undefined,
      priceDate: legacyCard.priceDate,
      grading: legacyCard.grading,
      evidenceImages: [],
      notes,
      status: 'approved',
      submittedAt,
      reviewedAt: generatedAt,
      reviewedBy,
      reviewNotes: migrationNote,
      reviewHistory: [{
        id: `${submissionId}-review`,
        action: 'legacy-import',
        at: generatedAt,
        actor: 'admin',
        actorId: reviewedBy,
        notes: migrationNote,
      }],
    };

    submissions.push(submission);
    appendCardEvent(card, {
      id: `report:${submissionId}:${generatedAt}`,
      kind: 'discovery',
      recordedAt: generatedAt,
      sourceSubmissionId: submissionId,
      facts: {
        found: true,
        foundBy: legacyCard.foundBy,
        dateFound: legacyCard.dateFound,
        link: normalizedLink,
        sourceType,
        verificationStatus,
        notes,
        priceHistory,
        grading: legacyCard.grading,
      },
      price: legacyCard.price !== undefined ? {
        id: `price:report:${submissionId}:${generatedAt}`,
        price: legacyCard.price,
        date: legacyCard.priceDate || '',
        kind: 'unknown',
        currency: 'USD',
        sourceUrl: normalizedLink,
        sourceSubmissionId: submissionId,
        recordedAt: generatedAt,
      } : undefined,
      grading: legacyCard.grading ? {
        id: `grading:report:${submissionId}:${generatedAt}`,
        status: 'graded',
        grading: legacyCard.grading,
        occurredOn: legacyCard.grading.dateGraded,
        recordedAt: generatedAt,
        sourceSubmissionId: submissionId,
      } : undefined,
    });
  }

  const foundCards = cards.filter((card) => card.found);
  return {
    source,
    generatedAt,
    cards,
    submissions,
    counts: {
      cards: cards.length,
      found: foundCards.length,
      submissions: submissions.length,
      sourceLinked: submissions.filter((submission) => submission.requestedVerificationStatus === 'source-linked').length,
      unverified: submissions.filter((submission) => submission.requestedVerificationStatus === 'unverified').length,
      prices: submissions.filter((submission) => submission.price !== undefined).length,
      graded: submissions.filter((submission) => submission.grading).length,
    },
    missingSerials: cards.filter((card) => !card.found).map((card) => card.serialNumber),
  };
}

export async function fetchGoldenChocoboLegacyCards(source = GOLDEN_CHOCOBO_LEGACY_SOURCE_URL) {
  const response = await fetch(source, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'MTGTrackers/0.1 GoldenChocoboMigration contact mtgtrackers.com',
    },
  });

  if (!response.ok) throw new Error(`Legacy API returned ${response.status} ${response.statusText}`);
  const cards = await response.json();
  if (!Array.isArray(cards)) throw new Error('Legacy API did not return a card array.');
  return cards;
}

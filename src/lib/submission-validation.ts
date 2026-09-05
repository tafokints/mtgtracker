import { GradingInfo, PriceHistoryEntry, ReportKind, SourceType, VerificationStatus } from './types';
import { parseGradingInfo, parsePriceObservation } from './history-validation';
import { isDateOnly } from './admin-validation';
import { EVIDENCE_ID, MAX_EVIDENCE_IMAGES, normalizeSourceUrl } from './evidence-policy';

const SOURCE_TYPES: SourceType[] = ['marketplace', 'grading-pop', 'social', 'article', 'private-sale', 'other'];
const VERIFICATION_STATUSES: VerificationStatus[] = ['unverified', 'source-linked', 'confirmed'];
const MAX_NOTE_LENGTH = 1200;
const MAX_NAME_LENGTH = 120;

export interface ValidatedSubmissionInput {
  cardId: number;
  foundBy?: string;
  dateFound?: string;
  link?: string;
  sourceType: SourceType;
  verificationStatus: VerificationStatus;
  price?: number;
  evidenceAssetIds: string[];
  notes?: string;
  kind: ReportKind;
  priceKind?: PriceHistoryEntry['kind'];
  currency?: string;
  priceDate?: string;
  grading?: GradingInfo;
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateDiscoverySubmission(input: unknown, totalCards: number) {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const errors: string[] = [];
  const cardId = typeof body.cardId === 'number' || (typeof body.cardId === 'string' && /^\d+$/.test(body.cardId))
    ? Number(body.cardId) : NaN;

  if (!Number.isInteger(cardId) || cardId < 1 || cardId > totalCards) {
    errors.push(`Serial slot must be between 1 and ${totalCards}.`);
  }

  const foundBy = cleanString(body.foundBy);
  if (foundBy.length > MAX_NAME_LENGTH) {
    errors.push(`Found by must be ${MAX_NAME_LENGTH} characters or fewer.`);
  }

  const dateFound = cleanString(body.dateFound);
  if (dateFound && !isDateOnly(dateFound)) {
    errors.push('Date found must be a valid date.');
  }

  const rawLink = cleanString(body.link);
  const link = normalizeSourceUrl(rawLink);
  if (rawLink && !link) {
    errors.push('Use a direct HTTPS eBay listing, TCGplayer product, Reddit/X/Instagram post, PSA/CGC certificate, or Wizards article. For other sources, leave this blank and include context in notes.');
  }

  const sourceType = cleanString(body.sourceType) || 'other';
  if (!SOURCE_TYPES.includes(sourceType as SourceType)) {
    errors.push('Source type is not valid.');
  }

  const verificationStatus = cleanString(body.verificationStatus) || 'source-linked';
  if (!VERIFICATION_STATUSES.includes(verificationStatus as VerificationStatus)) {
    errors.push('Evidence level is not valid.');
  }

  const priceInput = typeof body.price === 'number' ? String(body.price) : cleanString(body.price);
  const price = priceInput ? Number(priceInput) : undefined;
  if (priceInput && (!Number.isFinite(price) || price! < 0)) {
    errors.push('Sale price must be a non-negative number.');
  }
  const kind = body.kind ?? 'discovery';
  if (!['discovery', 'sighting', 'correction'].includes(String(kind))) errors.push('Invalid report type.');
  let priceObservation: PriceHistoryEntry | undefined;
  let grading: GradingInfo | undefined;
  try {
    if (price !== undefined) priceObservation = parsePriceObservation({ price, kind: body.priceKind, currency: body.currency, date: body.priceDate });
    if (body.grading !== undefined) grading = parseGradingInfo(body.grading);
  } catch (error) { errors.push((error as Error).message); }

  if (body.imageUrl || (Array.isArray(body.evidenceImageUrls) ? body.evidenceImageUrls.length : body.evidenceImageUrls) || body.evidenceImages) {
    errors.push('External image URLs are not accepted. Upload evidence files instead.');
  }
  const rawIds = body.evidenceAssetIds ?? [];
  const evidenceAssetIds = Array.isArray(rawIds) ? [...new Set(rawIds)] : [];
  if (!Array.isArray(rawIds) || rawIds.length > MAX_EVIDENCE_IMAGES || evidenceAssetIds.some((id) => typeof id !== 'string' || !EVIDENCE_ID.test(id))) {
    errors.push(`Include no more than ${MAX_EVIDENCE_IMAGES} valid uploaded evidence IDs.`);
  }

  if (verificationStatus === 'confirmed' && !link && evidenceAssetIds.length === 0) {
    errors.push('Looks confirmed reports need a source link or evidence image.');
  }

  const notes = cleanString(body.notes);
  if (notes.length > MAX_NOTE_LENGTH) {
    errors.push(`Notes must be ${MAX_NOTE_LENGTH} characters or fewer.`);
  }

  if (!link && evidenceAssetIds.length === 0 && !notes) {
    errors.push('Please include a source link, evidence image, or note for review.');
  }

  const value: ValidatedSubmissionInput = {
    cardId,
    foundBy: foundBy || undefined,
    dateFound: dateFound || undefined,
    link: link || undefined,
    sourceType: sourceType as SourceType,
    verificationStatus: verificationStatus as VerificationStatus,
    price,
    evidenceAssetIds: evidenceAssetIds as string[],
    notes: notes || undefined,
    kind: kind as ReportKind,
    priceKind: priceObservation?.kind,
    currency: priceObservation?.currency,
    priceDate: priceObservation?.date,
    grading,
  };

  return {
    errors,
    value,
  };
}

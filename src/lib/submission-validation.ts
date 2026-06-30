import { EvidenceImage, SourceType, VerificationStatus } from './types';

const SOURCE_TYPES: SourceType[] = ['marketplace', 'grading-pop', 'social', 'article', 'private-sale', 'other'];
const VERIFICATION_STATUSES: VerificationStatus[] = ['unverified', 'source-linked', 'confirmed'];
const MAX_NOTE_LENGTH = 1200;
const MAX_NAME_LENGTH = 120;
const MAX_EVIDENCE_IMAGES = 8;

export interface ValidatedSubmissionInput {
  cardId: number;
  foundBy?: string;
  dateFound?: string;
  link?: string;
  sourceType: SourceType;
  verificationStatus: VerificationStatus;
  price?: number;
  imageUrl?: string;
  evidenceImages: EvidenceImage[];
  notes?: string;
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseEvidenceUrls(rawValue: unknown, primaryImageUrl?: string) {
  const values = Array.isArray(rawValue)
    ? rawValue
    : typeof rawValue === 'string'
      ? rawValue.split(/\r?\n|,/)
      : [];

  return Array.from(new Set([
    primaryImageUrl,
    ...values.map((value) => cleanString(value)),
  ].filter(Boolean) as string[]));
}

export function validateDiscoverySubmission(body: any, totalCards: number) {
  const errors: string[] = [];
  const cardId = parseInt(body.cardId, 10);

  if (!Number.isInteger(cardId) || cardId < 1 || cardId > totalCards) {
    errors.push(`Serial number must be between 1 and ${totalCards}.`);
  }

  const foundBy = cleanString(body.foundBy);
  if (foundBy.length > MAX_NAME_LENGTH) {
    errors.push(`Found by must be ${MAX_NAME_LENGTH} characters or fewer.`);
  }

  const dateFound = cleanString(body.dateFound);
  if (dateFound && Number.isNaN(new Date(dateFound).getTime())) {
    errors.push('Date found must be a valid date.');
  }

  const link = cleanString(body.link);
  if (link && !isValidHttpUrl(link)) {
    errors.push('Source link must be a valid http(s) URL.');
  }

  const sourceType = cleanString(body.sourceType) || 'other';
  if (!SOURCE_TYPES.includes(sourceType as SourceType)) {
    errors.push('Source type is not valid.');
  }

  const verificationStatus = cleanString(body.verificationStatus) || 'source-linked';
  if (!VERIFICATION_STATUSES.includes(verificationStatus as VerificationStatus)) {
    errors.push('Evidence level is not valid.');
  }

  const priceInput = cleanString(body.price);
  const price = priceInput ? Number(priceInput) : undefined;
  if (priceInput && (!Number.isFinite(price) || price! < 0)) {
    errors.push('Sale price must be a non-negative number.');
  }

  const imageUrl = cleanString(body.imageUrl);
  if (imageUrl && !isValidHttpUrl(imageUrl)) {
    errors.push('Primary image URL must be a valid http(s) URL.');
  }

  const evidenceUrls = parseEvidenceUrls(body.evidenceImageUrls, imageUrl);
  if (evidenceUrls.length > MAX_EVIDENCE_IMAGES) {
    errors.push(`Please submit no more than ${MAX_EVIDENCE_IMAGES} evidence image URLs.`);
  }

  const invalidEvidenceUrl = evidenceUrls.find((url) => !isValidHttpUrl(url));
  if (invalidEvidenceUrl) {
    errors.push('Evidence image URLs must be valid http(s) URLs.');
  }

  const notes = cleanString(body.notes);
  if (notes.length > MAX_NOTE_LENGTH) {
    errors.push(`Notes must be ${MAX_NOTE_LENGTH} characters or fewer.`);
  }

  if (!link && evidenceUrls.length === 0 && !notes) {
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
    imageUrl: imageUrl || undefined,
    evidenceImages: evidenceUrls.map((url) => ({ url })),
    notes: notes || undefined,
  };

  return {
    errors,
    value,
  };
}

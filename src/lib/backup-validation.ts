import { isDateOnly, isSafeImageUrl } from '@/lib/admin-validation';
import { getTrackerCardSlot } from '@/lib/tracker-data';
import type { TrackerSummary } from '@/lib/trackers';

const verificationStatuses = ['unverified', 'source-linked', 'confirmed'];
const sourceTypes = ['marketplace', 'grading-pop', 'social', 'article', 'private-sale', 'other'];

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalStrings(value: Record<string, unknown>, fields: string[]) {
  return fields.every((field) => value[field] === undefined || typeof value[field] === 'string');
}

function amount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function optionalUrl(value: unknown) {
  return value === undefined || value === '' || isSafeImageUrl(value);
}

function evidence(value: unknown) {
  return value === undefined || (Array.isArray(value) && value.every((item) => (
    record(item) && isSafeImageUrl(item.url) && optionalUrl(item.sourceUrl) &&
    optionalStrings(item, ['caption', 'sourceSubmissionId']) &&
    (item.sourceType === undefined || sourceTypes.includes(item.sourceType as string))
  )));
}

function identity(value: Record<string, unknown>, tracker: TrackerSummary, id: number) {
  const slot = getTrackerCardSlot(tracker, id);
  return slot && ['cardSlug', 'cardTitle', 'serialTotal', 'serialNumber'].every((field) => (
    value[field] === undefined || value[field] === slot[field as keyof typeof slot]
  ));
}

export function validBackupCard(value: unknown, tracker: TrackerSummary): boolean {
  if (!record(value) || typeof value.id !== 'number' || !identity(value, tracker, value.id)) return false;
  if (!optionalStrings(value, ['name', 'foundBy', 'dateFound', 'notes', 'priceDate'])) return false;
  if (value.found !== undefined && typeof value.found !== 'boolean') return false;
  if (value.price !== undefined && !amount(value.price)) return false;
  if (value.pendingReports !== undefined && (!amount(value.pendingReports) || !Number.isSafeInteger(value.pendingReports))) return false;
  if (value.verificationStatus !== undefined && !verificationStatuses.includes(value.verificationStatus as string)) return false;
  if (value.sourceType !== undefined && !sourceTypes.includes(value.sourceType as string)) return false;
  if (!optionalUrl(value.image) || !optionalUrl(value.link) || !evidence(value.evidenceImages)) return false;
  if (value.priceHistory !== undefined && (!Array.isArray(value.priceHistory) || !value.priceHistory.every((item) => (
    record(item) && amount(item.price) && isDateOnly(item.date) && optionalStrings(item, ['soldBy', 'soldTo'])
  )))) return false;
  if (value.grading !== undefined && (
    !record(value.grading) || typeof value.grading.service !== 'string' || !value.grading.service.trim() ||
    !amount(value.grading.grade) || value.grading.grade > 10 ||
    (value.grading.dateGraded !== undefined && !isDateOnly(value.grading.dateGraded))
  )) return false;
  return true;
}

export function validBackupSubmission(value: unknown, tracker: TrackerSummary): boolean {
  if (!record(value) || typeof value.cardId !== 'number' || !identity(value, tracker, value.cardId)) return false;
  if (!optionalStrings(value, ['foundBy', 'dateFound', 'notes', 'reviewedAt', 'reviewedBy', 'reviewNotes', 'duplicateOf'])) return false;
  if (typeof value.submittedAt !== 'string' || !Number.isFinite(Date.parse(value.submittedAt))) return false;
  if (value.price !== undefined && !amount(value.price)) return false;
  if (value.requestedVerificationStatus !== undefined && !verificationStatuses.includes(value.requestedVerificationStatus as string)) return false;
  if (value.sourceType !== undefined && !sourceTypes.includes(value.sourceType as string)) return false;
  if (!optionalUrl(value.imageUrl) || !optionalUrl(value.link) || !evidence(value.evidenceImages)) return false;
  if (value.duplicateSubmissionIds !== undefined && (!Array.isArray(value.duplicateSubmissionIds) || !value.duplicateSubmissionIds.every((id) => typeof id === 'string'))) return false;
  return true;
}

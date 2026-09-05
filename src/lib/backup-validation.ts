import { isDateOnly, isSafeImageUrl } from '@/lib/admin-validation';
import { getTrackerCardSlot } from '@/lib/tracker-data';
import { getTracker, type TrackerSummary } from '@/lib/trackers';
import { parseGradingInfo, parsePriceObservation } from './history-validation';

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
  return slot && ['copyId', 'printingId', 'cardSlug', 'cardTitle', 'serialTotal', 'serialNumber'].every((field) => (
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
    record(item) && validPrice(item)
  )))) return false;
  if (value.grading !== undefined && (
    !record(value.grading) || typeof value.grading.service !== 'string' || !value.grading.service.trim() ||
    !amount(value.grading.grade) || value.grading.grade > 10 ||
    (value.grading.dateGraded !== undefined && !isDateOnly(value.grading.dateGraded))
  )) return false;
  if (value.grading !== undefined) { try { parseGradingInfo(value.grading); } catch { return false; } }
  if (value.historyBaseline !== undefined) {
    if (!record(value.historyBaseline) || typeof value.historyBaseline.found !== 'boolean' || !verificationStatuses.includes(String(value.historyBaseline.verificationStatus)) || !Array.isArray(value.historyBaseline.priceHistory) || 'history' in value.historyBaseline || 'historyBaseline' in value.historyBaseline || !validFacts(value.historyBaseline, tracker, value.id)) return false;
  }
  if (value.history !== undefined) {
    if (!Array.isArray(value.history) || (value.history.length && !value.historyBaseline)) return false;
    const seen = new Set<string>();
    for (const event of value.history) {
      if (!record(event) || typeof event.id !== 'string' || !event.id || seen.has(event.id) || typeof event.recordedAt !== 'string' || !Number.isFinite(Date.parse(event.recordedAt)) || !['discovery', 'sighting', 'correction', 'price', 'grading', 'image', 'retraction'].includes(String(event.kind))) return false;
      if (event.facts !== undefined && (!record(event.facts) || !validFacts(event.facts, tracker, value.id))) return false;
      if (event.price !== undefined && (!record(event.price) || !validPrice(event.price))) return false;
      if (event.grading !== undefined && !validGradingEvent(event.grading)) return false;
      if (!optionalStrings(event, ['sourceSubmissionId'])) return false;
      if (event.kind === 'retraction' && (!Array.isArray(event.retracts) || !event.retracts.length || event.retracts.some((id) => typeof id !== 'string' || !seen.has(id)))) return false;
      if (event.kind !== 'retraction' && event.retracts !== undefined) return false;
      seen.add(event.id);
    }
  }
  if (value.gradingHistory !== undefined && (!Array.isArray(value.gradingHistory) || !value.gradingHistory.every(validGradingEvent))) return false;
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
  if (value.kind !== undefined && !['discovery', 'sighting', 'correction'].includes(String(value.kind))) return false;
  if (value.price !== undefined && !validPrice({ price: value.price, kind: value.priceKind, currency: value.currency, date: value.priceDate })) return false;
  if (value.grading !== undefined) { try { parseGradingInfo(value.grading); } catch { return false; } }
  if (value.originTrackerSlug !== undefined) {
    const origin = getTracker(String(value.originTrackerSlug));
    if (!origin || typeof value.originCardId !== 'number' || getTrackerCardSlot(origin, value.originCardId)?.copyId !== getTrackerCardSlot(tracker, value.cardId)?.copyId) return false;
  }
  if (value.reviewHistory !== undefined && (!Array.isArray(value.reviewHistory) || !value.reviewHistory.every((event) => record(event) && typeof event.id === 'string' && typeof event.action === 'string' && ['admin', 'submitter'].includes(String(event.actor)) && typeof event.at === 'string' && Number.isFinite(Date.parse(event.at)) && optionalStrings(event, ['notes', 'actorId'])))) return false;
  if (value.followUps !== undefined && (!Array.isArray(value.followUps) || !value.followUps.every((reply) => record(reply) && typeof reply.id === 'string' && typeof reply.at === 'string' && Number.isFinite(Date.parse(reply.at)) && typeof reply.notes === 'string' && reply.notes.length <= 1200 && (reply.evidenceAssetIds === undefined || (Array.isArray(reply.evidenceAssetIds) && reply.evidenceAssetIds.length <= 8 && reply.evidenceAssetIds.every((id) => typeof id === 'string')))))) return false;
  return true;
}

function validPrice(value: Record<string, unknown>) {
  try { parsePriceObservation(value); return optionalStrings(value, ['id', 'sourceSubmissionId', 'recordedAt']); } catch { return false; }
}

function validGradingEvent(value: unknown) {
  if (!record(value) || typeof value.id !== 'string' || typeof value.recordedAt !== 'string' || (value.recordedAt !== '' && !Number.isFinite(Date.parse(value.recordedAt))) || (value.occurredOn !== undefined && !isDateOnly(value.occurredOn)) || !['graded', 'ungraded'].includes(String(value.status))) return false;
  try { if (value.status === 'graded') parseGradingInfo(value.grading); return true; } catch { return false; }
}

function validFacts(value: Record<string, unknown>, tracker: TrackerSummary, id: number) {
  const fields = ['found', 'foundBy', 'dateFound', 'link', 'sourceType', 'verificationStatus', 'notes', 'image', 'evidenceImages', 'price', 'priceDate', 'priceHistory', 'grading'];
  return Object.keys(value).every((key) => fields.includes(key)) && validBackupCard({ ...value, id }, tracker);
}

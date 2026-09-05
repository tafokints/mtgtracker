import { isDateOnly, parseNonNegativeNumber } from './admin-validation';
import { normalizeSourceUrl } from './evidence-policy';
import type { GradingInfo, PriceHistoryEntry } from './types';

export function parsePriceObservation(input: Record<string, unknown>): PriceHistoryEntry {
  const price = parseNonNegativeNumber(input.price);
  const kind = input.kind ?? 'unknown';
  const date = input.date ?? '';
  const currency = input.currency;
  if (price === undefined || price > 1e10 || !['unknown', 'asking-price', 'completed-sale'].includes(String(kind))) throw new Error('Invalid price observation');
  if (typeof date !== 'string' || (date && !isDateOnly(date))) throw new Error('Invalid price date');
  if (currency !== undefined && (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency))) throw new Error('Use a three-letter currency code');
  if (kind !== 'unknown' && (!date || !currency)) throw new Error('A price type requires its own date and currency');
  const sourceUrl = input.sourceUrl ? normalizeSourceUrl(String(input.sourceUrl)) : undefined;
  if (input.sourceUrl && !sourceUrl) throw new Error('Unsupported price source');
  if ([input.soldBy, input.soldTo].some((value) => value !== undefined && (typeof value !== 'string' || value.length > 120))) throw new Error('Invalid sale parties');
  return { price, kind: kind as PriceHistoryEntry['kind'], date, currency: currency as string | undefined, sourceUrl, soldBy: input.soldBy as string | undefined, soldTo: input.soldTo as string | undefined };
}

export function parseGradingInfo(input: unknown): GradingInfo {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid grading details');
  const value = input as Record<string, unknown>;
  const grade = parseNonNegativeNumber(value.grade);
  if (typeof value.service !== 'string' || !value.service.trim() || value.service.length > 80 || grade === undefined || grade > 10) throw new Error('Invalid grading service or grade');
  if (value.dateGraded !== undefined && (typeof value.dateGraded !== 'string' || !isDateOnly(value.dateGraded))) throw new Error('Invalid grading date');
  if (value.certificateNumber !== undefined && (typeof value.certificateNumber !== 'string' || value.certificateNumber.length > 100)) throw new Error('Invalid certificate number');
  const sourceUrl = value.sourceUrl ? normalizeSourceUrl(String(value.sourceUrl)) : undefined;
  if (value.sourceUrl && !sourceUrl) throw new Error('Unsupported grading source');
  return { service: value.service.trim(), grade, dateGraded: value.dateGraded as string | undefined, certificateNumber: value.certificateNumber as string | undefined, sourceUrl };
}

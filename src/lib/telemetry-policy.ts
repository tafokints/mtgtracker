import type { Redis } from '@upstash/redis';
import { getTracker } from './trackers';
import { serializedCatalog } from './serialized-catalog';
import { formatTrackerSerial, getTrackerCardDefinitions, getTrackerTotalSlots } from './tracker-data';
import { checkRateLimit, getClientIp } from './rate-limit';
import { NextResponse } from 'next/server';

export const TELEMETRY_RETENTION_SECONDS = 90 * 86400;
const FILTERS = new Set(['all', 'found', 'pending', 'not-found', 'confirmed', 'source-linked', 'has-evidence', 'source-marketplace', 'source-grading-pop', 'source-social', 'source-article', 'source-private-sale', 'source-other']);
const SORTS = new Set(['id-asc', 'id-desc', 'price-desc', 'price-asc', 'date-desc', 'date-asc', 'evidence-desc']);

export function boundedContext(trackerSlug: string, input: Record<string, unknown>) {
  const tracker = getTracker(trackerSlug);
  const definitions = tracker ? getTrackerCardDefinitions(tracker) : [];
  const cardSlugs = new Set(definitions.map((card) => card.slug));
  if (trackerSlug === 'default') serializedCatalog.forEach((entry) => cardSlugs.add(entry.slug));
  if (trackerSlug === 'one-ring') cardSlugs.add('the-one-ring');
  const maxSerial = Math.max(0, ...definitions.map((card) => card.total));
  const serial = typeof input.serial === 'string' && /^\d{1,4}$/.test(input.serial) ? Number(input.serial) : 0;
  const slot = typeof input.slot === 'string' && /^\d{1,6}$/.test(input.slot) ? Number(input.slot) : 0;
  const values = {
    query: typeof input.query === 'string' ? input.query.slice(0, 80) : undefined,
    filter: FILTERS.has(String(input.filter)) ? String(input.filter) : undefined,
    sort: SORTS.has(String(input.sort)) ? String(input.sort) : undefined,
    cardFilter: input.cardFilter === 'all' || cardSlugs.has(String(input.cardFilter)) ? String(input.cardFilter) : undefined,
    card: cardSlugs.has(String(input.card)) ? String(input.card) : undefined,
    serial: tracker && serial >= 1 && serial <= maxSerial ? formatTrackerSerial(tracker, serial) : undefined,
    slot: tracker && slot >= 1 && slot <= getTrackerTotalSlots(tracker) ? String(slot) : undefined,
  };
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as Partial<Record<keyof typeof values, string>>;
}

export async function limitTelemetry(redis: Redis, request: Request) {
  for (const [key, limit, windowSeconds] of [[`rate-limit:telemetry:${getClientIp(request)}`, 120, 3600], ['rate-limit:telemetry:site', 20000, 86400]] as const) {
    if (!(await checkRateLimit(redis, { key, limit, windowSeconds })).allowed) return NextResponse.json({ message: 'Telemetry limit reached' }, { status: 429, headers: { 'Retry-After': String(windowSeconds) } });
  }
  return null;
}

export const INCREMENT_TELEMETRY = `
-- increment daily telemetry with bounded retention
local count = redis.call('INCR', KEYS[1])
if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count
`;

export function incrementTelemetry(redis: Redis, key: string) {
  return key.includes(':total:') ? redis.incr(key) : redis.eval(INCREMENT_TELEMETRY, [key], [TELEMETRY_RETENTION_SECONDS]);
}

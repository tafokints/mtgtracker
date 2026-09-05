import type { Redis } from '@upstash/redis';
import { allTrackers, getTracker } from './trackers';
import { getTrackerCardSlot } from './tracker-data';
import { ACTIVE_PRINTING_TRACKERS_KEY } from './tracker-store';
import type { DiscoverySubmission, SubmissionStatus } from './types';

export const INBOX_STATUSES = ['pending', 'needs-more-info', 'approved', 'rejected', 'duplicate', 'cannot-verify', 'revoked', 'all'] as const;
export type InboxStatus = typeof INBOX_STATUSES[number];
export interface InboxRow {
  id: string; tracker: string; trackerTitle: string; cardTitle: string;
  serial: string; status: SubmissionStatus; kind: string; submittedAt: string;
  imageCount: number; hasSource: boolean;
}
export interface InboxPage { rows: InboxRow[]; nextCursor: string | null }
interface Cursor { tracker: string; after: string; filter: string }
export class InboxInputError extends Error {}
const PAGE_SIZE = 20;
const TRACKER_READ_BUDGET = 8;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const reportKey = (report: DiscoverySubmission) => `${report.submittedAt}\0${report.id}`;

export async function readAdminInbox(redis: Redis, params: URLSearchParams): Promise<InboxPage> {
  const status = params.get('status') || 'pending';
  const selected = params.get('tracker') || '';
  if (!INBOX_STATUSES.includes(status as InboxStatus) || (selected && getTracker(selected)?.status !== 'live')) throw new InboxInputError('Invalid inbox filter');
  const filter = `${status}:${selected}`;
  let cursor: Cursor | undefined;
  const encoded = params.get('cursor');
  if (encoded) {
    try {
      if (encoded.length > 1800 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error();
      cursor = JSON.parse(Buffer.from(encoded, 'base64url').toString());
      if (!cursor || cursor.filter !== filter || typeof cursor.tracker !== 'string' || getTracker(cursor.tracker)?.status !== 'live' ||
        typeof cursor.after !== 'string' || cursor.after.length > 400 || (selected && selected !== cursor.tracker)) throw new Error();
    } catch { throw new InboxInputError('Invalid or mismatched inbox cursor'); }
  }
  const active = selected ? [] : await redis.smembers<string[]>(ACTIVE_PRINTING_TRACKERS_KEY);
  const candidates = allTrackers.filter((tracker) => tracker.status === 'live' &&
    (selected ? tracker.slug === selected : !tracker.catalogGenerated || active.includes(tracker.slug)))
    .sort((a, b) => compare(a.slug, b.slug));
  const rows: InboxRow[] = [];
  let reads = 0;
  const next = (tracker: string, after = '') => Buffer.from(JSON.stringify({ tracker, after, filter })).toString('base64url');
  for (const tracker of candidates) {
    if (cursor && compare(tracker.slug, cursor.tracker) < 0) continue;
    if (reads >= TRACKER_READ_BUDGET) return { rows, nextCursor: next(tracker.slug) };
    reads++;
    // Read original reports, not projected shared-copy queues; never initialize empty card arrays.
    const stored = await redis.get<DiscoverySubmission[]>(tracker.storage.submissionsKey);
    if (stored !== null && !Array.isArray(stored)) throw new Error('Invalid report storage');
    const reports = (stored || []).filter((report) => status === 'all' || report.status === status)
      .sort((a, b) => compare(reportKey(a), reportKey(b)));
    let after = cursor?.tracker === tracker.slug ? cursor.after : '';
    for (const report of reports) {
      if (cursor?.tracker === tracker.slug && compare(reportKey(report), cursor.after) <= 0) continue;
      if (rows.length === PAGE_SIZE) return { rows, nextCursor: next(tracker.slug, after) };
      const slot = getTrackerCardSlot(tracker, report.cardId);
      if (!Number.isInteger(report.cardId) || !slot || (report.originTrackerSlug && report.originTrackerSlug !== tracker.slug)) throw new Error('Invalid report origin');
      rows.push({ id: report.id, tracker: tracker.slug, trackerTitle: tracker.title,
        cardTitle: slot.cardTitle || tracker.title, serial: `${slot.serialNumber}/${slot.serialTotal}`,
        status: report.status, kind: report.kind || 'discovery', submittedAt: report.submittedAt,
        imageCount: new Set([report.imageUrl, ...(report.evidenceImages || []).map((image) => image.url)].filter(Boolean)).size,
        hasSource: Boolean(report.link) });
      after = reportKey(report);
    }
  }
  return { rows, nextCursor: null };
}

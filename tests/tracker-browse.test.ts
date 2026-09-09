import { describe, expect, it } from 'vitest';
import { createInitialTrackerCards } from '@/lib/tracker-data';
import { getTracker } from '@/lib/trackers';
import { browseTrackerCards, getCardStatusLabel, getTrackerPage, matchesSerialSearch, matchesTrackerStatus } from '@/lib/tracker-browse';

const cards = createInitialTrackerCards(getTracker('lotr-poster-cards')!);
const view = { cardFilter: 'all', searchQuery: '', statusFilter: 'all', sortOrder: 'id-asc' };

describe('collector browsing', () => {
  it.each(['7', '007', '#007', '007/100', ' #7 / 100 '])('matches the stamped serial, not the internal slot ID: %s', (query) => {
    const matches = browseTrackerCards(cards, { ...view, searchQuery: query });
    expect(matches).toHaveLength(20);
    expect(matches.every((card) => Number(card.serialNumber) === 7)).toBe(true);
  });
  it('searches card titles and exact denominators', () => {
    expect(browseTrackerCards(cards, { ...view, searchQuery: 'the one ring' })).toHaveLength(100);
    expect(browseTrackerCards(cards, { ...view, searchQuery: '007/500' })).toHaveLength(0);
    expect(matchesSerialSearch(cards[0], '0')).toBe(false);
  });
  it('supports inclusive serial ranges and rejects reversed ranges', () => {
    expect(browseTrackerCards(cards, { ...view, searchQuery: '1-20' })).toHaveLength(400);
    expect(browseTrackerCards(cards, { ...view, searchQuery: '20-1' })).toHaveLength(0);
  });
  it('keeps pending updates discoverable without downgrading approved status', () => {
    const found = { ...cards[0], found: true, verificationStatus: 'confirmed' as const, pendingReports: 2 };
    expect(matchesTrackerStatus(found, 'pending')).toBe(true);
    expect(matchesTrackerStatus(found, 'found')).toBe(true);
    expect(matchesTrackerStatus(found, 'unreported')).toBe(false);
    expect(getCardStatusLabel(found)).toBe('Confirmed');
    expect(getCardStatusLabel({ ...cards[1], pendingReports: 1 })).toBe('Under Review');
    expect(getCardStatusLabel(cards[2])).toBe('Unreported');
  });
  it('distinguishes all unlocated copies from copies with no open report', () => {
    const pending = { ...cards[0], pendingReports: 1 };
    expect(matchesTrackerStatus(pending, 'not-found')).toBe(true);
    expect(matchesTrackerStatus(pending, 'unreported')).toBe(false);
    expect(matchesTrackerStatus(cards[1], 'unreported')).toBe(true);
  });
  it('combines card, serial, status and sort without mutating source data', () => {
    const data = cards.slice(0, 10).map((card) => ({ ...card, pendingReports: 1 }));
    expect(browseTrackerCards(data, { cardFilter: cards[0].cardSlug!, searchQuery: '1-3', statusFilter: 'pending', sortOrder: 'id-desc' }).map((card) => card.id)).toEqual([3, 2, 1]);
    expect(data[0].id).toBe(1);
    expect(browseTrackerCards(data, { ...view, cardFilter: 'missing' })).toHaveLength(0);
  });
  it.each(['date-asc', 'date-desc'])('puts unknown dates last for %s', (sortOrder) => {
    const data = [{ ...cards[0] }, { ...cards[1], dateFound: '2026-01-01' }, { ...cards[2], dateFound: 'invalid' }];
    expect(browseTrackerCards(data, { ...view, sortOrder })[0].id).toBe(2);
  });
  it('bounds pages for large, empty and stale result sets', () => {
    expect(getTrackerPage(2000, 42)).toEqual({ page: 42, pageCount: 42, start: 1968, end: 2000 });
    expect(getTrackerPage(2000, 20, 100)).toEqual({ page: 20, pageCount: 20, start: 1900, end: 2000 });
    expect(getTrackerPage(1, 42)).toEqual({ page: 1, pageCount: 1, start: 0, end: 1 });
    expect(getTrackerPage(0, 2)).toEqual({ page: 1, pageCount: 1, start: 0, end: 0 });
    for (const invalid of [-2, 1.5, NaN, Infinity]) expect(getTrackerPage(2000, invalid).page).toBe(1);
    expect(getTrackerPage(2000, 1, 0)).toEqual({ page: 1, pageCount: 42, start: 0, end: 48 });
  });
});

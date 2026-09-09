import type { SerializedRingCard } from './types';

export const TRACKER_PAGE_SIZE = 48;
export const VALID_STATUS_FILTERS = new Set([
  'all', 'found', 'pending', 'unreported', 'confirmed', 'source-linked', 'has-evidence',
  'source-marketplace', 'source-grading-pop', 'source-social', 'source-article',
  'source-private-sale', 'source-other', 'not-found',
]);
export const VALID_SORT_ORDERS = new Set([
  'id-asc', 'id-desc', 'price-desc', 'price-asc', 'date-desc', 'date-asc', 'evidence-desc',
]);

export function matchesSerialSearch(card: SerializedRingCard, query: string) {
  const search = query.trim().toLowerCase();
  if (!search) return true;
  const stamp = search.match(/^#?\s*(\d+)(?:\s*\/\s*(\d+))?$/);
  if (stamp) {
    return Number(card.serialNumber) === Number(stamp[1]) &&
      (!stamp[2] || card.serialTotal === Number(stamp[2]));
  }
  const range = search.match(/^#?\s*(\d+)\s*-\s*#?\s*(\d+)$/);
  if (range) return Number(card.serialNumber) >= Number(range[1]) && Number(card.serialNumber) <= Number(range[2]);
  return Boolean(card.cardTitle?.toLowerCase().includes(search));
}

export function matchesTrackerStatus(card: SerializedRingCard, status: string) {
  switch (status) {
    case 'all': return true;
    case 'found': return card.found;
    case 'pending': return (card.pendingReports || 0) > 0;
    case 'unreported': return !card.found && !card.pendingReports;
    case 'not-found': return !card.found;
    case 'confirmed': return card.found && card.verificationStatus === 'confirmed';
    case 'source-linked': return card.found && card.verificationStatus === 'source-linked';
    case 'has-evidence': return (card.evidenceImages?.length || 0) > 0;
    default: return status.startsWith('source-') && card.sourceType === status.slice(7);
  }
}

export function getCardStatusLabel(card: SerializedRingCard) {
  if (card.found) return card.verificationStatus === 'confirmed' ? 'Confirmed' : 'Located';
  return card.pendingReports ? 'Under Review' : 'Unreported';
}

export function browseTrackerCards(cards: SerializedRingCard[], view: {
  searchQuery: string; cardFilter: string; statusFilter: string; sortOrder: string;
}) {
  return cards.filter((card) => (view.cardFilter === 'all' || card.cardSlug === view.cardFilter) &&
    matchesSerialSearch(card, view.searchQuery) && matchesTrackerStatus(card, view.statusFilter))
    .sort((a, b) => {
      switch (view.sortOrder) {
        case 'id-desc': return b.id - a.id;
        case 'price-asc': return (a.price ?? Infinity) - (b.price ?? Infinity) || a.id - b.id;
        case 'price-desc': return (b.price ?? -1) - (a.price ?? -1) || a.id - b.id;
        case 'date-asc':
        case 'date-desc': {
          const left = a.dateFound ? Date.parse(a.dateFound) : NaN;
          const right = b.dateFound ? Date.parse(b.dateFound) : NaN;
          if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : a.id - b.id;
          if (!Number.isFinite(right)) return -1;
          return (view.sortOrder === 'date-asc' ? left - right : right - left) || a.id - b.id;
        }
        case 'evidence-desc': return (b.evidenceImages?.length || 0) - (a.evidenceImages?.length || 0) || a.id - b.id;
        default: return a.id - b.id;
      }
    });
}

export function getTrackerPage(total: number, requestedPage: number, pageSize = TRACKER_PAGE_SIZE) {
  const boundedPageSize = Number.isSafeInteger(pageSize) && pageSize > 0 ? pageSize : TRACKER_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(total / boundedPageSize));
  const page = Math.min(pageCount, Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1));
  const start = (page - 1) * boundedPageSize;
  return { page, pageCount, start, end: Math.min(total, start + boundedPageSize) };
}

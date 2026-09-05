import type { CardFacts, CardHistoryEvent, EvidenceImage, PriceHistoryEntry, SerializedRingCard } from './types';

const FACT_KEYS = ['found', 'foundBy', 'dateFound', 'link', 'sourceType', 'verificationStatus', 'notes', 'image', 'evidenceImages', 'price', 'priceDate', 'priceHistory', 'grading'] as const;
const verificationRank = { unverified: 0, 'source-linked': 1, confirmed: 2 };

function factsOf(card: SerializedRingCard): CardFacts {
  return Object.fromEntries(FACT_KEYS.map((key) => [key, structuredClone(card[key])])) as CardFacts;
}

function mergeImages(images: EvidenceImage[]) {
  return [...new Map(images.filter((image) => image.url).map((image) => [image.url, image])).values()];
}

export function activeCardEvents(card: SerializedRingCard) {
  const withdrawn = new Set((card.history || []).flatMap((event) => event.retracts || []));
  return (card.history || []).filter((event) => event.kind !== 'retraction' && !withdrawn.has(event.id));
}

// The public fields are a projection. Evidence and corrections remain in the journal.
export function rebuildCardHistory(card: SerializedRingCard) {
  if (!card.historyBaseline) {
    const prices: PriceHistoryEntry[] = (card.priceHistory || []).map((price) => ({ ...price, kind: price.kind || 'unknown' }));
    if (card.price !== undefined && !prices.some((entry) => entry.price === card.price && entry.date === (card.priceDate || ''))) prices.push({ id: 'legacy-price', price: card.price, date: card.priceDate || '', kind: 'unknown' });
    card.priceHistory = prices.sort((a, b) => b.date.localeCompare(a.date));
    const latestSale = prices.find((entry) => entry.kind === 'completed-sale' && entry.currency === 'USD');
    card.price = latestSale?.price;
    card.priceDate = latestSale?.date;
    if (card.grading && !card.gradingHistory?.length) card.gradingHistory = [{ id: 'legacy-grading', status: 'graded', grading: card.grading, occurredOn: card.grading.dateGraded, recordedAt: '' }];
    return;
  }
  const baseline = structuredClone(card.historyBaseline);
  for (const key of FACT_KEYS) delete (card as unknown as Record<string, unknown>)[key];
  Object.assign(card, baseline);
  card.gradingHistory = baseline.grading ? [{ id: 'legacy-grading', status: 'graded', grading: baseline.grading, occurredOn: baseline.grading.dateGraded, recordedAt: '' }] : [];
  const prices: PriceHistoryEntry[] = [...(baseline.priceHistory || []).map((price) => ({ ...price, kind: price.kind || 'unknown' as const }))];
  if (baseline.price !== undefined && !prices.some((entry) => entry.price === baseline.price && entry.date === (baseline.priceDate || ''))) prices.push({ id: 'legacy-price', price: baseline.price, date: baseline.priceDate || '', kind: 'unknown' });
  for (const event of activeCardEvents(card)) {
    const facts = event.facts;
    if (facts) {
      const existingImages = card.evidenceImages || [];
      if (event.kind === 'correction' || event.kind === 'image') {
        Object.assign(card, facts);
      } else {
        if (!existingImages.length && facts.evidenceImages?.length && facts.image) card.image = facts.image;
        card.found = card.found || Boolean(facts.found);
        for (const key of ['foundBy', 'dateFound', 'link', 'sourceType', 'notes', 'image'] as const) {
          if (!card[key] && facts[key]) Object.assign(card, { [key]: facts[key] });
        }
        if (facts.verificationStatus && verificationRank[facts.verificationStatus] > verificationRank[card.verificationStatus]) card.verificationStatus = facts.verificationStatus;
      }
      card.evidenceImages = mergeImages([...existingImages, ...(facts.evidenceImages || [])]);
    }
    if (event.price) prices.push(event.price);
    if (event.grading) card.gradingHistory.push(event.grading);
  }
  const seen = new Set<string>();
  card.priceHistory = prices.filter((entry) => {
    // Only a shared source plus transaction details can establish a duplicate sale.
    const key = entry.sourceUrl ? JSON.stringify([entry.sourceUrl, entry.date, entry.price, entry.currency, entry.kind]) : entry.id;
    if (key && seen.has(key)) return false;
    if (key) seen.add(key);
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date) || (b.recordedAt || '').localeCompare(a.recordedAt || ''));
  const latestSale = card.priceHistory.find((entry) => entry.kind === 'completed-sale' && entry.currency === 'USD');
  card.price = latestSale?.price;
  card.priceDate = latestSale?.date;
  card.gradingHistory.reverse().sort((a, b) => (b.occurredOn || b.recordedAt.slice(0, 10)).localeCompare(a.occurredOn || a.recordedAt.slice(0, 10)) || b.recordedAt.localeCompare(a.recordedAt));
  const latestGrading = card.gradingHistory[0];
  card.grading = latestGrading?.status === 'graded' ? latestGrading.grading : undefined;
}

export function appendCardEvent(card: SerializedRingCard, event: CardHistoryEvent) {
  card.historyBaseline ??= factsOf(card);
  card.history ??= [];
  if (card.history.some((existing) => existing.id === event.id)) return;
  card.history.push(structuredClone(event));
  rebuildCardHistory(card);
}

export function retractReportEvents(card: SerializedRingCard, reportId: string, eventId: string, at: string) {
  const retracts = activeCardEvents(card).filter((event) => event.sourceSubmissionId === reportId).map((event) => event.id);
  if (!retracts.length) throw new Error('This legacy approval needs a reviewed correction; it has no reversible journal entry.');
  appendCardEvent(card, { id: eventId, kind: 'retraction', recordedAt: at, sourceSubmissionId: reportId, retracts });
}

import { DiscoverySubmission, SerializedRingCard } from './types';

export const TOTAL_RING_CARDS = 100;
export const ONE_RING_CARDS_KEY = 'one_ring_cards';
export const ONE_RING_SUBMISSIONS_KEY = 'one_ring_submissions';

export const RING_REFERENCE_IMAGE =
  'https://cards.scryfall.io/large/front/4/e/4e6fee52-33a8-4085-b632-bf95dfd2b16d.jpg?1782694957';

export const RING_SOURCE_URL =
  'https://scryfall.com/card/ltr/748z/the-one-ring';

export const formatSerial = (id: number) => id.toString().padStart(3, '0');

export const initialSerializedRingCards: SerializedRingCard[] = Array.from(
  { length: TOTAL_RING_CARDS },
  (_, i) => {
    const id = i + 1;

    return {
      id,
      serialNumber: formatSerial(id),
      name: `The One Ring ${formatSerial(id)}/${TOTAL_RING_CARDS}`,
      found: false,
      verificationStatus: 'unverified',
      image: RING_REFERENCE_IMAGE,
      priceHistory: [],
    };
  }
);

export const ringNames = initialSerializedRingCards.map((card) => card.name);

export function normalizeRingCard(card: Partial<SerializedRingCard> & { id: number }): SerializedRingCard {
  return {
    id: card.id,
    serialNumber: card.serialNumber || formatSerial(card.id),
    name: card.name || `The One Ring ${formatSerial(card.id)}/${TOTAL_RING_CARDS}`,
    found: Boolean(card.found),
    foundBy: card.foundBy,
    dateFound: card.dateFound,
    link: card.link,
    sourceType: card.sourceType,
    verificationStatus: card.verificationStatus || 'unverified',
    notes: card.notes,
    image: card.image || RING_REFERENCE_IMAGE,
    price: card.price,
    priceDate: card.priceDate,
    priceHistory: card.priceHistory || [],
    grading: card.grading,
    pendingReports: card.pendingReports || 0,
  };
}

export function withPendingReportCounts(cards: SerializedRingCard[], submissions: DiscoverySubmission[]) {
  const pendingCounts = submissions
    .filter((submission) => submission.status === 'pending')
    .reduce((counts, submission) => {
      counts[submission.cardId] = (counts[submission.cardId] || 0) + 1;
      return counts;
    }, {} as Record<number, number>);

  return cards.map((card) => ({
    ...card,
    pendingReports: pendingCounts[card.id] || 0,
  }));
}

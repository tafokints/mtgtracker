import type { SerializedRingCard } from '@/lib/types';
import type { TrackerSummary } from '@/lib/trackers';
import { formatTrackerCardLabel } from '@/lib/tracker-data';

function formatStatus(value: string) {
  return value.replace(/-/g, ' ');
}

function formatPrice(value?: number) {
  return value === undefined ? undefined : `$${value.toLocaleString()}`;
}

export function buildDiscoveryShareText(tracker: TrackerSummary, card: SerializedRingCard, detailUrl: string) {
  const label = formatTrackerCardLabel(tracker, card);
  const lines = [
    `MTG serialized discovery: ${tracker.title} ${label}`,
    `Status: ${card.found ? 'Located' : 'Not found'} (${formatStatus(card.verificationStatus)})`,
    card.sourceType ? `Source: ${formatStatus(card.sourceType)}` : undefined,
    card.foundBy ? `Found by: ${card.foundBy}` : undefined,
    card.dateFound ? `Date found: ${card.dateFound}` : undefined,
    card.price !== undefined ? `Reported price: ${formatPrice(card.price)}` : undefined,
    `Track it: ${detailUrl}`,
  ];

  return lines.filter(Boolean).join('\n');
}

export const AFFILIATE_PLACEMENTS = [
  'tracker-top-cta',
  'tracker-filtered-cta',
  'tracker-stats-cta',
  'tracker-directory',
  'tracker-marketplace',
  'tracker-card-serial',
  'serial-detail',
  'discoveries-page',
  'marketplace-links',
] as const;

export type AffiliatePlacement = typeof AFFILIATE_PLACEMENTS[number];

export function isAffiliatePlacement(value: string): value is AffiliatePlacement {
  return AFFILIATE_PLACEMENTS.includes(value as AffiliatePlacement);
}

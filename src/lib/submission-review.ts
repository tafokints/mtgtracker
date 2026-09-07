import type { DiscoverySubmission } from '@/lib/types';
import { evidenceIdFromUrl, normalizeSourceUrl } from '@/lib/evidence-policy';

export const DISCOVERY_EVIDENCE_REQUIRED = 'A new discovery needs a supported source link or uploaded evidence. Request more information or merge a supporting report.';

// Eligibility only: the server must still verify ownership and all safety checks.
export function hasSubmissionEvidence(report: DiscoverySubmission) {
  return Boolean(normalizeSourceUrl(report.link) || normalizeSourceUrl(report.grading?.sourceUrl) ||
    evidenceIdFromUrl(report.imageUrl) || report.evidenceImages?.some((image) => evidenceIdFromUrl(image.url)));
}

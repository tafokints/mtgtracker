import type { DiscoverySubmission } from '@/lib/types';
import { evidenceIdFromUrl, normalizeSourceUrl } from '@/lib/evidence-policy';

export const DISCOVERY_EVIDENCE_REQUIRED = 'A new discovery needs a supported source link or uploaded evidence. Request more information or merge a supporting report.';
export const MAX_REPORT_SOURCE_LINKS = 8;

export function getSubmissionSourceUrls(report: DiscoverySubmission) {
  return [...new Set([report.link, report.grading?.sourceUrl, ...(report.followUps || []).map((reply) => reply.sourceUrl)]
    .filter((url): url is string => typeof url === 'string' && Boolean(url)))];
}

// Eligibility only: the server must still verify ownership and all safety checks.
export function hasSubmissionEvidence(report: DiscoverySubmission) {
  return Boolean(getSubmissionSourceUrls(report).some((url) => normalizeSourceUrl(url)) ||
    evidenceIdFromUrl(report.imageUrl) || report.evidenceImages?.some((image) => evidenceIdFromUrl(image.url)));
}

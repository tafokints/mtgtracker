export interface PriceHistoryEntry {
  price: number;
  date: string;
  soldBy?: string;
  soldTo?: string;
}

export interface GradingInfo {
  service: string;
  grade: number;
  dateGraded?: string;
}

export type VerificationStatus = 'unverified' | 'source-linked' | 'confirmed';

export type SourceType = 'marketplace' | 'grading-pop' | 'social' | 'article' | 'private-sale' | 'other';

export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'needs-more-info' | 'duplicate' | 'cannot-verify';

export interface EvidenceImage {
  url: string;
  caption?: string;
  sourceSubmissionId?: string;
  sourceUrl?: string;
  sourceType?: SourceType;
}

export interface DiscoverySubmission {
  id: string;
  cardId: number;
  cardSlug?: string;
  cardTitle?: string;
  serialTotal?: number;
  serialNumber: string;
  foundBy?: string;
  dateFound?: string;
  link?: string;
  sourceType: SourceType;
  requestedVerificationStatus: VerificationStatus;
  price?: number;
  imageUrl?: string;
  evidenceImages: EvidenceImage[];
  notes?: string;
  status: SubmissionStatus;
  submittedAt: string;
  duplicateOf?: string;
  duplicateSubmissionIds?: string[];
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
}

export interface SerializedRingCard {
  id: number;
  cardSlug?: string;
  cardTitle?: string;
  serialTotal?: number;
  serialNumber: string;
  name: string;
  found: boolean;
  foundBy?: string;
  dateFound?: string;
  link?: string;
  sourceType?: SourceType;
  verificationStatus: VerificationStatus;
  notes?: string;
  image?: string;
  evidenceImages?: EvidenceImage[];
  price?: number;
  priceDate?: string;
  priceHistory: PriceHistoryEntry[];
  grading?: GradingInfo;
  pendingReports?: number;
} 

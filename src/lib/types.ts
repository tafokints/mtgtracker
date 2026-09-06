export interface PriceHistoryEntry {
  id?: string;
  price: number;
  date: string;
  kind?: 'asking-price' | 'completed-sale' | 'unknown';
  currency?: string;
  sourceUrl?: string;
  sourceSubmissionId?: string;
  recordedAt?: string;
  soldBy?: string;
  soldTo?: string;
}

export interface GradingInfo {
  service: string;
  grade: number;
  dateGraded?: string;
  certificateNumber?: string;
  sourceUrl?: string;
}

export interface GradingHistoryEntry {
  id: string;
  status: 'graded' | 'ungraded';
  grading?: GradingInfo;
  occurredOn?: string;
  recordedAt: string;
  sourceSubmissionId?: string;
}

export type ReportKind = 'discovery' | 'sighting' | 'correction';
export type CardFacts = Pick<SerializedRingCard, 'found' | 'foundBy' | 'dateFound' | 'link' | 'sourceType' | 'verificationStatus' | 'notes' | 'image' | 'evidenceImages' | 'price' | 'priceDate' | 'priceHistory' | 'grading'>;

export interface CardHistoryEvent {
  id: string;
  kind: ReportKind | 'price' | 'grading' | 'image' | 'retraction';
  recordedAt: string;
  sourceSubmissionId?: string;
  facts?: Partial<CardFacts>;
  price?: PriceHistoryEntry;
  grading?: GradingHistoryEntry;
  retracts?: string[];
}

export interface ReportReviewEvent {
  actorId?: string;
  id: string;
  action: string;
  at: string;
  actor: 'admin' | 'submitter';
  notes?: string;
}

export type VerificationStatus = 'unverified' | 'source-linked' | 'confirmed';

export type SourceType = 'marketplace' | 'grading-pop' | 'social' | 'article' | 'private-sale' | 'other';

export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'needs-more-info' | 'duplicate' | 'cannot-verify' | 'revoked';

export interface EvidenceImage {
  url: string;
  assetId?: string;
  caption?: string;
  sourceSubmissionId?: string;
  sourceUrl?: string;
  sourceType?: SourceType;
}

export interface DiscoverySubmission {
  id: string;
  copyId?: string;
  originTrackerSlug?: string;
  originCardId?: number;
  kind?: ReportKind;
  priceKind?: PriceHistoryEntry['kind'];
  currency?: string;
  priceDate?: string;
  grading?: GradingInfo;
  reviewHistory?: ReportReviewEvent[];
  followUps?: Array<{ id: string; at: string; notes: string; evidenceAssetIds?: string[] }>;
  payloadHash?: string;
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
  evidenceSafety?: Array<{ url: string; status: string; reason: string }>;
  consentAt?: string;
}

export interface SerializedRingCard {
  id: number;
  printingId?: string;
  copyId?: string;
  historyBaseline?: CardFacts;
  history?: CardHistoryEvent[];
  gradingHistory?: GradingHistoryEntry[];
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
  /** Public aggregate of pending and needs-more-info reports; never a discovery count. */
  pendingReports?: number;
} 

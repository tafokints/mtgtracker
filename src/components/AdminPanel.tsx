'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { SerializedRingCard, GradingInfo, PriceHistoryEntry, DiscoverySubmission, VerificationStatus, SubmissionStatus } from '../lib/types';
import type { TrackerSummary } from '@/lib/trackers';
import { formatTrackerCardLabel, formatTrackerSerial } from '@/lib/tracker-data';
import { affiliateStatsCsvFilename, buildAffiliateStatsCsv } from '@/lib/affiliate-stats-export';
import { getAffiliateStatsInsights } from '@/lib/affiliate-stats-insights';
import { buildDiscoveryShareLinks, getPromotionCandidates } from '@/lib/discovery-share';
import ExternalImage from '@/components/ExternalImage';

interface AdminPanelProps {
  tracker: TrackerSummary;
  cards: SerializedRingCard[];
  onPriceUpdate: (cardId: number, price: number) => void;
  onImageUpdate: (cardId: number, imageUrl: string) => void;
  onGradingUpdate: (cardId: number, grading: GradingInfo) => void;
  onPriceHistoryAdd: (cardId: number, entry: PriceHistoryEntry) => void;
  onRefresh: () => void;
}

type ReviewAction = 'approve' | 'reject' | 'needs-more-info' | 'duplicate' | 'cannot-verify';
type AdminTab = 'review' | 'price' | 'image' | 'grading' | 'history' | 'affiliate';

interface AffiliateStatsRow {
  tracker: string;
  trackerTitle: string;
  merchant: string;
  intent: string;
  label: string;
  href: string;
  placement: string;
  clicksInWindow: number;
  totalClicks: number;
  lastClick?: {
    clickedAt?: string;
    href?: string;
    sourcePath?: string;
    viewContext?: {
      query?: string;
      filter?: string;
      sort?: string;
      cardFilter?: string;
      card?: string;
      serial?: string;
      slot?: string;
    };
  } | null;
}

interface AffiliateStatsBreakdown {
  key: string;
  label: string;
  clicksInWindow: number;
  totalClicks: number;
}

interface PromotionEfficiencyRow {
  key: string;
  label: string;
  promotionActionsInWindow: number;
  promotionActionsTotal: number;
  promotionVisitsInWindow: number;
  promotionVisitsTotal: number;
  affiliateClicksInWindow: number;
  affiliateClicksTotal: number;
  affiliateClicksPerActionInWindow: number | null;
  affiliateClicksPerActionTotal: number | null;
  affiliateClicksPerVisitInWindow: number | null;
  affiliateClicksPerVisitTotal: number | null;
}

interface PromotionStatsRow {
  tracker: string;
  trackerTitle: string;
  action: string;
  label: string;
  clicksInWindow: number;
  totalClicks: number;
  lastAction?: {
    actedAt?: string;
    card?: string;
    serial?: string;
    detailUrl?: string;
  } | null;
}

interface PromotionVisitRow {
  tracker: string;
  trackerTitle: string;
  source: string;
  label: string;
  clicksInWindow: number;
  totalClicks: number;
  lastVisit?: {
    visitedAt?: string;
    source?: string;
    campaign?: string;
    content?: string;
    card?: string;
    serial?: string;
    path?: string;
  } | null;
}

interface AffiliateStatsResponse {
  days: number;
  generatedAt: string;
  summary: {
    clicksInWindow: number;
    totalClicks: number;
    bestTracker: AffiliateStatsBreakdown | null;
    bestMerchant: AffiliateStatsBreakdown | null;
    bestIntent: AffiliateStatsBreakdown | null;
    bestPlacement: AffiliateStatsBreakdown | null;
    byTracker: AffiliateStatsBreakdown[];
    byMerchant: AffiliateStatsBreakdown[];
    byIntent: AffiliateStatsBreakdown[];
    byPlacement: AffiliateStatsBreakdown[];
    byViewFilter: AffiliateStatsBreakdown[];
    byViewSort: AffiliateStatsBreakdown[];
    byViewCardFilter: AffiliateStatsBreakdown[];
    byViewCard: AffiliateStatsBreakdown[];
    byViewSerial: AffiliateStatsBreakdown[];
    byLastClickFilter: AffiliateStatsBreakdown[];
    byLastClickSort: AffiliateStatsBreakdown[];
    byLastClickCardFilter: AffiliateStatsBreakdown[];
    byLastClickCard: AffiliateStatsBreakdown[];
    byLastClickSerial: AffiliateStatsBreakdown[];
  };
  promotion: {
    summary: {
      clicksInWindow: number;
      totalClicks: number;
      byTracker: AffiliateStatsBreakdown[];
      byAction: AffiliateStatsBreakdown[];
    };
    visits: {
      summary: {
        clicksInWindow: number;
        totalClicks: number;
        byTracker: AffiliateStatsBreakdown[];
        bySource: AffiliateStatsBreakdown[];
      };
      rows: PromotionVisitRow[];
    };
    affiliateSources: AffiliateStatsBreakdown[];
    efficiency: PromotionEfficiencyRow[];
    sourceEfficiency: PromotionEfficiencyRow[];
    rows: PromotionStatsRow[];
  };
  rows: AffiliateStatsRow[];
}

const REVIEW_ACTION_LABELS: Record<ReviewAction, string> = {
  approve: 'Approve',
  reject: 'Reject',
  'needs-more-info': 'Needs more info',
  duplicate: 'Duplicate',
  'cannot-verify': 'Cannot verify',
};

const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  'needs-more-info': 'Needs more info',
  duplicate: 'Duplicate',
  'cannot-verify': 'Cannot verify',
};

function AffiliateMetric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded border border-ring-gold/25 bg-black/20 p-3">
      <p className="text-xs uppercase text-ring-light/55">{label}</p>
      <p className="mt-1 text-lg font-bold text-ring-gold">{value}</p>
      {detail && <p className="mt-1 text-xs text-ring-light/65">{detail}</p>}
    </div>
  );
}

function AffiliateBreakdown({ title, rows }: { title: string; rows: AffiliateStatsBreakdown[] }) {
  return (
    <div className="rounded border border-ring-gold/25 bg-black/20 p-3">
      <h4 className="text-xs font-bold uppercase text-ring-gold">{title}</h4>
      <div className="mt-2 space-y-2">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3 text-xs text-ring-light">
            <span className="truncate capitalize">{row.label}</span>
            <span className="tabular-nums text-ring-light/70">{row.clicksInWindow}/{row.totalClicks}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PromotionEfficiencyTable({ rows, label = 'Tracker' }: { rows: PromotionEfficiencyRow[]; label?: string }) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto rounded border border-ring-teal/25">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-black/20 text-ring-teal">
          <tr>
            <th className="px-3 py-2">{label}</th>
            <th className="px-3 py-2 text-right">Actions</th>
            <th className="px-3 py-2 text-right">Visits</th>
            <th className="px-3 py-2 text-right">Affiliate clicks</th>
            <th className="px-3 py-2 text-right">Clicks/action</th>
            <th className="px-3 py-2 text-right">Clicks/visit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ring-teal/15 text-ring-light">
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="px-3 py-2">{row.label}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.promotionActionsInWindow}/{row.promotionActionsTotal}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.promotionVisitsInWindow}/{row.promotionVisitsTotal}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.affiliateClicksInWindow}/{row.affiliateClicksTotal}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {row.affiliateClicksPerActionInWindow === null ? 'No actions' : row.affiliateClicksPerActionInWindow.toFixed(2)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {row.affiliateClicksPerVisitInWindow === null ? 'No visits' : row.affiliateClicksPerVisitInWindow.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AffiliateInsightCards({ insights }: { insights: ReturnType<typeof getAffiliateStatsInsights> }) {
  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-4">
      {insights.map((insight) => (
        <div key={insight.label} className="rounded border border-ring-teal/35 bg-ring-teal/10 p-3">
          <p className="text-xs uppercase text-ring-teal">{insight.label}</p>
          <p className="mt-1 text-sm font-bold text-ring-light">{insight.value}</p>
          <p className="mt-1 text-xs text-ring-light/65">{insight.detail}</p>
        </div>
      ))}
    </div>
  );
}

function getInternalSourcePath(sourcePath?: string) {
  if (!sourcePath || !sourcePath.startsWith('/') || sourcePath.startsWith('//')) {
    return undefined;
  }

  return sourcePath;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  document.body.removeChild(input);
}

export default function AdminPanel({ 
  tracker,
  cards, 
  onPriceUpdate, 
  onImageUpdate, 
  onGradingUpdate, 
  onPriceHistoryAdd,
  onRefresh,
}: AdminPanelProps) {
  const trackerApiBase = `/api/trackers/${tracker.slug}`;
  const serialLabel = (serialNumber: string | number, serialTotal = tracker.total) => `${serialNumber}/${serialTotal}`;
  const submissionLabel = (submission: DiscoverySubmission) => (
    submission.cardTitle && submission.cardTitle !== tracker.title
      ? `${submission.cardTitle} ${serialLabel(submission.serialNumber, submission.serialTotal)}`
      : serialLabel(submission.serialNumber, submission.serialTotal)
  );
  const getSubmissionEvidenceSummary = (submission: DiscoverySubmission) => {
    const imageCount = new Set([
      submission.imageUrl,
      ...(submission.evidenceImages || []).map((image) => image.url),
    ].filter(Boolean)).size;
    const hasSource = Boolean(submission.link);
    const hasSaleData = submission.price !== undefined;
    const hasFinder = Boolean(submission.foundBy);
    const hasDate = Boolean(submission.dateFound);
    const hasNotes = Boolean(submission.notes);
    const score = [
      hasSource,
      imageCount > 0,
      hasSaleData,
      hasFinder,
      hasDate,
      hasNotes,
    ].filter(Boolean).length;
    const label = score >= 4
      ? 'Strong evidence'
      : score >= 2
        ? 'Moderate evidence'
        : 'Needs corroboration';
    const signals = [
      hasSource && 'source',
      imageCount > 0 && `${imageCount} image${imageCount === 1 ? '' : 's'}`,
      hasSaleData && 'price',
      hasFinder && 'finder',
      hasDate && 'date',
      hasNotes && 'notes',
    ].filter(Boolean) as string[];

    return {
      imageCount,
      label,
      score,
      signals,
    };
  };
  const backupInputRef = useRef<HTMLInputElement>(null);

  const [isVisible, setIsVisible] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('review');
  const [submissions, setSubmissions] = useState<DiscoverySubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [affiliateStats, setAffiliateStats] = useState<AffiliateStatsResponse | null>(null);
  const [affiliateStatsLoading, setAffiliateStatsLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [imageOverrides, setImageOverrides] = useState<Record<string, string>>({});
  const [verificationOverrides, setVerificationOverrides] = useState<Record<string, VerificationStatus>>({});
  const [mergeSelections, setMergeSelections] = useState<Record<string, string[]>>({});
  const [reviewCardFilter, setReviewCardFilter] = useState('all');
  const reviewCardOptions = useMemo(() => {
    const optionsBySlug = new Map<string, { slug: string; title: string; count: number }>();

    for (const submission of submissions) {
      const card = cards.find((candidate) => candidate.id === submission.cardId);
      const slug = submission.cardSlug || card?.cardSlug || 'single-card';
      const title = submission.cardTitle || card?.cardTitle || tracker.title;
      const existingOption = optionsBySlug.get(slug);

      optionsBySlug.set(slug, {
        slug,
        title,
        count: (existingOption?.count || 0) + 1,
      });
    }

    return [...optionsBySlug.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [cards, submissions, tracker.title]);
  const pendingSubmissions = submissions.filter((submission) => submission.status === 'pending');
  const reviewedSubmissions = submissions.filter((submission) => submission.status !== 'pending');
  const affiliateInsights = useMemo(
    () => affiliateStats ? getAffiliateStatsInsights(affiliateStats) : [],
    [affiliateStats],
  );
  const matchesReviewCardFilter = (submission: DiscoverySubmission) => {
    if (reviewCardFilter === 'all') {
      return true;
    }

    const card = cards.find((candidate) => candidate.id === submission.cardId);
    return (submission.cardSlug || card?.cardSlug || 'single-card') === reviewCardFilter;
  };
  const filteredPendingSubmissions = pendingSubmissions
    .filter(matchesReviewCardFilter)
    .sort((a, b) => (
      getSubmissionEvidenceSummary(b).score - getSubmissionEvidenceSummary(a).score ||
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    ));
  const filteredReviewedSubmissions = reviewedSubmissions.filter(matchesReviewCardFilter);
  const promotionCandidates = useMemo(
    () => getPromotionCandidates(tracker, cards, filteredReviewedSubmissions, 3),
    [cards, filteredReviewedSubmissions, tracker],
  );
  
  // Grading fields
  const [gradingService, setGradingService] = useState('');
  const [grade, setGrade] = useState('');
  const [dateGraded, setDateGraded] = useState('');
  
  // Price history fields
  const [historyPrice, setHistoryPrice] = useState('');
  const [soldBy, setSoldBy] = useState('');
  const [soldTo, setSoldTo] = useState('');
  const [saleDate, setSaleDate] = useState('');

  const fetchSubmissions = useCallback(async () => {
    setSubmissionsLoading(true);
    try {
      const response = await fetch(`${trackerApiBase}/submissions`);
      if (response.ok) {
        setSubmissions(await response.json());
      } else if (response.status === 401) {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setSubmissionsLoading(false);
    }
  }, [trackerApiBase]);

  const fetchAffiliateStats = useCallback(async () => {
    setAffiliateStatsLoading(true);
    try {
      const response = await fetch('/api/admin/affiliate-stats?days=30');
      if (response.ok) {
        setAffiliateStats(await response.json());
      } else if (response.status === 401) {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error fetching affiliate stats:', error);
    } finally {
      setAffiliateStatsLoading(false);
    }
  }, []);

  const exportAffiliateStatsCsv = () => {
    if (!affiliateStats || affiliateStats.rows.length === 0) {
      return;
    }

    downloadTextFile(
      affiliateStatsCsvFilename(affiliateStats.generatedAt),
      buildAffiliateStatsCsv(affiliateStats),
    );
  };

  const trackPromotionAction = async (
    action: 'copy' | 'x' | 'reddit',
    candidate: ReturnType<typeof getPromotionCandidates>[number],
  ) => {
    const promotionDetailUrl = action === 'copy'
      ? candidate.promotionUrls.copy
      : action === 'x'
        ? candidate.promotionUrls.x
        : candidate.promotionUrls.reddit;

    try {
      await fetch('/api/admin/promotion-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tracker: tracker.slug,
          action,
          card: candidate.card.cardSlug || tracker.slug,
          serial: candidate.card.serialNumber,
          detailUrl: promotionDetailUrl,
        }),
      });
    } catch (error) {
      console.error('Error tracking promotion action:', error);
    }
  };

  const copyPromotionShareText = async (candidate: ReturnType<typeof getPromotionCandidates>[number]) => {
    try {
      await copyTextToClipboard(candidate.shareText);
      await trackPromotionAction('copy', candidate);
      setMessage('Promotion share text copied');
    } catch {
      setMessage('Promotion copy failed');
    }
  };

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Secret code: Ctrl + Alt + A
      if (event.ctrlKey && event.altKey && event.key === 'a') {
        event.preventDefault();
        setIsVisible(!isVisible);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isVisible]);

  useEffect(() => {
    if (isVisible) {
      checkAuth();
    }
  }, [isVisible]);

  useEffect(() => {
    if (isVisible && isAuthenticated && activeTab === 'review') {
      fetchSubmissions();
    }
  }, [isVisible, isAuthenticated, activeTab, fetchSubmissions]);

  useEffect(() => {
    if (isVisible && isAuthenticated && activeTab === 'affiliate') {
      fetchAffiliateStats();
    }
  }, [isVisible, isAuthenticated, activeTab, fetchAffiliateStats]);

  const checkAuth = async () => {
    setAuthChecked(false);
    try {
      const response = await fetch('/api/admin/login');
      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(Boolean(data.authenticated));
      }
    } catch (error) {
      console.error('Error checking admin auth:', error);
      setIsAuthenticated(false);
    } finally {
      setAuthChecked(true);
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: adminPassword }),
      });

      if (response.ok) {
        setIsAuthenticated(true);
        setAdminPassword('');
      } else {
        setMessage('Invalid admin password');
      }
    } catch (error) {
      console.error('Error logging in:', error);
      setMessage('Admin login failed');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' });
    setIsAuthenticated(false);
    setSubmissions([]);
  };

  const handleExportBackup = async () => {
    try {
      const response = await fetch(`${trackerApiBase}/export`);
      if (!response.ok) {
        if (response.status === 401) {
          setIsAuthenticated(false);
        }
        setMessage('Backup export failed');
        return;
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);

      link.href = downloadUrl;
      link.download = `${tracker.slug}-backup-${date}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      setMessage('Backup export downloaded');
    } catch (error) {
      console.error('Error exporting backup:', error);
      setMessage('Backup export failed');
    }
  };

  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;
    if (!window.confirm(`Restore ${tracker.title} from ${file.name}? This overwrites current cards and submissions.`)) {
      return;
    }

    try {
      const backup = JSON.parse(await file.text());
      const response = await fetch(`${trackerApiBase}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirm: 'RESTORE_TRACKER_BACKUP',
          backup,
        }),
      });

      if (response.ok) {
        setMessage('Backup restored');
        await fetchSubmissions();
        onRefresh();
        return;
      }

      if (response.status === 401) {
        setIsAuthenticated(false);
      }

      const errorBody = await response.json().catch(() => null);
      setMessage(errorBody?.message || 'Backup restore failed');
    } catch (error) {
      console.error('Error restoring backup:', error);
      setMessage('Backup restore failed');
    }
  };

  const reviewSubmission = async (submission: DiscoverySubmission, action: ReviewAction) => {
    try {
      const response = await fetch(`${trackerApiBase}/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submissionId: submission.id,
          action,
          reviewNotes: reviewNotes[submission.id],
          imageUrl: imageOverrides[submission.id],
          verificationStatus: verificationOverrides[submission.id] || submission.requestedVerificationStatus,
          mergeSubmissionIds: mergeSelections[submission.id] || [],
        }),
      });

      if (response.ok) {
        setMessage(`${REVIEW_ACTION_LABELS[action]}: ${submissionLabel(submission)}`);
        await fetchSubmissions();
        onRefresh();
      } else {
        if (response.status === 401) {
          setIsAuthenticated(false);
        }
        setMessage('Review action failed');
      }
    } catch (error) {
      console.error('Error reviewing submission:', error);
      setMessage('Review action failed');
    }
  };

  const getMergeCandidates = (submission: DiscoverySubmission) => (
    pendingSubmissions.filter((candidate) => candidate.id !== submission.id && candidate.cardId === submission.cardId)
  );

  const toggleMergeSelection = (submissionId: string, mergeSubmissionId: string) => {
    const selectedIds = mergeSelections[submissionId] || [];
    const nextSelectedIds = selectedIds.includes(mergeSubmissionId)
      ? selectedIds.filter((id) => id !== mergeSubmissionId)
      : [...selectedIds, mergeSubmissionId];

    setMergeSelections({
      ...mergeSelections,
      [submissionId]: nextSelectedIds,
    });
  };

  const handlePriceUpdate = () => {
    if (!selectedCard || !price) {
      setMessage('Please select a card and enter a price');
      return;
    }

    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue < 0) {
      setMessage('Please enter a valid price');
      return;
    }

    onPriceUpdate(selectedCard, priceValue);
    const card = cards.find((candidate) => candidate.id === selectedCard);
    setMessage(`Price updated for ${card ? formatTrackerCardLabel(tracker, card) : serialLabel(formatTrackerSerial(tracker, selectedCard))}`);
    setPrice('');
    setSelectedCard(null);
  };

  const handleImageUpdate = () => {
    if (!selectedCard || !imageUrl) {
      setMessage('Please select a card and enter an image URL');
      return;
    }

    // Accept absolute URLs and relative URLs starting with '/' (v2)
    const isValidUrl = (() => {
      if (imageUrl.startsWith('/')) return true;
      try {
        new URL(imageUrl);
        return true;
      } catch {
        return false;
      }
    })();
    if (!isValidUrl) {
      setMessage('Please enter a valid image URL');
      return;
    }

    onImageUpdate(selectedCard, imageUrl);
    const card = cards.find((candidate) => candidate.id === selectedCard);
    setMessage(`Image updated for ${card ? formatTrackerCardLabel(tracker, card) : serialLabel(formatTrackerSerial(tracker, selectedCard))}`);
    setImageUrl('');
    setSelectedCard(null);
  };

  const handleGradingUpdate = () => {
    if (!selectedCard || !gradingService || !grade) {
      setMessage('Please select a card and enter grading service and grade');
      return;
    }

    const gradeValue = parseFloat(grade);
    if (isNaN(gradeValue) || gradeValue < 0) {
      setMessage('Please enter a valid grade');
      return;
    }

    const gradingInfo: GradingInfo = {
      service: gradingService,
      grade: gradeValue,
      dateGraded: dateGraded || new Date().toISOString().split('T')[0]
    };

    onGradingUpdate(selectedCard, gradingInfo);
    const card = cards.find((candidate) => candidate.id === selectedCard);
    setMessage(`Grading updated for ${card ? formatTrackerCardLabel(tracker, card) : serialLabel(formatTrackerSerial(tracker, selectedCard))}`);
    setGradingService('');
    setGrade('');
    setDateGraded('');
    setSelectedCard(null);
  };

  const handlePriceHistoryAdd = () => {
    if (!selectedCard || !historyPrice || !saleDate) {
      setMessage('Please select a card and enter price and sale date');
      return;
    }

    const priceValue = parseFloat(historyPrice);
    if (isNaN(priceValue) || priceValue < 0) {
      setMessage('Please enter a valid price');
      return;
    }

    const historyEntry: PriceHistoryEntry = {
      price: priceValue,
      date: saleDate,
      soldBy: soldBy || undefined,
      soldTo: soldTo || undefined
    };

    onPriceHistoryAdd(selectedCard, historyEntry);
    const card = cards.find((candidate) => candidate.id === selectedCard);
    setMessage(`Price history added for ${card ? formatTrackerCardLabel(tracker, card) : serialLabel(formatTrackerSerial(tracker, selectedCard))}`);
    setHistoryPrice('');
    setSoldBy('');
    setSoldTo('');
    setSaleDate('');
    setSelectedCard(null);
  };

  const handleCardSelect = (cardId: number | null) => {
    setSelectedCard(cardId);
    setMessage('');
    // Pre-fill current values if they exist
    if (cardId) {
      const card = cards.find(c => c.id === cardId);
      if (card) {
        if (activeTab === 'price' && card.price) {
          setPrice(card.price.toString());
        }
        if (activeTab === 'image' && card.image) {
          setImageUrl(card.image);
        }
        if (activeTab === 'grading' && card.grading) {
          setGradingService(card.grading.service);
          setGrade(card.grading.grade.toString());
          setDateGraded(card.grading.dateGraded || '');
        }
      }
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-ring-dark border border-ring-gold rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h2 className="text-xl font-bold text-ring-gold">Admin Panel</h2>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {isAuthenticated && (
              <>
                <button
                  onClick={handleExportBackup}
                  className="text-xs text-ring-light hover:text-ring-gold"
                >
                  Export Backup
                </button>
                <button
                  onClick={() => backupInputRef.current?.click()}
                  className="text-xs text-ring-light hover:text-ring-gold"
                >
                  Restore Backup
                </button>
                <input
                  ref={backupInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleRestoreBackup}
                  className="hidden"
                />
                <button
                  onClick={handleLogout}
                  className="text-xs text-ring-light hover:text-ring-gold"
                >
                  Logout
                </button>
              </>
            )}
            <button
              onClick={() => setIsVisible(false)}
              className="text-ring-gold hover:text-yellow-400"
            >
              x
            </button>
          </div>
        </div>

        {!authChecked && (
          <p className="text-sm text-ring-light">Checking admin session...</p>
        )}

        {authChecked && !isAuthenticated && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-ring-gold text-sm font-bold mb-2">
                Admin Password
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                className="w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-2 px-3"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full bg-ring-gold hover:bg-yellow-400 text-ring-dark font-bold py-2 px-4 rounded"
            >
              Login
            </button>
            {message && <p className="text-center text-red-300 text-sm">{message}</p>}
            {process.env.NODE_ENV !== 'production' && (
              <p className="text-xs text-ring-light text-center">
                Local default: dev-admin
              </p>
            )}
          </form>
        )}

        {authChecked && isAuthenticated && (
        <div className="space-y-4">
          <div>
            <label className="block text-ring-gold text-sm font-bold mb-2">
              Select Card
            </label>
            <select
              value={selectedCard || ''}
              onChange={(e) => handleCardSelect(parseInt(e.target.value) || null)}
              className="w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-2 px-3"
            >
              <option value="">Choose a serial...</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {formatTrackerCardLabel(tracker, card)} - {card.found ? card.verificationStatus : 'not found'}
                </option>
              ))}
            </select>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-ring-gold overflow-x-auto">
            <button
              onClick={() => setActiveTab('review')}
              className={`flex-none px-2 py-2 text-xs font-bold ${
                activeTab === 'review'
                  ? 'text-ring-gold border-b-2 border-ring-gold'
                  : 'text-ring-light hover:text-ring-gold'
              }`}
            >
              Review ({reviewCardFilter === 'all' ? pendingSubmissions.length : `${filteredPendingSubmissions.length}/${pendingSubmissions.length}`})
            </button>
            <button
              onClick={() => setActiveTab('price')}
              className={`flex-none px-2 py-2 text-xs font-bold ${
                activeTab === 'price' 
                  ? 'text-ring-gold border-b-2 border-ring-gold' 
                  : 'text-ring-light hover:text-ring-gold'
              }`}
            >
              Price
            </button>
            <button
              onClick={() => setActiveTab('image')}
              className={`flex-none px-2 py-2 text-xs font-bold ${
                activeTab === 'image' 
                  ? 'text-ring-gold border-b-2 border-ring-gold' 
                  : 'text-ring-light hover:text-ring-gold'
              }`}
            >
              Image
            </button>
            <button
              onClick={() => setActiveTab('grading')}
              className={`flex-none px-2 py-2 text-xs font-bold ${
                activeTab === 'grading' 
                  ? 'text-ring-gold border-b-2 border-ring-gold' 
                  : 'text-ring-light hover:text-ring-gold'
              }`}
            >
              Grading
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-none px-2 py-2 text-xs font-bold ${
                activeTab === 'history' 
                  ? 'text-ring-gold border-b-2 border-ring-gold' 
                  : 'text-ring-light hover:text-ring-gold'
              }`}
            >
              History
            </button>
            <button
              onClick={() => setActiveTab('affiliate')}
              className={`flex-none px-2 py-2 text-xs font-bold ${
                activeTab === 'affiliate'
                  ? 'text-ring-gold border-b-2 border-ring-gold'
                  : 'text-ring-light hover:text-ring-gold'
              }`}
            >
              Affiliate
            </button>
          </div>

          {activeTab === 'review' && (
            <div className="space-y-4">
              {reviewCardOptions.length > 1 && (
                <div className="rounded border border-ring-gold/30 bg-black/20 p-3">
                  <label className="block text-ring-gold text-xs font-bold mb-2" htmlFor="review-card-filter">
                    Filter reports by card
                  </label>
                  <select
                    id="review-card-filter"
                    value={reviewCardFilter}
                    onChange={(event) => setReviewCardFilter(event.target.value)}
                    className="w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-2 px-3 text-sm"
                  >
                    <option value="all">All cards ({submissions.length})</option>
                    {reviewCardOptions.map((option) => (
                      <option key={option.slug} value={option.slug}>
                        {option.title} ({option.count})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {submissionsLoading && (
                <p className="text-sm text-ring-light">Loading reports...</p>
              )}
              {!submissionsLoading && pendingSubmissions.length === 0 && (
                <div className="rounded border border-ring-gold/30 bg-black/20 p-4">
                  <p className="text-sm font-bold text-ring-gold">No pending reports</p>
                  <p className="mt-1 text-xs text-ring-light">
                    Reviewed reports remain below so recent decisions can still be audited.
                  </p>
                </div>
              )}
              {!submissionsLoading && pendingSubmissions.length > 0 && filteredPendingSubmissions.length === 0 && (
                <div className="rounded border border-ring-gold/30 bg-black/20 p-4">
                  <p className="text-sm font-bold text-ring-gold">No pending reports for this card</p>
                  <p className="mt-1 text-xs text-ring-light">
                    Switch back to all cards to continue reviewing the full queue.
                  </p>
                </div>
              )}
              {filteredPendingSubmissions.map((submission) => {
                const evidenceSummary = getSubmissionEvidenceSummary(submission);

                return (
                <div key={submission.id} className="rounded border border-ring-gold/40 bg-black/20 p-3 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-ring-gold">{submissionLabel(submission)}</p>
                      <p className="text-xs text-ring-light">
                        {submission.sourceType.replace('-', ' ')} - {submission.requestedVerificationStatus.replace('-', ' ')}
                      </p>
                      <p className="text-xs text-ring-light">{new Date(submission.submittedAt).toLocaleString()}</p>
                    </div>
                    {submission.price !== undefined && (
                      <span className="rounded bg-green-900/40 px-2 py-1 text-xs text-green-300">
                        ${submission.price.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="rounded border border-ring-gold/25 bg-ring-dark/60 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase text-ring-gold">{evidenceSummary.label}</p>
                      <p className="text-xs text-ring-light/60">
                        {evidenceSummary.score}/6 review signals
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {evidenceSummary.signals.length > 0 ? (
                        evidenceSummary.signals.map((signal) => (
                          <span key={signal} className="rounded border border-ring-gold/30 px-2 py-0.5 text-xs text-ring-light">
                            {signal}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-ring-light/60">No structured evidence signals</span>
                      )}
                    </div>
                  </div>

                  {submission.duplicateOf && (
                    <div className="rounded border border-yellow-400/40 bg-yellow-900/20 px-3 py-2 text-xs text-yellow-100">
                      Possible duplicate of report {submission.duplicateOf}
                      {submission.duplicateSubmissionIds && submission.duplicateSubmissionIds.length > 1
                        ? ` and ${submission.duplicateSubmissionIds.length - 1} other report${submission.duplicateSubmissionIds.length === 2 ? '' : 's'}`
                        : ''}
                      .
                    </div>
                  )}

                  <div className="text-xs text-ring-light space-y-1">
                    {submission.foundBy && <p>Found by: {submission.foundBy}</p>}
                    {submission.dateFound && <p>Date: {submission.dateFound}</p>}
                    {submission.link && (
                      <p>
                        Source:{' '}
                        <a href={submission.link} target="_blank" rel="noopener noreferrer" className="text-ring-gold hover:underline">
                          Open
                        </a>
                      </p>
                    )}
                    {submission.notes && <p>Notes: {submission.notes}</p>}
                  </div>

                  {(submission.evidenceImages || []).length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {(submission.evidenceImages || []).slice(0, 4).map((image) => (
                        <a key={image.url} href={image.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded border border-ring-gold/30 bg-ring-light/10">
                          <ExternalImage
                            src={image.url}
                            alt={`Evidence for ${submissionLabel(submission)}`}
                            className="h-28 w-full object-cover"
                            hideOnError
                          />
                        </a>
                      ))}
                    </div>
                  )}

                  {getMergeCandidates(submission).length > 0 && (
                    <div className="rounded border border-ring-light/20 bg-ring-dark/50 p-3">
                      <p className="mb-2 text-xs font-bold text-ring-gold">Merge evidence from related reports</p>
                      <div className="space-y-2">
                        {getMergeCandidates(submission).map((candidate) => (
                          <label key={candidate.id} className="flex items-start gap-2 text-xs text-ring-light">
                            <input
                              type="checkbox"
                              checked={(mergeSelections[submission.id] || []).includes(candidate.id)}
                              onChange={() => toggleMergeSelection(submission.id, candidate.id)}
                              className="mt-1"
                            />
                            <span>
                              <span className="block text-ring-light">
                                {new Date(candidate.submittedAt).toLocaleString()} - {(candidate.evidenceImages || []).length + (candidate.imageUrl ? 1 : 0)} image{(candidate.evidenceImages || []).length + (candidate.imageUrl ? 1 : 0) === 1 ? '' : 's'}
                              </span>
                              {candidate.link && (
                                <a href={candidate.link} target="_blank" rel="noopener noreferrer" className="text-ring-gold hover:underline">
                                  Open source
                                </a>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-ring-gold text-xs font-bold mb-1">Primary image override</label>
                    <input
                      type="url"
                      value={imageOverrides[submission.id] || ''}
                      onChange={(event) => setImageOverrides({ ...imageOverrides, [submission.id]: event.target.value })}
                      placeholder={submission.imageUrl || submission.evidenceImages?.[0]?.url || 'Optional URL'}
                      className="w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-2 px-3 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-ring-gold text-xs font-bold mb-1">Approved verification</label>
                    <select
                      value={verificationOverrides[submission.id] || submission.requestedVerificationStatus}
                      onChange={(event) => setVerificationOverrides({ ...verificationOverrides, [submission.id]: event.target.value as VerificationStatus })}
                      className="w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-2 px-3 text-sm"
                    >
                      <option value="source-linked">Source Linked</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="unverified">Unverified</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-ring-gold text-xs font-bold mb-1">Review notes</label>
                    <textarea
                      rows={2}
                      value={reviewNotes[submission.id] || ''}
                      onChange={(event) => setReviewNotes({ ...reviewNotes, [submission.id]: event.target.value })}
                      className="w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-2 px-3 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      onClick={() => reviewSubmission(submission, 'approve')}
                      className="bg-ring-gold hover:bg-yellow-400 text-ring-dark font-bold py-2 px-3 rounded text-sm"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => reviewSubmission(submission, 'reject')}
                      className="border border-red-400/60 text-red-200 hover:bg-red-900/30 font-bold py-2 px-3 rounded text-sm"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => reviewSubmission(submission, 'needs-more-info')}
                      className="border border-blue-300/60 text-blue-100 hover:bg-blue-900/30 font-bold py-2 px-3 rounded text-sm"
                    >
                      Needs Info
                    </button>
                    <button
                      onClick={() => reviewSubmission(submission, 'duplicate')}
                      className="border border-yellow-300/60 text-yellow-100 hover:bg-yellow-900/30 font-bold py-2 px-3 rounded text-sm"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => reviewSubmission(submission, 'cannot-verify')}
                      className="border border-ring-light/40 text-ring-light hover:bg-ring-light/10 font-bold py-2 px-3 rounded text-sm sm:col-span-2"
                    >
                      Cannot Verify
                    </button>
                  </div>
                </div>
                );
              })}

              {promotionCandidates.length > 0 && (
                <div className="space-y-3 rounded border border-ring-teal/35 bg-ring-teal/10 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-ring-teal font-bold text-sm">Promotion candidates</h4>
                      <p className="mt-1 text-xs text-ring-light/65">
                        Recently approved discoveries with strong share signals.
                      </p>
                    </div>
                    <span className="rounded border border-ring-teal/40 px-2 py-1 text-xs text-ring-light">
                      {promotionCandidates.length} ready
                    </span>
                  </div>
                  {promotionCandidates.map((candidate) => {
                    const shareLinks = {
                      x: buildDiscoveryShareLinks(tracker, candidate.card, candidate.promotionUrls.x).x,
                      reddit: buildDiscoveryShareLinks(tracker, candidate.card, candidate.promotionUrls.reddit).reddit,
                    };

                    return (
                      <div key={candidate.submission.id} className="rounded border border-ring-teal/25 bg-black/20 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-ring-light">{formatTrackerCardLabel(tracker, candidate.card)}</p>
                            <p className="mt-1 text-xs text-ring-light/65">
                              Score {candidate.score} - {candidate.reasons.join(', ')}
                            </p>
                          </div>
                          <a
                            href={candidate.detailUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-ring-teal hover:underline"
                          >
                            Open public card
                          </a>
                        </div>
                        <pre className="mt-3 whitespace-pre-wrap rounded bg-ring-dark/70 p-3 text-xs leading-5 text-ring-light">{candidate.shareText}</pre>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => copyPromotionShareText(candidate)}
                            className="rounded bg-ring-teal px-3 py-2 text-xs font-bold text-ring-dark transition-colors hover:bg-cyan-300"
                          >
                            Copy Post
                          </button>
                          <a
                            href={shareLinks.x}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => trackPromotionAction('x', candidate)}
                            className="rounded border border-ring-teal/50 px-3 py-2 text-xs font-bold text-ring-teal transition-colors hover:bg-ring-teal hover:text-ring-dark"
                          >
                            X
                          </a>
                          <a
                            href={shareLinks.reddit}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => trackPromotionAction('reddit', candidate)}
                            className="rounded border border-ring-teal/50 px-3 py-2 text-xs font-bold text-ring-teal transition-colors hover:bg-ring-teal hover:text-ring-dark"
                          >
                            Reddit
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {filteredReviewedSubmissions.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-ring-gold font-bold text-sm">Reviewed history</h4>
                  {filteredReviewedSubmissions.slice(0, 20).map((submission) => (
                    <div key={submission.id} className="rounded border border-ring-light/20 bg-black/10 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-ring-light">{submissionLabel(submission)}</p>
                          <p className="text-xs text-ring-light">
                            {submission.sourceType.replace('-', ' ')} - submitted {new Date(submission.submittedAt).toLocaleString()}
                          </p>
                          {submission.reviewedAt && (
                            <p className="text-xs text-ring-light">
                              Reviewed by {submission.reviewedBy || 'admin'} on {new Date(submission.reviewedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <span className="rounded bg-ring-light/10 px-2 py-1 text-xs text-ring-gold">
                          {SUBMISSION_STATUS_LABELS[submission.status]}
                        </span>
                      </div>
                      {submission.link && (
                        <a href={submission.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-ring-gold hover:underline">
                          Open source
                        </a>
                      )}
                      {submission.reviewNotes && (
                        <p className="mt-2 text-xs text-ring-light">Notes: {submission.reviewNotes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Price Tab */}
          {activeTab === 'price' && (
            <div>
              <label className="block text-ring-gold text-sm font-bold mb-2">
                Recent Sale Price ($)
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Enter price..."
                className="w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-2 px-3"
              />
              <button
                onClick={handlePriceUpdate}
                className="w-full bg-ring-gold hover:bg-yellow-400 text-ring-dark font-bold py-2 px-4 rounded mt-2"
              >
                Update Price
              </button>
            </div>
          )}

          {activeTab === 'affiliate' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-ring-gold">Affiliate Clicks</h3>
                  <p className="text-xs text-ring-light">
                    Last {affiliateStats?.days || 30} days, tracked by outbound marketplace clicks.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={exportAffiliateStatsCsv}
                    disabled={!affiliateStats || affiliateStats.rows.length === 0}
                    className="rounded border border-ring-gold/50 px-3 py-2 text-xs font-bold text-ring-gold hover:bg-ring-gold hover:text-ring-dark disabled:cursor-not-allowed disabled:border-ring-gold/20 disabled:text-ring-light/35 disabled:hover:bg-transparent"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={fetchAffiliateStats}
                    className="rounded border border-ring-gold/50 px-3 py-2 text-xs font-bold text-ring-gold hover:bg-ring-gold hover:text-ring-dark"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {affiliateStatsLoading && (
                <p className="text-sm text-ring-light">Loading affiliate stats...</p>
              )}

              {!affiliateStatsLoading && (!affiliateStats || (
                affiliateStats.rows.length === 0 &&
                affiliateStats.promotion.rows.length === 0 &&
                affiliateStats.promotion.visits.rows.length === 0
              )) && (
                <div className="rounded border border-ring-gold/30 bg-black/20 p-4">
                  <p className="text-sm font-bold text-ring-gold">No affiliate clicks tracked yet</p>
                  <p className="mt-1 text-xs text-ring-light">
                    Click rows will appear after visitors use marketplace links.
                  </p>
                </div>
              )}

              {!affiliateStatsLoading && affiliateStats && (
                affiliateStats.rows.length > 0 ||
                affiliateStats.promotion.rows.length > 0 ||
                affiliateStats.promotion.visits.rows.length > 0
              ) && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                    <AffiliateMetric label={`${affiliateStats.days}d clicks`} value={affiliateStats.summary.clicksInWindow} />
                    <AffiliateMetric label="All-time clicks" value={affiliateStats.summary.totalClicks} />
                    <AffiliateMetric label="Best merchant" value={affiliateStats.summary.bestMerchant?.label || 'None'} detail={affiliateStats.summary.bestMerchant ? `${affiliateStats.summary.bestMerchant.clicksInWindow} clicks` : undefined} />
                    <AffiliateMetric label="Best intent" value={affiliateStats.summary.bestIntent?.label || 'None'} detail={affiliateStats.summary.bestIntent ? `${affiliateStats.summary.bestIntent.clicksInWindow} clicks` : undefined} />
                  </div>

                  <AffiliateInsightCards insights={affiliateInsights} />

                  {(affiliateStats.promotion.rows.length > 0 || affiliateStats.promotion.visits.rows.length > 0) && (
                    <div className="space-y-3 rounded border border-ring-teal/35 bg-ring-teal/10 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-bold text-ring-teal">Promotion Actions</h4>
                          <p className="mt-1 text-xs text-ring-light/65">
                            Admin copy and social-share actions from promotion candidates.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <AffiliateMetric label={`${affiliateStats.days}d actions`} value={affiliateStats.promotion.summary.clicksInWindow} />
                          <AffiliateMetric label={`${affiliateStats.days}d visits`} value={affiliateStats.promotion.visits.summary.clicksInWindow} />
                          <AffiliateMetric label="All-time actions" value={affiliateStats.promotion.summary.totalClicks} />
                          <AffiliateMetric label="All-time visits" value={affiliateStats.promotion.visits.summary.totalClicks} />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                        <AffiliateBreakdown title="Promotion Actions" rows={affiliateStats.promotion.summary.byAction} />
                        <AffiliateBreakdown title="Promotion Trackers" rows={affiliateStats.promotion.summary.byTracker} />
                        <AffiliateBreakdown title="Promotion Visit Sources" rows={affiliateStats.promotion.visits.summary.bySource} />
                        <AffiliateBreakdown title="Promotion Visit Trackers" rows={affiliateStats.promotion.visits.summary.byTracker} />
                        <AffiliateBreakdown title="Affiliate Click Sources" rows={affiliateStats.promotion.affiliateSources} />
                      </div>

                      <PromotionEfficiencyTable rows={affiliateStats.promotion.efficiency} />
                      <PromotionEfficiencyTable rows={affiliateStats.promotion.sourceEfficiency} label="Source" />

                      <div className="overflow-x-auto rounded border border-ring-teal/25">
                        <table className="min-w-full text-left text-xs">
                          <thead className="bg-black/20 text-ring-teal">
                            <tr>
                              <th className="px-3 py-2">Tracker</th>
                              <th className="px-3 py-2">Action</th>
                              <th className="px-3 py-2 text-right">30d</th>
                              <th className="px-3 py-2 text-right">Total</th>
                              <th className="px-3 py-2">Last Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ring-teal/15 text-ring-light">
                            {affiliateStats.promotion.rows.map((row) => (
                              <tr key={`${row.tracker}-${row.action}`}>
                                <td className="px-3 py-2">{row.trackerTitle}</td>
                                <td className="px-3 py-2">{row.label}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{row.clicksInWindow}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{row.totalClicks}</td>
                                <td className="px-3 py-2">
                                  {row.lastAction?.actedAt ? (
                                    <>
                                      <span className="block">{new Date(row.lastAction.actedAt).toLocaleString()}</span>
                                      <span className="block text-ring-light/60">
                                        {[row.lastAction.card, row.lastAction.serial].filter(Boolean).join(' / ')}
                                      </span>
                                      {row.lastAction.detailUrl && (
                                        <a href={row.lastAction.detailUrl} target="_blank" rel="noopener noreferrer" className="text-ring-teal hover:underline">
                                          Open card
                                        </a>
                                      )}
                                    </>
                                  ) : 'None'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <AffiliateBreakdown title="Trackers" rows={affiliateStats.summary.byTracker.slice(0, 5)} />
                    <AffiliateBreakdown title="Merchants" rows={affiliateStats.summary.byMerchant} />
                    <AffiliateBreakdown title="Intent" rows={affiliateStats.summary.byIntent} />
                    <AffiliateBreakdown title="Placements" rows={affiliateStats.summary.byPlacement} />
                  </div>

                  {(affiliateStats.summary.byViewFilter.length > 0 ||
                    affiliateStats.summary.byViewSort.length > 0 ||
                    affiliateStats.summary.byViewCardFilter.length > 0) && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <AffiliateBreakdown title="View Filters" rows={affiliateStats.summary.byViewFilter} />
                      <AffiliateBreakdown title="View Sorts" rows={affiliateStats.summary.byViewSort} />
                      <AffiliateBreakdown title="View Cards" rows={affiliateStats.summary.byViewCardFilter} />
                    </div>
                  )}

                  {(affiliateStats.summary.byViewCard.length > 0 ||
                    affiliateStats.summary.byViewSerial.length > 0) && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <AffiliateBreakdown title="Detail Cards" rows={affiliateStats.summary.byViewCard.slice(0, 10)} />
                      <AffiliateBreakdown title="Detail Serials" rows={affiliateStats.summary.byViewSerial.slice(0, 10)} />
                    </div>
                  )}

                  {(affiliateStats.summary.byLastClickFilter.length > 0 ||
                    affiliateStats.summary.byLastClickSort.length > 0 ||
                    affiliateStats.summary.byLastClickCardFilter.length > 0 ||
                    affiliateStats.summary.byLastClickCard.length > 0 ||
                    affiliateStats.summary.byLastClickSerial.length > 0) && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                      <AffiliateBreakdown title="Last-click Filters" rows={affiliateStats.summary.byLastClickFilter} />
                      <AffiliateBreakdown title="Last-click Sorts" rows={affiliateStats.summary.byLastClickSort} />
                      <AffiliateBreakdown title="Last-click Cards" rows={affiliateStats.summary.byLastClickCardFilter} />
                      <AffiliateBreakdown title="Last-click Detail Cards" rows={affiliateStats.summary.byLastClickCard.slice(0, 10)} />
                      <AffiliateBreakdown title="Last-click Serials" rows={affiliateStats.summary.byLastClickSerial.slice(0, 10)} />
                    </div>
                  )}

                  <div className="overflow-x-auto rounded border border-ring-gold/30">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-black/20 text-ring-gold">
                        <tr>
                          <th className="px-3 py-2">Tracker</th>
                          <th className="px-3 py-2">Merchant</th>
                          <th className="px-3 py-2">Intent</th>
                          <th className="px-3 py-2">Placement</th>
                          <th className="px-3 py-2 text-right">30d</th>
                          <th className="px-3 py-2 text-right">Total</th>
                          <th className="px-3 py-2">Last Click</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ring-gold/15 text-ring-light">
                        {affiliateStats.rows.map((row) => (
                          <tr key={`${row.tracker}-${row.merchant}-${row.placement}`}>
                            <td className="px-3 py-2">
                              <div className="font-bold text-ring-light">{row.trackerTitle}</div>
                              <a href={row.href} target="_blank" rel="noopener noreferrer sponsored" className="text-ring-gold hover:underline">
                                {row.label}
                              </a>
                            </td>
                            <td className="px-3 py-2 capitalize">{row.merchant}</td>
                            <td className="px-3 py-2 capitalize">{row.intent.replace('-', ' ')}</td>
                            <td className="px-3 py-2">{row.placement}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{row.clicksInWindow}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{row.totalClicks}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {row.lastClick?.clickedAt ? (
                                <>
                                  <span className="block">{new Date(row.lastClick.clickedAt).toLocaleString()}</span>
                                  {row.lastClick.sourcePath && (
                                    getInternalSourcePath(row.lastClick.sourcePath) ? (
                                      <a
                                        href={getInternalSourcePath(row.lastClick.sourcePath)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block max-w-48 truncate text-xs text-ring-gold/80 hover:underline"
                                      >
                                        {row.lastClick.sourcePath}
                                      </a>
                                    ) : (
                                      <span className="block max-w-48 truncate text-xs text-ring-light/60">{row.lastClick.sourcePath}</span>
                                    )
                                  )}
                                  {row.lastClick.href && (
                                    <a
                                      href={row.lastClick.href}
                                      target="_blank"
                                      rel="noopener noreferrer sponsored"
                                      className="block max-w-48 truncate text-xs text-ring-gold/80 hover:underline"
                                    >
                                      Last destination
                                    </a>
                                  )}
                                  {row.lastClick.viewContext && (
                                    <span className="block max-w-64 text-xs text-ring-light/60">
                                      {[
                                        row.lastClick.viewContext.filter && `filter: ${row.lastClick.viewContext.filter}`,
                                        row.lastClick.viewContext.sort && `sort: ${row.lastClick.viewContext.sort}`,
                                        row.lastClick.viewContext.cardFilter && `card: ${row.lastClick.viewContext.cardFilter}`,
                                        row.lastClick.viewContext.query && `q: ${row.lastClick.viewContext.query}`,
                                        row.lastClick.viewContext.serial && `serial: ${row.lastClick.viewContext.serial}`,
                                        row.lastClick.viewContext.slot && `slot: ${row.lastClick.viewContext.slot}`,
                                      ].filter(Boolean).join(' | ')}
                                    </span>
                                  )}
                                </>
                              ) : 'None'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Image Tab */}
          {activeTab === 'image' && (
            <div>
              <label className="block text-ring-gold text-sm font-bold mb-2">
                Image URL
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-2 px-3"
              />
              <button
                onClick={handleImageUpdate}
                className="w-full bg-ring-gold hover:bg-yellow-400 text-ring-dark font-bold py-2 px-4 rounded mt-2"
              >
                Update Image
              </button>
            </div>
          )}

          {/* Grading Tab */}
          {activeTab === 'grading' && (
            <div className="space-y-3">
              <div>
                <label className="block text-ring-gold text-sm font-bold mb-2">
                  Grading Service
                </label>
                <input
                  type="text"
                  value={gradingService}
                  onChange={(e) => setGradingService(e.target.value)}
                  placeholder="e.g., PSA, BGS, CGC"
                  className="w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-2 px-3"
                />
              </div>
              <div>
                <label className="block text-ring-gold text-sm font-bold mb-2">
                  Grade
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="e.g., 9.5"
                  className="w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-2 px-3"
                />
              </div>
              <div>
                <label className="block text-ring-gold text-sm font-bold mb-2">
                  Date Graded (optional)
                </label>
                <input
                  type="date"
                  value={dateGraded}
                  onChange={(e) => setDateGraded(e.target.value)}
                  className="w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-2 px-3"
                />
              </div>
              <button
                onClick={handleGradingUpdate}
                className="w-full bg-ring-gold hover:bg-yellow-400 text-ring-dark font-bold py-2 px-4 rounded"
              >
                Update Grading
              </button>
            </div>
          )}

          {/* Price History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div>
                <label className="block text-ring-gold text-sm font-bold mb-2">
                  Sale Price ($)
                </label>
                <input
                  type="number"
                  value={historyPrice}
                  onChange={(e) => setHistoryPrice(e.target.value)}
                  placeholder="Enter sale price..."
                  className="w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-2 px-3"
                />
              </div>
              <div>
                <label className="block text-ring-gold text-sm font-bold mb-2">
                  Sale Date
                </label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-2 px-3"
                />
              </div>
              <div>
                <label className="block text-ring-gold text-sm font-bold mb-2">
                  Sold By (optional)
                </label>
                <input
                  type="text"
                  value={soldBy}
                  onChange={(e) => setSoldBy(e.target.value)}
                  placeholder="Previous owner"
                  className="w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-2 px-3"
                />
              </div>
              <div>
                <label className="block text-ring-gold text-sm font-bold mb-2">
                  Sold To (optional)
                </label>
                <input
                  type="text"
                  value={soldTo}
                  onChange={(e) => setSoldTo(e.target.value)}
                  placeholder="New owner"
                  className="w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-2 px-3"
                />
              </div>
              <button
                onClick={handlePriceHistoryAdd}
                className="w-full bg-ring-gold hover:bg-yellow-400 text-ring-dark font-bold py-2 px-4 rounded"
              >
                Add to Price History
              </button>
            </div>
          )}

          {message && (
            <p className="text-center text-green-400 text-sm">{message}</p>
          )}

          <p className="text-xs text-ring-light text-center">
            Press Ctrl + Alt + A to toggle this panel
          </p>
        </div>
        )}
      </div>
    </div>
  );
} 

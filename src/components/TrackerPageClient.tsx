'use client';

import { saveAdminMutation } from '@/lib/admin-mutation-client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SerializedRingCard, GradingInfo, PriceHistoryEntry } from "@/lib/types";
import { getSerialAffiliateLinks, type TrackerSummary } from '@/lib/trackers';
import Link from "next/link";
import {
  findTrackerCardByDeepLinkParams,
  formatTrackerCardLabel,
  getTrackerCardDeepLinkParams,
  getTrackerCardDefinitions,
  getTrackerTotalSlots,
} from '@/lib/tracker-data';
import AffiliateLinks from "@/components/AffiliateLinks";
import AffiliateDisclosureNotice from "@/components/AffiliateDisclosureNotice";
import AffiliateOutboundLink from '@/components/AffiliateOutboundLink';
import PrimaryAffiliateCtas from '@/components/PrimaryAffiliateCtas';
import TrackerFaq from '@/components/TrackerFaq';
import TrackerMarketInsights from '@/components/TrackerMarketInsights';
import TrackerMarketTrustStrip from '@/components/TrackerMarketTrustStrip';
import ReferenceLinks from '@/components/ReferenceLinks';
import ReportButton from '@/components/ReportButton';
import AdminPanel from '@/components/AdminPanel';
import ProgressBar from '@/components/ProgressBar';
import FilterControls from '@/components/FilterControls';
import TrackerPagination from '@/components/TrackerPagination';
import { browseTrackerCards, getCardStatusLabel, getTrackerPage, matchesTrackerStatus, VALID_SORT_ORDERS, VALID_STATUS_FILTERS } from '@/lib/tracker-browse';
import CardDetails from '@/components/CardDetails';
import ExternalImage from '@/components/ExternalImage';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { XMarkIcon } from '@heroicons/react/24/outline';
import { getTrackerMarketSummary } from '@/lib/tracker-market-summary';

interface CardSummaryRow {
  slug: string;
  title: string;
  total: number;
  foundCount: number;
  confirmedCount: number;
  pendingReportCount: number;
  referenceImage?: string;
}

type ActiveFilterChipId = 'search' | 'card' | 'status' | 'sort';

const STATUS_FILTER_LABELS: Record<string, string> = {
  found: 'located serials',
  pending: 'pending reports',
  unreported: 'unreported serials',
  confirmed: 'confirmed discoveries',
  'source-linked': 'source-linked discoveries',
  'has-evidence': 'proof-backed discoveries',
  'source-marketplace': 'marketplace-sourced discoveries',
  'source-grading-pop': 'grading pop discoveries',
  'source-social': 'social-sourced discoveries',
  'source-article': 'article-sourced discoveries',
  'source-private-sale': 'private sale discoveries',
  'source-other': 'other sourced discoveries',
  'not-found': 'unlocated serials',
};

const SORT_ORDER_LABELS: Record<string, string> = {
  'id-desc': 'highest serials first',
  'price-desc': 'highest prices first',
  'price-asc': 'lowest prices first',
  'date-desc': 'newest finds first',
  'date-asc': 'oldest finds first',
  'evidence-desc': 'most evidence first',
};

export default function TrackerPageClient({ tracker }: { tracker: TrackerSummary }) {
  const [cards, setCards] = useState<SerializedRingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const trackerPath = `/trackers/${tracker.slug}`;
  const trackerApiBase = `/api/trackers/${tracker.slug}`;
  const referenceImage = tracker.referenceImage || '/icon.svg';
  const cardDefinitions = useMemo(() => getTrackerCardDefinitions(tracker), [tracker]);

  // State for filtering and sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [cardFilter, setCardFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('id-asc');
  const [viewStateInitialized, setViewStateInitialized] = useState(false);
  const filterKey = JSON.stringify([searchQuery, cardFilter, statusFilter, sortOrder]);
  const [pageSelection, setPageSelection] = useState({ filters: '', page: 1 });
  const browseHeadingRef = useRef<HTMLHeadingElement>(null);
  
  // State for lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // State for card details
  const [selectedCardForDetails, setSelectedCardForDetails] = useState<SerializedRingCard | null>(null);
  const [copyViewMessage, setCopyViewMessage] = useState('');
  const copyViewMessageTimeoutRef = useRef<number | null>(null);
  const promotionVisitTrackedRef = useRef(false);

  useEffect(() => {
    if (promotionVisitTrackedRef.current) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('utm_campaign') !== 'discovery_promotion') {
      return;
    }

    const source = params.get('utm_source');
    if (!source) {
      return;
    }

    const path = `${window.location.pathname}${window.location.search}`;
    const sessionKey = `mtgtrackers:promotion-visit:${tracker.slug}:${path}`;
    try {
      if (window.sessionStorage.getItem(sessionKey)) {
        promotionVisitTrackedRef.current = true;
        return;
      }
      window.sessionStorage.setItem(sessionKey, '1');
    } catch {
      // Browsers can disable storage; still try to record the visit once for this mounted page.
    }

    promotionVisitTrackedRef.current = true;

    const payload = JSON.stringify({
      tracker: tracker.slug,
      source,
      campaign: params.get('utm_campaign'),
      content: params.get('utm_content') || undefined,
      card: params.get('card') || undefined,
      serial: params.get('serial') || undefined,
      path,
    });

    if (navigator.sendBeacon) {
      const queued = navigator.sendBeacon('/api/promotion/visit', new Blob([payload], { type: 'application/json' }));
      if (queued) {
        return;
      }
    }

    if (typeof fetch !== 'function') {
      return;
    }

    void fetch('/api/promotion/visit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  }, [tracker.slug]);

  const syncViewStateFromUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const nextStatusFilter = params.get('filter') || 'all';
    const nextSortOrder = params.get('sort') || 'id-asc';
    const nextCardFilter = params.get('cardFilter') || 'all';
    const isKnownCardFilter =
      nextCardFilter === 'all' || cardDefinitions.some((definition) => definition.slug === nextCardFilter);

    setSearchQuery(params.get('q') || '');
    setStatusFilter(VALID_STATUS_FILTERS.has(nextStatusFilter) ? nextStatusFilter : 'all');
    setSortOrder(VALID_SORT_ORDERS.has(nextSortOrder) ? nextSortOrder : 'id-asc');
    setCardFilter(isKnownCardFilter ? nextCardFilter : 'all');
    setPageSelection({
      filters: JSON.stringify([params.get('q') || '', isKnownCardFilter ? nextCardFilter : 'all',
        VALID_STATUS_FILTERS.has(nextStatusFilter) ? nextStatusFilter : 'all',
        VALID_SORT_ORDERS.has(nextSortOrder) ? nextSortOrder : 'id-asc']),
      page: Number(params.get('page') || 1),
    });
  }, [cardDefinitions]);

  useEffect(() => {
    syncViewStateFromUrl();
    setViewStateInitialized(true);

    window.addEventListener('popstate', syncViewStateFromUrl);

    return () => {
      window.removeEventListener('popstate', syncViewStateFromUrl);
      if (copyViewMessageTimeoutRef.current) {
        window.clearTimeout(copyViewMessageTimeoutRef.current);
      }
    };
  }, [syncViewStateFromUrl]);

  const filteredAndSortedCards = useMemo(() => browseTrackerCards(cards, {
    cardFilter, searchQuery, statusFilter, sortOrder,
  }), [cards, cardFilter, searchQuery, statusFilter, sortOrder]);
  const requestedPage = pageSelection.filters === filterKey ? pageSelection.page : 1;
  const pagination = getTrackerPage(filteredAndSortedCards.length, requestedPage);
  const visibleCards = useMemo(() => filteredAndSortedCards.slice(pagination.start, pagination.end),
    [filteredAndSortedCards, pagination.start, pagination.end]);
  const statusCounts = useMemo(() => {
    const matching = browseTrackerCards(cards, { cardFilter, searchQuery, statusFilter: 'all', sortOrder });
    return Object.fromEntries(['all', 'found', 'pending', 'unreported'].map((status) =>
      [status, matching.filter((card) => matchesTrackerStatus(card, status)).length]));
  }, [cards, cardFilter, searchQuery, sortOrder]);
  const changePage = (page: number) => {
    setPageSelection({ filters: filterKey, page });
    browseHeadingRef.current?.focus({ preventScroll: true });
    browseHeadingRef.current?.scrollIntoView({ block: 'start' });
  };

  useEffect(() => {
    if (!viewStateInitialized || loading || dataError) return;

    const params = new URLSearchParams(window.location.search);
    const trimmedSearchQuery = searchQuery.trim();

    if (trimmedSearchQuery) {
      params.set('q', trimmedSearchQuery);
    } else {
      params.delete('q');
    }

    if (statusFilter !== 'all') {
      params.set('filter', statusFilter);
    } else {
      params.delete('filter');
    }

    if (sortOrder !== 'id-asc') {
      params.set('sort', sortOrder);
    } else {
      params.delete('sort');
    }

    if (cardFilter !== 'all') {
      params.set('cardFilter', cardFilter);
    } else {
      params.delete('cardFilter');
    }

    if (pagination.page > 1) params.set('page', String(pagination.page));
    else params.delete('page');

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, '', nextUrl);
    }
  }, [cardFilter, searchQuery, sortOrder, statusFilter, pagination.page, viewStateInitialized, loading, dataError]);

  const clearCopyViewMessageSoon = () => {
    if (copyViewMessageTimeoutRef.current) {
      window.clearTimeout(copyViewMessageTimeoutRef.current);
    }

    copyViewMessageTimeoutRef.current = window.setTimeout(() => {
      setCopyViewMessage('');
      copyViewMessageTimeoutRef.current = null;
    }, 1800);
  };

  const copyCurrentViewLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.href);
      } else {
        const input = document.createElement('input');
        input.value = window.location.href;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }

      setCopyViewMessage('Copied');
      clearCopyViewMessageSoon();
    } catch {
      setCopyViewMessage('Copy failed');
      clearCopyViewMessageSoon();
    }
  };

  const openCardDetails = useCallback((card: SerializedRingCard, replace = false) => {
    setSelectedCardForDetails(card);

    const params = new URLSearchParams(window.location.search);
    const deepLinkParams = getTrackerCardDeepLinkParams(tracker, card);

    params.delete('card');
    params.delete('serial');
    params.delete('slot');
    params.delete('id');

    for (const [key, value] of deepLinkParams) {
      params.set(key, value);
    }

    const query = params.toString();
    window.history[replace ? 'replaceState' : 'pushState'](null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, [tracker]);

  const closeCardDetails = useCallback(() => {
    setSelectedCardForDetails(null);

    const params = new URLSearchParams(window.location.search);
    params.delete('card');
    params.delete('serial');
    params.delete('slot');
    params.delete('id');

    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, []);

  const fetchCards = useCallback(async () => {
    try {
      const response = await fetch(`${trackerApiBase}/cards`);
      if (!response.ok) {
        throw new Error(`Cards request failed with status ${response.status}`);
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Cards response was not an array');
      }

      setCards(data);
      setDataError(null);
    } catch (error) {
      console.warn('Tracker card data unavailable:', error);
      setCards([]);
      setDataError('Tracker data is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, [trackerApiBase]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  useEffect(() => {
    if (cards.length === 0) return;

    const syncDetailsFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const card = findTrackerCardByDeepLinkParams(tracker, cards, params);

      setSelectedCardForDetails(card || null);
    };

    syncDetailsFromUrl();
    window.addEventListener('popstate', syncDetailsFromUrl);

    return () => {
      window.removeEventListener('popstate', syncDetailsFromUrl);
    };
  }, [cards, tracker]);

  const handlePriceUpdate = async (cardId: number, entry: PriceHistoryEntry) => {
    await saveAdminMutation(`${trackerApiBase}/update-price`, { cardId, ...entry });
    await fetchCards();
  };

  const handleImageUpdate = async (cardId: number, imageUrl: string) => {
    await saveAdminMutation(`${trackerApiBase}/update-image`, { cardId, imageUrl });
    await fetchCards();
  };

  const handleGradingUpdate = async (cardId: number, grading: GradingInfo | undefined, status: 'graded' | 'ungraded' = 'graded', occurredOn?: string) => {
    await saveAdminMutation(`${trackerApiBase}/update-grading`, { cardId, grading, status, occurredOn });
    await fetchCards();
  };

  const handlePriceHistoryAdd = async (cardId: number, entry: PriceHistoryEntry) => {
    await saveAdminMutation(`${trackerApiBase}/add-price-history`, { cardId, entry });
    await fetchCards();
  };
  const cardFilterOptions = useMemo(() => {
    const countsBySlug = new Map<string, number>();

    for (const card of cards) {
      if (!card.cardSlug) continue;
      countsBySlug.set(card.cardSlug, (countsBySlug.get(card.cardSlug) || 0) + 1);
    }

    return cardDefinitions.map((definition) => ({
      slug: definition.slug,
      title: definition.title,
      count: countsBySlug.get(definition.slug) || definition.total,
    }));
  }, [cards, cardDefinitions]);

  const cardSummaryRows = useMemo<CardSummaryRow[]>(() => {
    if (cardDefinitions.length <= 1) {
      return [];
    }

    return cardDefinitions.map((definition) => {
      const definitionCards = cards.filter((card) => card.cardSlug === definition.slug);

      return {
        slug: definition.slug,
        title: definition.title,
        total: definitionCards.length || definition.total,
        foundCount: definitionCards.filter((card) => card.found).length,
        confirmedCount: definitionCards.filter((card) => card.verificationStatus === 'confirmed').length,
        pendingReportCount: definitionCards.reduce((total, card) => total + (card.pendingReports || 0), 0),
        referenceImage: definition.referenceImage,
      };
    });
  }, [cards, cardDefinitions]);

  const lightboxSlides = useMemo(() => {
    return visibleCards
      .map(card => card.image || referenceImage)
      .map(src => ({ src }));
  }, [visibleCards, referenceImage]);
  const filteredQualitySummary = useMemo(() => {
    const locatedCount = filteredAndSortedCards.filter((card) => card.found).length;
    const confirmedInViewCount = filteredAndSortedCards.filter((card) => card.verificationStatus === 'confirmed').length;
    const evidenceBackedCount = filteredAndSortedCards.filter((card) => (card.evidenceImages || []).length > 0).length;
    const pendingReportsInViewCount = filteredAndSortedCards.reduce((total, card) => total + (card.pendingReports || 0), 0);

    return {
      locatedCount,
      confirmedInViewCount,
      evidenceBackedCount,
      pendingReportsInViewCount,
    };
  }, [filteredAndSortedCards]);

  const foundCards = cards.filter((card) => card.found);
  const confirmedCount = cards.filter((card) => card.verificationStatus === 'confirmed').length;
  const foundCount = foundCards.length;
  const totalCount = cards.length || getTrackerTotalSlots(tracker);
  const pendingReportCount = cards.reduce((total, card) => total + (card.pendingReports || 0), 0);
  const hasActiveViewFilters =
    searchQuery.trim() !== '' ||
    cardFilter !== 'all' ||
    statusFilter !== 'all' ||
    sortOrder !== 'id-asc';
  const activeViewSummary = useMemo(() => {
    const parts = [];
    const selectedCardDefinition = cardDefinitions.find((definition) => definition.slug === cardFilter);

    if (selectedCardDefinition) {
      parts.push(selectedCardDefinition.title);
    }
    if (statusFilter !== 'all') {
      parts.push(STATUS_FILTER_LABELS[statusFilter] || statusFilter);
    }
    if (searchQuery.trim()) {
      parts.push(`search "${searchQuery.trim()}"`);
    }
    if (sortOrder !== 'id-asc') {
      parts.push(SORT_ORDER_LABELS[sortOrder] || sortOrder);
    }

    return parts.length > 0 ? parts.join(' / ') : 'current tracker view';
  }, [cardDefinitions, cardFilter, searchQuery, sortOrder, statusFilter]);
  const activeFilterChips = useMemo<Array<{ id: ActiveFilterChipId; label: string }>>(() => {
    const chips: Array<{ id: ActiveFilterChipId; label: string }> = [];
    const selectedCardDefinition = cardDefinitions.find((definition) => definition.slug === cardFilter);

    if (selectedCardDefinition) {
      chips.push({ id: 'card', label: `Card: ${selectedCardDefinition.title}` });
    }
    if (statusFilter !== 'all') {
      chips.push({ id: 'status', label: `Status: ${STATUS_FILTER_LABELS[statusFilter] || statusFilter}` });
    }
    if (searchQuery.trim()) {
      chips.push({ id: 'search', label: `Search: ${searchQuery.trim()}` });
    }
    if (sortOrder !== 'id-asc') {
      chips.push({ id: 'sort', label: `Sort: ${SORT_ORDER_LABELS[sortOrder] || sortOrder}` });
    }

    return chips;
  }, [cardDefinitions, cardFilter, searchQuery, sortOrder, statusFilter]);
  const marketSummary = useMemo(() => getTrackerMarketSummary(tracker, cards), [cards, tracker]);

  const clearActiveFilterChip = (id: ActiveFilterChipId) => {
    if (id === 'search') {
      setSearchQuery('');
    } else if (id === 'card') {
      setCardFilter('all');
    } else if (id === 'status') {
      setStatusFilter('all');
    } else if (id === 'sort') {
      setSortOrder('id-asc');
    }
  };

  const lastFoundCard = foundCards.sort((a, b) => {
    if (!a.dateFound || !b.dateFound) return 0;
    return new Date(b.dateFound).getTime() - new Date(a.dateFound).getTime();
  })[0];

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-5xl space-y-6">
          <Link href="/sets" className="text-sm text-ring-teal hover:underline">All Sets</Link>
          <h1 className={`break-words text-3xl font-bold ${tracker.theme.accentClass}`}>{tracker.displayTitle || tracker.title} Tracker</h1>
          <p className="text-sm text-ring-light/70">{tracker.subtitle}</p>
          <p role="status" className="text-ring-light/70">Loading serials...</p>
          <TrackerMarketInsights tracker={tracker} />
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="flex min-h-screen flex-col items-center px-4 py-6 sm:p-8 md:p-12">
        <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
          <div className="mb-4 min-w-0 lg:mb-0 lg:pr-6">
            <h1 className={`break-words text-2xl font-bold md:text-4xl ${tracker.theme.accentClass}`}>
              {tracker.displayTitle || tracker.title}
            </h1>
            <p className="mt-2 text-sm text-ring-light/70">{tracker.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/" className="text-ring-gold hover:text-yellow-400 transition-colors">
              Home
            </Link>
            <Link href="/sets" className="text-ring-teal hover:underline">Sets</Link>
            <a href="#serials" className="text-ring-teal hover:underline">Browse serials</a>
            <Link href={`${trackerPath}/stats`} className="text-ring-gold hover:text-yellow-400 transition-colors">
              Stats
            </Link>
            <button
              type="button"
              onClick={copyCurrentViewLink}
              className="inline-flex min-h-10 items-center justify-center rounded border border-ring-gold/70 px-3 py-2 text-sm font-bold text-ring-gold transition-colors hover:border-yellow-400 hover:text-yellow-400 focus:outline-none focus:ring-2 focus:ring-ring-gold focus:ring-offset-2 focus:ring-offset-ring-dark"
              aria-live="polite"
            >
              {copyViewMessage || 'Copy View'}
            </button>
            <ReportButton href={`${trackerPath}/submit`} />
          </div>
        </div>

        <div className="w-full max-w-5xl mt-6 border-y border-ring-gold/25 py-5 text-left font-sans">
          <div className="mb-5 text-left">
            <AffiliateDisclosureNotice links={tracker.affiliateLinks} compact />
          </div>
          <PrimaryAffiliateCtas links={tracker.affiliateLinks} trackerSlug={tracker.slug} compact />
          <ProgressBar current={foundCount} total={totalCount} />
          <p className="text-ring-light mt-3 text-sm">
            Tracking {totalCount} {tracker.cardType || 'serialized cards'}{cardDefinitions.length > 1 ? ` across ${cardDefinitions.length} cards` : ''} from {tracker.setName || 'Magic: The Gathering'}. {confirmedCount} confirmed, {foundCount - confirmedCount} source-linked or unverified.
          </p>
          {dataError && (
            <p className="text-ring-light mt-4 text-sm">{dataError}</p>
          )}
          {lastFoundCard && (
            <p className="text-ring-light mt-4 text-sm">
              Last find:{' '}
              <button
                type="button"
                onClick={() => openCardDetails(lastFoundCard)}
                className="text-ring-gold underline-offset-4 transition-colors hover:text-yellow-400 hover:underline"
              >
                {formatTrackerCardLabel(tracker, lastFoundCard)}
              </button>{' '}
              {lastFoundCard.foundBy ? `by ${lastFoundCard.foundBy}` : ''}{lastFoundCard.dateFound ? ` on ${lastFoundCard.dateFound}` : ''}
            </p>
          )}
          {!lastFoundCard && !dataError && (
            <p className="mt-4 rounded border border-ring-gold/30 bg-black/20 px-4 py-3 text-sm text-ring-light">
              No public discoveries have been verified for this tracker yet. New reports enter admin review before they appear here.
              {pendingReportCount > 0 && ` ${pendingReportCount} report${pendingReportCount === 1 ? ' is' : 's are'} currently pending.`}
            </p>
          )}
        </div>

        {!dataError && (
          <>
            <h2 id="serials" ref={browseHeadingRef} tabIndex={-1} className="mb-3 mt-8 w-full max-w-5xl scroll-mt-4 text-xl font-bold text-ring-gold">Serials</h2>
            <CardSummarySection
              rows={cardSummaryRows}
              selectedCardSlug={cardFilter}
              onSelectCard={(slug) => {
                setCardFilter(slug);
                setSearchQuery('');
              }}
            />

            <FilterControls
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              cardFilter={cardFilter}
              setCardFilter={setCardFilter}
              cardOptions={cardDefinitions.length > 1 ? cardFilterOptions : []}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              statusCounts={statusCounts}
            />

            <div className="mt-3 flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 py-2 font-sans text-sm text-ring-light" role="status">
              <p>
                Showing <span className="font-bold text-ring-gold">{filteredAndSortedCards.length ? `${pagination.start + 1}-${pagination.end}` : '0'}</span> of{' '}
                <span className="font-bold text-ring-gold">{filteredAndSortedCards.length}</span> matching serials
                {hasActiveViewFilters ? ` for ${activeViewSummary}` : ' in this tracker'}.
              </p>
              {filteredQualitySummary.pendingReportsInViewCount > 0 && (
                <p className="text-xs text-ring-light/70">
                  {filteredQualitySummary.pendingReportsInViewCount} pending report{filteredQualitySummary.pendingReportsInViewCount === 1 ? '' : 's'} in this view awaiting review.
                </p>
              )}
              {filteredAndSortedCards.length > 0 && (
                <p className="text-xs text-ring-light/70">
                  {filteredQualitySummary.locatedCount} located - {filteredQualitySummary.confirmedInViewCount} confirmed - {filteredQualitySummary.evidenceBackedCount} with evidence
                </p>
              )}
            </div>

            {activeFilterChips.length > 0 && (
              <div className="mt-3 flex w-full max-w-5xl flex-wrap items-center gap-2">
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => clearActiveFilterChip(chip.id)}
                    className="inline-flex min-h-9 max-w-full items-center gap-2 rounded border border-ring-gold/40 bg-ring-dark/80 px-3 py-1 font-sans text-xs font-bold text-ring-light transition-colors hover:border-ring-gold hover:text-ring-gold focus:outline-none focus:ring-2 focus:ring-ring-gold focus:ring-offset-2 focus:ring-offset-ring-dark"
                  >
                    <span className="min-w-0 break-words">{chip.label}</span>
                    <XMarkIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCardFilter('all');
                    setStatusFilter('all');
                    setSortOrder('id-asc');
                  }}
                  className="inline-flex min-h-9 items-center rounded border border-ring-gold/30 px-3 py-1 font-sans text-xs font-bold text-ring-gold transition-colors hover:border-yellow-400 hover:text-yellow-400 focus:outline-none focus:ring-2 focus:ring-ring-gold focus:ring-offset-2 focus:ring-offset-ring-dark"
                >
                  Clear All
                </button>
              </div>
            )}

            <TrackerPagination {...pagination} onChange={changePage} position="top" />
            <section className="w-full max-w-5xl mt-4 font-sans" aria-label={`${tracker.title} serialized cards`}>
              <h2 className="sr-only">{tracker.title} Card Collection</h2>
              {filteredAndSortedCards.length === 0 ? (
                <div className="rounded-lg border border-ring-gold/30 bg-ring-dark/80 px-5 py-8 text-center">
                  <p className="text-lg font-bold text-ring-gold">No serials match these filters.</p>
                  <p className="mt-2 text-sm text-ring-light/70">
                    Try clearing the search, switching status filters, or checking back after new reports are reviewed.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setCardFilter('all');
                      setStatusFilter('all');
                      setSortOrder('id-asc');
                    }}
                    className="mt-4 rounded bg-ring-gold px-4 py-2 text-sm font-bold text-ring-dark hover:bg-yellow-400"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {visibleCards.map((card, index) => {
              const imageSrc = card.image || referenceImage;
              const reportParams = getTrackerCardDeepLinkParams(tracker, card);
              if (card.found) reportParams.set('kind', 'sighting');
              const reportHref = `${trackerPath}/submit?${reportParams.toString()}`;
              const serialEbayLink = getSerialAffiliateLinks(tracker, card).find((link) => link.merchant === 'ebay');
              const statusLabel = getCardStatusLabel(card);
              
              return (
                <article key={card.id} className="border border-ring-gold/40 rounded-lg p-4 bg-ring-dark flex flex-col h-full">
                  <div 
                    className="aspect-[3/4] mb-3 bg-ring-light rounded overflow-hidden cursor-pointer"
                    onClick={() => {
                      setLightboxIndex(index);
                      setLightboxOpen(true);
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`View larger image of ${formatTrackerCardLabel(tracker, card)}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setLightboxIndex(index);
                        setLightboxOpen(true);
                      }
                    }}
                  >
                    <ExternalImage
                      src={imageSrc}
                      alt={`${formatTrackerCardLabel(tracker, card)} - ${card.name}`}
                      className="w-full h-full object-contain bg-black/20"
                      fallbackSrc={referenceImage}
                    />
                  </div>
                  
                  <h3 className="text-lg font-bold text-ring-gold tabular-nums">{card.serialNumber}/{card.serialTotal || tracker.total}</h3>
                  {card.cardTitle && card.cardTitle !== tracker.title && (
                    <p className="mb-2 text-sm font-semibold text-ring-light">{card.cardTitle}</p>
                  )}
                  
                  <div className="flex-grow flex flex-col">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                        card.found
                          ? 'bg-green-800/50 text-green-300'
                          : (card.pendingReports || 0) > 0
                            ? 'bg-ring-teal/20 text-ring-teal'
                            : 'bg-gray-700/50 text-gray-300'
                      }`}
                    >
                      {statusLabel}
                    </span>
                    {(card.pendingReports || 0) > 0 && (
                      <span className="mt-2 inline-block rounded border border-ring-teal/40 px-2 py-0.5 text-xs text-ring-light">
                        {card.pendingReports} {card.found ? 'update' : 'report'}{card.pendingReports === 1 ? '' : 's'} under review
                      </span>
                    )}
                    {card.sourceType && (
                      <span className="mt-2 inline-block rounded border border-ring-gold/30 px-2 py-0.5 text-xs text-ring-light">
                        {card.sourceType.replace('-', ' ')}
                      </span>
                    )}
                    {(card.evidenceImages || []).length > 0 && (
                      <span className="mt-2 inline-block rounded border border-ring-teal/40 px-2 py-0.5 text-xs text-ring-teal">
                        {(card.evidenceImages || []).length} evidence image{(card.evidenceImages || []).length === 1 ? '' : 's'}
                      </span>
                    )}
                    
                    {card.price && (
                      <div className="text-sm mt-2 text-green-400">
                        <p>Recent Sale: ${card.price.toLocaleString()}</p>
                        {card.priceDate && <p className="text-xs text-ring-light">{card.priceDate}</p>}
                      </div>
                    )}

                    {card.grading && (
                      <div className="text-sm mt-2 text-blue-400">
                        <p>{card.grading.service} {card.grading.grade}</p>
                        {card.grading.dateGraded && <p className="text-xs text-ring-light">{card.grading.dateGraded}</p>}
                      </div>
                    )}
                    
                    {card.found && (
                      <div className="text-sm mt-2 text-ring-light">
                        <p>Found by: {card.foundBy}</p>
                        <p>Date: {card.dateFound}</p>
                        {card.link && (
                          <a href={card.link} target="_blank" rel="noopener noreferrer" className="text-ring-gold hover:underline">
                            View Source
                          </a>
                        )}
                      </div>
                    )}

                    <div className="mt-auto grid grid-cols-1 gap-2">
                        <Link
                          href={reportHref}
                          className="w-full rounded border border-ring-gold/60 px-4 py-2 text-center text-sm font-bold text-ring-gold transition-colors hover:border-yellow-400 hover:text-yellow-400"
                        >
                          {card.found ? 'Report an Update' : 'Report This Serial'}
                        </Link>
                      {serialEbayLink && (
                        <AffiliateOutboundLink
                          link={serialEbayLink}
                          trackerSlug={tracker.slug}
                          placement="tracker-card-serial"
                          className="w-full rounded border border-ring-gold/60 px-4 py-2 text-center text-sm font-bold text-ring-gold transition-colors hover:border-yellow-400 hover:text-yellow-400"
                        >
                          Search eBay
                        </AffiliateOutboundLink>
                      )}
                      <button
                        onClick={() => openCardDetails(card)}
                        className="w-full bg-ring-gold hover:bg-yellow-400 text-ring-dark font-bold py-2 px-4 rounded text-sm"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </article>
              );
                  })}
                </div>
              )}
            </section>
            <TrackerPagination {...pagination} onChange={changePage} position="bottom" />
          </>
        )}

        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={lightboxSlides}
          index={lightboxIndex}
        />

        <AffiliateLinks
          links={tracker.affiliateLinks}
          title={`${tracker.title} Marketplace Links`}
          trackerSlug={tracker.slug}
          placement="tracker-marketplace"
        />

        <div className="mt-6 w-full max-w-5xl"><TrackerMarketInsights tracker={tracker} /></div>
        <div className="mt-6 w-full max-w-5xl"><TrackerFaq tracker={tracker} /></div>
        <div className="mt-6 w-full max-w-5xl"><TrackerMarketTrustStrip summary={marketSummary} /><ReferenceLinks links={tracker.referenceLinks} compact /></div>
        <AdminPanel 
          tracker={tracker}
          cards={cards} 
          onPriceUpdate={handlePriceUpdate} 
          onImageUpdate={handleImageUpdate}
          onGradingUpdate={handleGradingUpdate}
          onPriceHistoryAdd={handlePriceHistoryAdd}
          onRefresh={fetchCards}
        />
        {selectedCardForDetails && (
          <CardDetails
            tracker={tracker}
            card={selectedCardForDetails}
            isOpen={!!selectedCardForDetails}
            onClose={closeCardDetails}
            onPrevious={filteredAndSortedCards.indexOf(selectedCardForDetails) > 0
              ? () => openCardDetails(filteredAndSortedCards[filteredAndSortedCards.indexOf(selectedCardForDetails) - 1], true) : undefined}
            onNext={filteredAndSortedCards.indexOf(selectedCardForDetails) >= 0 && filteredAndSortedCards.indexOf(selectedCardForDetails) < filteredAndSortedCards.length - 1
              ? () => openCardDetails(filteredAndSortedCards[filteredAndSortedCards.indexOf(selectedCardForDetails) + 1], true) : undefined}
          />
        )}
      </main>
    </>
  );
}

function CardSummarySection({
  rows,
  selectedCardSlug,
  onSelectCard,
}: {
  rows: CardSummaryRow[];
  selectedCardSlug: string;
  onSelectCard: (slug: string) => void;
}) {
  if (rows.length === 0) {
    return null;
  }

  const activeRows = rows.filter((row) => row.foundCount > 0 || row.pendingReportCount > 0);

  return (
    <details className="mb-4 w-full max-w-5xl" aria-label="Card activity summary">
      <summary className="cursor-pointer py-3 text-sm font-semibold text-ring-light">Card activity ({rows.length} cards)</summary>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ring-gold">Card Activity</h2>
        <button
          onClick={() => onSelectCard('all')}
          className={`rounded border px-3 py-1.5 text-xs font-bold transition-colors ${
            selectedCardSlug === 'all'
              ? 'border-ring-gold bg-ring-gold text-ring-dark'
              : 'border-ring-gold/40 text-ring-gold hover:bg-ring-gold hover:text-ring-dark'
          }`}
        >
          All Cards
        </button>
      </div>
      {activeRows.length === 0 && (
        <p className="rounded border border-ring-gold/20 bg-black/20 px-3 py-2 text-sm text-ring-light/70">
          No card-specific activity has been reviewed yet.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((row) => {
          const active = selectedCardSlug === row.slug;
          const foundPercentage = row.total > 0 ? (row.foundCount / row.total) * 100 : 0;

          return (
            <button
              key={row.slug}
              onClick={() => onSelectCard(row.slug)}
              className={`flex min-h-24 items-center gap-3 rounded border p-3 text-left transition-colors ${
                active
                  ? 'border-ring-gold bg-ring-gold/15'
                  : 'border-ring-gold/25 bg-black/20 hover:border-ring-gold'
              }`}
            >
              <div className="h-16 w-12 flex-none overflow-hidden rounded border border-ring-gold/20 bg-black/30">
                {row.referenceImage && (
                  <ExternalImage
                    src={row.referenceImage}
                    alt={row.title}
                    className="h-full w-full object-cover"
                    hideOnError
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ring-light">{row.title}</p>
                <p className="mt-1 text-xs text-ring-light/65">
                  {row.foundCount}/{row.total} located - {row.confirmedCount} confirmed
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded bg-ring-light/10">
                  <div
                    className="h-full rounded bg-ring-gold"
                    style={{ width: `${Math.min(100, foundPercentage)}%` }}
                  />
                </div>
                {row.pendingReportCount > 0 && (
                  <p className="mt-1 text-xs font-semibold text-ring-teal">
                    {row.pendingReportCount} pending
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </details>
  );
}

'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SerializedRingCard, GradingInfo, PriceHistoryEntry } from "@/lib/types";
import type { TrackerSummary } from '@/lib/trackers';
import Link from "next/link";
import {
  findTrackerCardByDeepLinkParams,
  formatTrackerCardLabel,
  getTrackerCardDeepLinkParams,
  getTrackerCardDefinitions,
} from '@/lib/tracker-data';
import AffiliateLinks from "@/components/AffiliateLinks";
import AffiliateDisclosureNotice from "@/components/AffiliateDisclosureNotice";
import PrimaryAffiliateCtas from '@/components/PrimaryAffiliateCtas';
import ReferenceLinks from '@/components/ReferenceLinks';
import ReportButton from '@/components/ReportButton';
import AdminPanel from '@/components/AdminPanel';
import ProgressBar from '@/components/ProgressBar';
import FilterControls from '@/components/FilterControls';
import CardDetails from '@/components/CardDetails';
import ExternalImage from '@/components/ExternalImage';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Head from 'next/head';
import { XMarkIcon } from '@heroicons/react/24/outline';

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

const VALID_STATUS_FILTERS = new Set([
  'all',
  'found',
  'pending',
  'confirmed',
  'source-linked',
  'has-evidence',
  'source-marketplace',
  'source-grading-pop',
  'source-social',
  'source-article',
  'source-private-sale',
  'source-other',
  'not-found',
]);

const VALID_SORT_ORDERS = new Set([
  'id-asc',
  'id-desc',
  'price-desc',
  'price-asc',
  'date-desc',
  'date-asc',
  'evidence-desc',
]);

const STATUS_FILTER_LABELS: Record<string, string> = {
  found: 'located serials',
  pending: 'pending reports',
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
  const viewStateInitializedRef = useRef(false);
  
  // State for lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // State for card details
  const [selectedCardForDetails, setSelectedCardForDetails] = useState<SerializedRingCard | null>(null);
  const [copyViewMessage, setCopyViewMessage] = useState('');
  const copyViewMessageTimeoutRef = useRef<number | null>(null);

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
  }, [cardDefinitions]);

  useEffect(() => {
    syncViewStateFromUrl();
    viewStateInitializedRef.current = true;

    window.addEventListener('popstate', syncViewStateFromUrl);

    return () => {
      window.removeEventListener('popstate', syncViewStateFromUrl);
      if (copyViewMessageTimeoutRef.current) {
        window.clearTimeout(copyViewMessageTimeoutRef.current);
      }
    };
  }, [syncViewStateFromUrl]);

  useEffect(() => {
    if (!viewStateInitializedRef.current) return;

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

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, '', nextUrl);
    }
  }, [cardFilter, searchQuery, sortOrder, statusFilter]);

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

  const openCardDetails = useCallback((card: SerializedRingCard) => {
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
    window.history.pushState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
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

      if (card?.cardSlug) {
        setCardFilter(card.cardSlug);
        setSearchQuery('');
      }
    };

    syncDetailsFromUrl();
    window.addEventListener('popstate', syncDetailsFromUrl);

    return () => {
      window.removeEventListener('popstate', syncDetailsFromUrl);
    };
  }, [cards, tracker]);

  const handlePriceUpdate = async (cardId: number, price: number) => {
    try {
      const response = await fetch(`${trackerApiBase}/update-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cardId, price }),
      });

      if (response.ok) {
        // Refresh the cards data
        fetchCards();
      }
    } catch (error) {
      console.error('Error updating price:', error);
    }
  };

  const handleImageUpdate = async (cardId: number, imageUrl: string) => {
    try {
      const response = await fetch(`${trackerApiBase}/update-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cardId, imageUrl }),
      });

      if (response.ok) {
        // Refresh the cards data
        fetchCards();
      }
    } catch (error) {
      console.error('Error updating image:', error);
    }
  };

  const handleGradingUpdate = async (cardId: number, grading: GradingInfo) => {
    try {
      const response = await fetch(`${trackerApiBase}/update-grading`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cardId, grading }),
      });

      if (response.ok) {
        // Refresh the cards data
        fetchCards();
      }
    } catch (error) {
      console.error('Error updating grading:', error);
    }
  };

  const handlePriceHistoryAdd = async (cardId: number, entry: PriceHistoryEntry) => {
    try {
      const response = await fetch(`${trackerApiBase}/add-price-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cardId, entry }),
      });

      if (response.ok) {
        // Refresh the cards data
        fetchCards();
      }
    } catch (error) {
      console.error('Error adding price history:', error);
    }
  };

  const filteredAndSortedCards = useMemo(() => {
    return cards
      .filter(card => {
        const matchesCard = cardFilter === 'all' || card.cardSlug === cardFilter;

        // Search query filter
        const normalizedSearch = searchQuery.trim().toLowerCase();
        const matchesSearch =
          normalizedSearch === '' ||
          card.serialNumber.includes(searchQuery.trim()) ||
          card.id.toString().includes(searchQuery.trim()) ||
          Boolean(card.cardTitle?.toLowerCase().includes(normalizedSearch));

        // Status filter
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'found' && card.found) ||
          (statusFilter === 'pending' && !card.found && (card.pendingReports || 0) > 0) ||
          (statusFilter === 'confirmed' && card.verificationStatus === 'confirmed') ||
          (statusFilter === 'source-linked' && card.verificationStatus === 'source-linked') ||
          (statusFilter === 'has-evidence' && (card.evidenceImages || []).length > 0) ||
          (statusFilter === 'source-marketplace' && card.sourceType === 'marketplace') ||
          (statusFilter === 'source-grading-pop' && card.sourceType === 'grading-pop') ||
          (statusFilter === 'source-social' && card.sourceType === 'social') ||
          (statusFilter === 'source-article' && card.sourceType === 'article') ||
          (statusFilter === 'source-private-sale' && card.sourceType === 'private-sale') ||
          (statusFilter === 'source-other' && card.sourceType === 'other') ||
          (statusFilter === 'not-found' && !card.found);

        return matchesCard && matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        switch (sortOrder) {
          case 'id-desc':
            return b.id - a.id;
          case 'price-asc':
            return (a.price ?? Infinity) - (b.price ?? Infinity);
          case 'price-desc':
            return (b.price ?? -1) - (a.price ?? -1);
          case 'date-asc':
            return new Date(a.dateFound ?? 0).getTime() - new Date(b.dateFound ?? 0).getTime();
          case 'date-desc':
            return new Date(b.dateFound ?? 0).getTime() - new Date(a.dateFound ?? 0).getTime();
          case 'evidence-desc':
            return (b.evidenceImages?.length || 0) - (a.evidenceImages?.length || 0) || a.id - b.id;
          case 'id-asc':
          default:
            return a.id - b.id;
        }
      });
  }, [cards, cardFilter, searchQuery, statusFilter, sortOrder]);

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
    return filteredAndSortedCards
      .map(card => card.image || referenceImage)
      .map(src => ({ src }));
  }, [filteredAndSortedCards, referenceImage]);
  const filteredQualitySummary = useMemo(() => {
    const locatedCount = filteredAndSortedCards.filter((card) => card.found).length;
    const confirmedInViewCount = filteredAndSortedCards.filter((card) => card.verificationStatus === 'confirmed').length;
    const evidenceBackedCount = filteredAndSortedCards.filter((card) => (card.evidenceImages || []).length > 0).length;

    return {
      locatedCount,
      confirmedInViewCount,
      evidenceBackedCount,
    };
  }, [filteredAndSortedCards]);

  const foundCards = cards.filter((card) => card.found);
  const confirmedCount = cards.filter((card) => card.verificationStatus === 'confirmed').length;
  const foundCount = foundCards.length;
  const totalCount = cards.length || tracker.total || 0;
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

  // Structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": `${tracker.title} Tracker`,
    "description": tracker.description,
    "url": `https://mtgtrackers.com${trackerPath}`,
    "applicationCategory": "EntertainmentApplication",
    "operatingSystem": "Web Browser",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="text-ring-gold text-xl">Loading...</div>
      </main>
    );
  }

  return (
    <>
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </Head>
      <main className="flex min-h-screen flex-col items-center p-8 md:p-12">
        <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
          <h1 className="text-2xl md:text-4xl font-bold text-ring-gold mb-4 lg:mb-0">
            {tracker.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/" className="text-ring-gold hover:text-yellow-400 transition-colors">
              Home
            </Link>
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

        <div className="w-full max-w-5xl mt-6 text-center bg-ring-dark bg-opacity-75 p-6 rounded-lg">
          <div className="mb-5 text-left">
            <AffiliateDisclosureNotice links={tracker.affiliateLinks} compact />
          </div>
          <PrimaryAffiliateCtas links={tracker.affiliateLinks} trackerSlug={tracker.slug} />
          <ProgressBar current={foundCount} total={totalCount} />
          <p className="text-ring-light mt-3 text-sm">
            Tracking {totalCount} {tracker.cardType || 'serialized cards'}{cardDefinitions.length > 1 ? ` across ${cardDefinitions.length} cards` : ''} from {tracker.setName || 'Magic: The Gathering'}. {confirmedCount} confirmed, {foundCount - confirmedCount} source-linked or unverified.
          </p>
          <ReferenceLinks links={tracker.referenceLinks} compact />
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
              by {lastFoundCard.foundBy} on {lastFoundCard.dateFound}
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
            />

            <div className="mt-3 flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 rounded border border-ring-gold/25 bg-ring-dark/70 px-4 py-3 text-sm text-ring-light">
              <p>
                Showing <span className="font-bold text-ring-gold">{filteredAndSortedCards.length}</span> of{' '}
                <span className="font-bold text-ring-gold">{totalCount}</span> serials
                {hasActiveViewFilters ? ` for ${activeViewSummary}` : ' in this tracker'}.
              </p>
              {pendingReportCount > 0 && (
                <p className="text-xs text-ring-light/70">
                  {pendingReportCount} pending report{pendingReportCount === 1 ? '' : 's'} awaiting review.
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
                    className="inline-flex min-h-9 items-center gap-2 rounded-full border border-ring-gold/40 bg-ring-dark/80 px-3 py-1 text-xs font-bold text-ring-light transition-colors hover:border-ring-gold hover:text-ring-gold focus:outline-none focus:ring-2 focus:ring-ring-gold focus:ring-offset-2 focus:ring-offset-ring-dark"
                  >
                    <span>{chip.label}</span>
                    <XMarkIcon className="h-4 w-4" aria-hidden="true" />
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
                  className="inline-flex min-h-9 items-center rounded-full border border-ring-gold/30 px-3 py-1 text-xs font-bold text-ring-gold transition-colors hover:border-yellow-400 hover:text-yellow-400 focus:outline-none focus:ring-2 focus:ring-ring-gold focus:ring-offset-2 focus:ring-offset-ring-dark"
                >
                  Clear All
                </button>
              </div>
            )}

            {hasActiveViewFilters && filteredAndSortedCards.length > 0 && (
              <div className="w-full max-w-5xl mt-4">
                <PrimaryAffiliateCtas
                  links={tracker.affiliateLinks}
                  trackerSlug={tracker.slug}
                  placement="tracker-filtered-cta"
                  title="Marketplace Links For This View"
                  description={`${filteredAndSortedCards.length} matching serial${filteredAndSortedCards.length === 1 ? '' : 's'}: ${activeViewSummary}.`}
                />
              </div>
            )}

            <section className="w-full max-w-5xl mt-8" aria-label={`${tracker.title} serialized cards`}>
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
                  {filteredAndSortedCards.map((card, index) => {
              const imageSrc = card.image || referenceImage;
              const statusLabel = card.found
                ? card.verificationStatus === 'confirmed'
                  ? 'Confirmed'
                  : 'Located'
                : (card.pendingReports || 0) > 0
                  ? 'Pending Review'
                : 'Not Found';
              
              return (
                <article key={card.id} className="border border-ring-gold rounded-lg p-4 bg-ring-dark shadow-[0_0_15px_rgba(214,167,61,0.5)] flex flex-col h-full">
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
                    {!card.found && (card.pendingReports || 0) > 0 && (
                      <span className="mt-2 inline-block rounded border border-ring-teal/40 px-2 py-0.5 text-xs text-ring-light">
                        {card.pendingReports} report{card.pendingReports === 1 ? '' : 's'}
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
                        {card.link && <a href={card.link} target="_blank" rel="noopener noreferrer" className="text-ring-gold hover:underline">{card.link.toLowerCase().includes('ebay') ? 'Buy on eBay' : 'Source'}</a>}
                      </div>
                    )}

                    {/* Details button */}
                    <button
                      onClick={() => openCardDetails(card)}
                      className="w-full mt-auto bg-ring-gold hover:bg-yellow-400 text-ring-dark font-bold py-2 px-4 rounded text-sm"
                    >
                      View Details
                    </button>
                  </div>
                </article>
              );
                  })}
                </div>
              )}
            </section>
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
    <section className="w-full max-w-5xl mt-8 rounded-lg border border-ring-gold/30 bg-ring-dark/75 p-4" aria-label="Card activity summary">
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
    </section>
  );
}

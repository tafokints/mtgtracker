'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { SerializedRingCard, GradingInfo, PriceHistoryEntry } from "@/lib/types";
import type { TrackerSummary } from '@/lib/trackers';
import Link from "next/link";
import AffiliateLinks from "@/components/AffiliateLinks";
import AffiliateDisclosureNotice from "@/components/AffiliateDisclosureNotice";
import ReportButton from '@/components/ReportButton';
import AdminPanel from '@/components/AdminPanel';
import ProgressBar from '@/components/ProgressBar';
import FilterControls from '@/components/FilterControls';
import CardDetails from '@/components/CardDetails';
import ExternalImage from '@/components/ExternalImage';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Head from 'next/head';

export default function TrackerPageClient({ tracker }: { tracker: TrackerSummary }) {
  const [cards, setCards] = useState<SerializedRingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const trackerPath = `/trackers/${tracker.slug}`;
  const trackerApiBase = `/api/trackers/${tracker.slug}`;
  const referenceImage = tracker.referenceImage || '/icon.svg';

  // State for filtering and sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('id-asc');
  
  // State for lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // State for card details
  const [selectedCardForDetails, setSelectedCardForDetails] = useState<SerializedRingCard | null>(null);

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
        // Search query filter
        const matchesSearch = card.serialNumber.includes(searchQuery.trim()) || card.id.toString().includes(searchQuery.trim());

        // Status filter
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'found' && card.found) ||
          (statusFilter === 'pending' && !card.found && (card.pendingReports || 0) > 0) ||
          (statusFilter === 'confirmed' && card.verificationStatus === 'confirmed') ||
          (statusFilter === 'source-linked' && card.verificationStatus === 'source-linked') ||
          (statusFilter === 'not-found' && !card.found);

        return matchesSearch && matchesStatus;
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
          case 'id-asc':
          default:
            return a.id - b.id;
        }
      });
  }, [cards, searchQuery, statusFilter, sortOrder]);

  const lightboxSlides = useMemo(() => {
    return filteredAndSortedCards
      .map(card => card.image || referenceImage)
      .map(src => ({ src }));
  }, [filteredAndSortedCards, referenceImage]);

  const foundCards = cards.filter((card) => card.found);
  const confirmedCount = cards.filter((card) => card.verificationStatus === 'confirmed').length;
  const foundCount = foundCards.length;
  const totalCount = cards.length || tracker.total || 0;
  const pendingReportCount = cards.reduce((total, card) => total + (card.pendingReports || 0), 0);

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
          <div className="flex items-center space-x-4">
            <Link href="/" className="text-ring-gold hover:text-yellow-400 transition-colors">
              Home
            </Link>
            <Link href={`${trackerPath}/stats`} className="text-ring-gold hover:text-yellow-400 transition-colors">
              Stats
            </Link>
            <ReportButton href={`${trackerPath}/submit`} />
          </div>
        </div>

        <div className="w-full max-w-5xl mt-6 text-center bg-ring-dark bg-opacity-75 p-6 rounded-lg">
          <div className="mb-5 text-left">
            <AffiliateDisclosureNotice links={tracker.affiliateLinks} compact />
          </div>
          <ProgressBar current={foundCount} total={totalCount} />
          <p className="text-ring-light mt-3 text-sm">
            Tracking {tracker.total || totalCount} {tracker.cardType || 'serialized cards'} from {tracker.setName || 'Magic: The Gathering'}. {confirmedCount} confirmed, {foundCount - confirmedCount} source-linked or unverified.
          </p>
          {dataError && (
            <p className="text-ring-light mt-4 text-sm">{dataError}</p>
          )}
          {lastFoundCard && (
            <p className="text-ring-light mt-4 text-sm">
              Last find: {lastFoundCard.serialNumber}/{tracker.total} by {lastFoundCard.foundBy} on {lastFoundCard.dateFound}
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
            <FilterControls
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
            />

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
                    aria-label={`View larger image of ${tracker.title} ${card.serialNumber}/${tracker.total}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setLightboxIndex(index);
                        setLightboxOpen(true);
                      }
                    }}
                  >
                    <ExternalImage
                      src={imageSrc}
                      alt={`${tracker.title} ${card.serialNumber}/${tracker.total} - ${card.name}`}
                      className="w-full h-full object-contain bg-black/20"
                      fallbackSrc={referenceImage}
                    />
                  </div>
                  
                  <h3 className="text-lg font-bold text-ring-gold tabular-nums">{card.serialNumber}/{tracker.total}</h3>
                  
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
                      onClick={() => setSelectedCardForDetails(card)}
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
            onClose={() => setSelectedCardForDetails(null)}
          />
        )}
      </main>
    </>
  );
}

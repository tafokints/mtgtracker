'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SerializedRingCard } from '../lib/types';
import { getSerialAffiliateLinks, type TrackerSummary } from '@/lib/trackers';
import { formatTrackerCardLabel, getTrackerCardDeepLinkParams } from '@/lib/tracker-data';
import AffiliateDisclosureNotice from '@/components/AffiliateDisclosureNotice';
import AffiliateOutboundLink from '@/components/AffiliateOutboundLink';
import ExternalImage from '@/components/ExternalImage';

interface CardDetailsProps {
  card: SerializedRingCard;
  tracker: TrackerSummary;
  isOpen: boolean;
  onClose: () => void;
}

export default function CardDetails({ card, tracker, isOpen, onClose }: CardDetailsProps) {
  const [copyMessage, setCopyMessage] = useState('');
  const copyMessageTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) return;

    setCopyMessage('');
    if (copyMessageTimeoutRef.current) {
      window.clearTimeout(copyMessageTimeoutRef.current);
      copyMessageTimeoutRef.current = null;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const serialLabel = formatTrackerCardLabel(tracker, card);
  const marketplaceLinks = getSerialAffiliateLinks(tracker, card);
  const reportParams = getTrackerCardDeepLinkParams(tracker, card);
  const reportHref = `${tracker.href}/submit?${reportParams.toString()}`;
  const evidenceCount = card.evidenceImages?.length || 0;
  const hasSourceLink = Boolean(card.link);
  const hasMarketData = Boolean(card.price || (card.priceHistory && card.priceHistory.length > 0));
  const hasGrading = Boolean(card.grading);
  const pendingReportCount = card.pendingReports || 0;
  const confidenceLabel = card.found
    ? card.verificationStatus === 'confirmed'
      ? 'High confidence'
      : card.verificationStatus === 'source-linked'
        ? 'Source-linked'
        : 'Needs corroboration'
    : pendingReportCount > 0
      ? 'Under review'
      : 'Unreported';
  const confidenceDetail = card.found
    ? card.verificationStatus === 'confirmed'
      ? 'An admin has confirmed this discovery from the available evidence.'
      : card.verificationStatus === 'source-linked'
        ? 'This discovery has at least one public source, but may still need stronger proof.'
        : 'This discovery is public, but still needs stronger evidence before it should be treated as confirmed.'
    : pendingReportCount > 0
      ? 'Community reports exist for this serial and are waiting for admin review.'
      : 'No reviewed discovery is attached to this serial yet.';
  const trustSignals = [
    {
      label: card.verificationStatus === 'confirmed' ? 'Admin confirmed' : `Verification: ${card.verificationStatus.replace('-', ' ')}`,
      active: card.verificationStatus === 'confirmed',
    },
    {
      label: hasSourceLink ? 'Public source linked' : 'No public source yet',
      active: hasSourceLink,
    },
    {
      label: evidenceCount > 0 ? `${evidenceCount} evidence image${evidenceCount === 1 ? '' : 's'} saved` : 'No saved evidence images',
      active: evidenceCount > 0,
    },
    {
      label: hasMarketData ? 'Sale data recorded' : 'No sale data recorded',
      active: hasMarketData,
    },
    {
      label: hasGrading ? 'Grading data recorded' : 'No grading data recorded',
      active: hasGrading,
    },
    {
      label: pendingReportCount > 0 ? `${pendingReportCount} pending report${pendingReportCount === 1 ? '' : 's'}` : 'No pending reports',
      active: pendingReportCount > 0,
    },
  ];
  const clearCopyMessageSoon = () => {
    if (copyMessageTimeoutRef.current) {
      window.clearTimeout(copyMessageTimeoutRef.current);
    }

    copyMessageTimeoutRef.current = window.setTimeout(() => {
      setCopyMessage('');
      copyMessageTimeoutRef.current = null;
    }, 1800);
  };
  const copyDetailLink = async () => {
    const href = window.location.href;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(href);
      } else {
        const input = document.createElement('input');
        input.value = href;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }

      setCopyMessage('Copied');
      clearCopyMessageSoon();
    } catch {
      setCopyMessage('Copy failed');
      clearCopyMessageSoon();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-ring-dark border border-ring-gold rounded-lg p-6 w-[min(90vw,42rem)] max-h-[90vh] overflow-y-auto divide-y divide-ring-gold/20">
        <div className="flex flex-wrap justify-between items-center pb-4 gap-4">
          <h2 className="text-xl font-bold text-ring-gold">
            {tracker.title} {serialLabel} Details
          </h2>
          <div className="flex items-center gap-2">
            {copyMessage && (
              <span className="text-xs font-bold text-ring-light/70" role="status">{copyMessage}</span>
            )}
            <button
              onClick={copyDetailLink}
              className="rounded border border-ring-gold/40 px-3 py-1.5 text-xs font-bold text-ring-gold transition-colors hover:border-ring-gold hover:bg-ring-gold hover:text-ring-dark"
            >
              Copy Link
            </button>
            <Link
              href={reportHref}
              className="rounded bg-ring-gold px-3 py-1.5 text-xs font-bold text-ring-dark transition-colors hover:bg-yellow-400"
            >
              Report This Serial
            </Link>
            <button
              onClick={onClose}
              className="text-ring-gold hover:text-yellow-400 rounded px-2 py-1"
              aria-label="Close details"
            >
              x
            </button>
          </div>
        </div>

        <div className="space-y-6 pt-4">
          <div>
            <h3 className="text-lg font-bold text-ring-gold mb-2">Basic Information</h3>
            <div className="bg-ring-light bg-opacity-20 p-4 rounded space-y-1">
              <p className="text-ring-light">
                <span className="font-bold">Status:</span> {card.found ? 'Located' : 'Not Found'}
              </p>
              {!card.found && (card.pendingReports || 0) > 0 && (
                <p className="text-ring-light">
                  <span className="font-bold">Pending reports:</span> {card.pendingReports}
                </p>
              )}
              <p className="text-ring-light">
                <span className="font-bold">Verification:</span> {card.verificationStatus.replace('-', ' ')}
              </p>
              {card.found && (
                <>
                  {card.foundBy && (
                    <p className="text-ring-light">
                      <span className="font-bold">Found by:</span> {card.foundBy}
                    </p>
                  )}
                  {card.dateFound && (
                    <p className="text-ring-light">
                      <span className="font-bold">Date found:</span> {card.dateFound}
                    </p>
                  )}
                  {card.sourceType && (
                    <p className="text-ring-light">
                      <span className="font-bold">Source type:</span> {card.sourceType.replace('-', ' ')}
                    </p>
                  )}
                  {card.link && (
                    <p className="text-ring-light">
                      <span className="font-bold">Source:</span>
                      <a href={card.link} target="_blank" rel="noopener noreferrer" className="text-ring-gold hover:underline ml-1">
                        {card.link.toLowerCase().includes('ebay') ? 'eBay' : 'View Source'}
                      </a>
                    </p>
                  )}
                </>
              )}
              {card.notes && (
                <p className="text-ring-light pt-2">
                  <span className="font-bold">Notes:</span> {card.notes}
                </p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-ring-gold mb-2">Verification Signals</h3>
            <div className="rounded bg-ring-light bg-opacity-20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-ring-light">{confidenceLabel}</p>
                  <p className="mt-1 max-w-xl text-sm text-ring-light/75">{confidenceDetail}</p>
                </div>
                <span
                  className={`rounded px-3 py-1 text-xs font-bold ${
                    card.verificationStatus === 'confirmed'
                      ? 'bg-green-800/50 text-green-300'
                      : pendingReportCount > 0
                        ? 'bg-ring-teal/20 text-ring-teal'
                        : 'bg-ring-gold/15 text-ring-gold'
                  }`}
                >
                  {card.found ? card.verificationStatus.replace('-', ' ') : pendingReportCount > 0 ? 'pending review' : 'not found'}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {trustSignals.map((signal) => (
                  <div
                    key={signal.label}
                    className={`rounded border px-3 py-2 text-sm ${
                      signal.active
                        ? 'border-ring-gold/40 bg-ring-gold/10 text-ring-light'
                        : 'border-ring-light/10 bg-black/20 text-ring-light/60'
                    }`}
                  >
                    {signal.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-ring-gold mb-2">Current Price</h3>
            <div className="bg-ring-light bg-opacity-20 p-4 rounded">
              {card.price ? (
                <>
                <p className="text-green-400 text-xl font-bold">
                  ${card.price.toLocaleString()}
                </p>
                {card.priceDate && (
                  <p className="text-ring-light text-sm">Last updated: {card.priceDate}</p>
                )}
                </>
              ) : (
                <p className="text-ring-light text-sm">No sale price has been recorded for this serial yet.</p>
              )}
            </div>
          </div>

          {marketplaceLinks.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-ring-gold mb-2">Marketplace Check</h3>
              <div className="bg-ring-light bg-opacity-20 p-4 rounded">
                <AffiliateDisclosureNotice links={marketplaceLinks} compact />
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {marketplaceLinks.slice(0, 3).map((link) => (
                    <AffiliateOutboundLink
                      key={`${link.merchant}-${link.href}`}
                      link={link}
                      trackerSlug={tracker.slug}
                      placement="serial-detail"
                      className="rounded border border-ring-gold/40 px-3 py-2 text-center text-xs font-bold text-ring-gold transition-colors hover:border-ring-gold hover:bg-ring-gold hover:text-ring-dark"
                    >
                      <span className="block capitalize">{link.merchant}</span>
                      <span className="mt-1 block font-normal uppercase opacity-75">{link.intent.replace('-', ' ')}</span>
                    </AffiliateOutboundLink>
                  ))}
                </div>
              </div>
            </div>
          )}

          {card.grading && (
            <div>
              <h3 className="text-lg font-bold text-ring-gold mb-2">Grading Information</h3>
              <div className="bg-ring-light bg-opacity-20 p-4 rounded">
                <p className="text-blue-400 text-lg font-bold">
                  {card.grading.service} {card.grading.grade}
                </p>
                {card.grading.dateGraded && (
                  <p className="text-ring-light text-sm">Graded on: {card.grading.dateGraded}</p>
                )}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-lg font-bold text-ring-gold mb-2">Price History</h3>
            <div className="bg-ring-light bg-opacity-20 p-4 rounded max-h-60 overflow-y-auto">
              {card.priceHistory && card.priceHistory.length > 0 ? (
                <div className="space-y-2">
                  {card.priceHistory.map((entry, index) => (
                    <div key={`${entry.date}-${index}`} className="border-b border-ring-gold border-opacity-30 pb-2 last:border-b-0">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <p className="text-green-400 font-bold">
                            ${entry.price.toLocaleString()}
                          </p>
                          <p className="text-ring-light text-sm">{entry.date}</p>
                        </div>
                        <div className="text-right text-xs text-ring-light">
                          {entry.soldBy && <p>From: {entry.soldBy}</p>}
                          {entry.soldTo && <p>To: {entry.soldTo}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-ring-light text-sm">No price history has been added yet.</p>
              )}
            </div>
          </div>

          {card.image && (
            <div>
              <h3 className="text-lg font-bold text-ring-gold mb-2">Card Image</h3>
              <div className="bg-ring-light bg-opacity-20 p-4 rounded">
                <ExternalImage
                  src={card.image}
                  alt={`${tracker.title} ${serialLabel}`}
                  className="w-full max-w-md mx-auto rounded"
                  fallbackSrc={tracker.referenceImage || '/icon.svg'}
                />
              </div>
            </div>
          )}

          {card.evidenceImages && card.evidenceImages.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-ring-gold mb-2">Evidence Images</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {card.evidenceImages.slice(0, 6).map((image, index) => (
                  <div key={`${image.url}-${index}`} className="bg-ring-light bg-opacity-20 p-3 rounded">
                    <a href={image.url} target="_blank" rel="noopener noreferrer" className="block">
                      <ExternalImage
                        src={image.url}
                        alt={image.caption || `${serialLabel} evidence ${index + 1}`}
                        className="aspect-[4/3] w-full rounded object-cover"
                        fallbackSrc={tracker.referenceImage || '/icon.svg'}
                      />
                    </a>
                    <div className="mt-2 space-y-1 text-xs text-ring-light">
                      <p>{image.caption || `Evidence ${index + 1}`}</p>
                      {image.sourceType && <p>Source type: {image.sourceType.replace('-', ' ')}</p>}
                      {image.sourceUrl && (
                        <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-ring-gold hover:underline">
                          View evidence source
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {card.evidenceImages.length > 6 && (
                <p className="mt-2 text-xs text-ring-light/70">
                  Showing 6 of {card.evidenceImages.length} saved evidence images.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

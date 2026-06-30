'use client';

import React from 'react';
import { SerializedRingCard } from '../lib/types';
import type { TrackerSummary } from '@/lib/trackers';

interface CardDetailsProps {
  card: SerializedRingCard;
  tracker: TrackerSummary;
  isOpen: boolean;
  onClose: () => void;
}

export default function CardDetails({ card, tracker, isOpen, onClose }: CardDetailsProps) {
  if (!isOpen) return null;

  const serialLabel = `${card.serialNumber}/${tracker.total}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-ring-dark border border-ring-gold rounded-lg p-6 w-[min(90vw,42rem)] max-h-[90vh] overflow-y-auto divide-y divide-ring-gold/20">
        <div className="flex justify-between items-center pb-4 gap-4">
          <h2 className="text-xl font-bold text-ring-gold">
            {tracker.title} {serialLabel} Details
          </h2>
          <button
            onClick={onClose}
            className="text-ring-gold hover:text-yellow-400 rounded px-2 py-1"
            aria-label="Close details"
          >
            x
          </button>
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

          {card.price && (
            <div>
              <h3 className="text-lg font-bold text-ring-gold mb-2">Current Price</h3>
              <div className="bg-ring-light bg-opacity-20 p-4 rounded">
                <p className="text-green-400 text-xl font-bold">
                  ${card.price.toLocaleString()}
                </p>
                {card.priceDate && (
                  <p className="text-ring-light text-sm">Last updated: {card.priceDate}</p>
                )}
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

          {card.priceHistory && card.priceHistory.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-ring-gold mb-2">Price History</h3>
              <div className="bg-ring-light bg-opacity-20 p-4 rounded max-h-60 overflow-y-auto">
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
              </div>
            </div>
          )}

          {card.image && (
            <div>
              <h3 className="text-lg font-bold text-ring-gold mb-2">Card Image</h3>
              <div className="bg-ring-light bg-opacity-20 p-4 rounded">
                <img
                  src={card.image}
                  alt={`${tracker.title} ${serialLabel}`}
                  className="w-full max-w-md mx-auto rounded"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

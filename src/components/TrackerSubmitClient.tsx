'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import type { TrackerSummary } from '@/lib/trackers';
import {
  formatTrackerSerial,
  getTrackerCardDefinitions,
  getTrackerCardSlot,
  getTrackerSlotId,
  getTrackerSlotIdFromDeepLinkParams,
  getTrackerTotalSlots,
} from '@/lib/tracker-data';
import { SourceType, VerificationStatus } from '@/lib/types';

const MAX_EVIDENCE_IMAGES = 8;

export default function TrackerSubmitClient({ tracker }: { tracker: TrackerSummary }) {
  const cardDefinitions = useMemo(() => getTrackerCardDefinitions(tracker), [tracker]);
  const hasMultipleCardDefinitions = cardDefinitions.length > 1;
  const [cardId, setCardId] = useState('');
  const [selectedCardSlug, setSelectedCardSlug] = useState(cardDefinitions[0]?.slug || '');
  const [selectedSerialId, setSelectedSerialId] = useState('');
  const [foundBy, setFoundBy] = useState('');
  const [dateFound, setDateFound] = useState('');
  const [link, setLink] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('marketplace');
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('source-linked');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [evidenceImageUrls, setEvidenceImageUrls] = useState('');
  const [uploadedEvidenceUrls, setUploadedEvidenceUrls] = useState<string[]>([]);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isError, setIsError] = useState(false);
  const trackerPath = `/trackers/${tracker.slug}`;
  const manualEvidenceUrlCount = useMemo(() => (
    evidenceImageUrls
      .split(/[\s,]+/)
      .map((url) => url.trim())
      .filter(Boolean).length
  ), [evidenceImageUrls]);
  const totalEvidenceImageCount = uploadedEvidenceUrls.length + manualEvidenceUrlCount;
  const evidenceLimitExceeded = totalEvidenceImageCount > MAX_EVIDENCE_IMAGES;
  const selectedSerialSummary = useMemo(() => {
    if (hasMultipleCardDefinitions) {
      const definition = cardDefinitions.find((candidate) => candidate.slug === selectedCardSlug);
      const serialId = Number(selectedSerialId);

      if (!definition || !Number.isInteger(serialId) || serialId < 1) return undefined;

      return `${definition.title} ${formatTrackerSerial(tracker, serialId, definition)}/${definition.total}`;
    }

    const serialId = Number(cardId);
    if (!Number.isInteger(serialId) || serialId < 1) return undefined;

    return `${tracker.title} ${formatTrackerSerial(tracker, serialId)}/${tracker.total}`;
  }, [cardDefinitions, cardId, hasMultipleCardDefinitions, selectedCardSlug, selectedSerialId, tracker]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slotId = getTrackerSlotIdFromDeepLinkParams(tracker, params);
    if (!slotId) return;

    const slot = getTrackerCardSlot(tracker, slotId);
    if (!slot) return;

    if (hasMultipleCardDefinitions) {
      setSelectedCardSlug(slot.cardSlug || cardDefinitions[0]?.slug || '');
      setSelectedSerialId(String(Number(slot.serialNumber)));
    } else {
      setCardId(String(slotId));
    }
  }, [cardDefinitions, hasMultipleCardDefinitions, tracker]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setErrors([]);
    setIsError(false);

    if (evidenceLimitExceeded) {
      setMessage('Too many evidence images.');
      setErrors([`Please submit no more than ${MAX_EVIDENCE_IMAGES} evidence images total.`]);
      setIsError(true);
      return;
    }

    const response = await fetch(`/api/trackers/${tracker.slug}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cardId: hasMultipleCardDefinitions
          ? getTrackerSlotId(tracker, selectedCardSlug, parseInt(selectedSerialId, 10)) || ''
          : cardId,
        foundBy,
        dateFound,
        link,
        sourceType,
        verificationStatus,
        price,
        imageUrl,
        evidenceImageUrls: [...uploadedEvidenceUrls, evidenceImageUrls].filter(Boolean).join('\n'),
        notes,
      }),
    });

    if (response.ok) {
      setMessage('Submission queued for review. Thank you!');
      setIsError(false);
      setCardId('');
      setSelectedCardSlug(cardDefinitions[0]?.slug || '');
      setSelectedSerialId('');
      setFoundBy('');
      setDateFound('');
      setLink('');
      setPrice('');
      setImageUrl('');
      setEvidenceImageUrls('');
      setUploadedEvidenceUrls([]);
      setUploadMessage('');
      setNotes('');
    } else {
      const data = await response.json().catch(() => null);
      setMessage(data?.message || 'Submission failed. Please check the serial and source details.');
      setErrors(Array.isArray(data?.errors) ? data.errors : []);
      setIsError(true);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (files.length === 0) return;

    setUploading(true);
    setUploadMessage(`Uploading ${files.length} image${files.length === 1 ? '' : 's'}...`);
    setErrors([]);
    setIsError(false);

    const uploadedUrls: string[] = [];
    const uploadErrors: string[] = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(`/api/trackers/${tracker.slug}/upload-image`, {
          method: 'POST',
          body: formData,
        });
        const data = await response.json().catch(() => null);

        if (response.ok && typeof data?.url === 'string') {
          uploadedUrls.push(data.url);
        } else {
          uploadErrors.push(`${file.name}: ${data?.message || 'upload failed'}`);
        }
      } catch {
        uploadErrors.push(`${file.name}: upload failed`);
      }
    }

    if (uploadedUrls.length > 0) {
      setUploadedEvidenceUrls((currentUrls) => [...currentUrls, ...uploadedUrls]);
    }

    if (uploadErrors.length > 0) {
      setErrors(uploadErrors);
      setIsError(true);
      setUploadMessage(`Uploaded ${uploadedUrls.length}/${files.length} image${files.length === 1 ? '' : 's'}.`);
    } else {
      setUploadMessage(`Uploaded ${uploadedUrls.length} image${uploadedUrls.length === 1 ? '' : 's'}.`);
    }

    setUploading(false);
  };

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Report a ${tracker.title} Find`,
    description: `Submit information about discovered serialized ${tracker.title} cards to help track all ${tracker.total} copies.`,
    url: `https://mtgtrackers.com${trackerPath}/submit`,
    mainEntity: {
      '@type': 'Form',
      name: `${tracker.title} Discovery Report`,
      description: `Form to report newly discovered serialized ${tracker.title} cards`,
    },
  };

  return (
    <>
      <Head>
        <title>Report a Find | {tracker.title} Tracker</title>
        <meta name="description" content={`Submit a discovered serialized ${tracker.title} card for admin review.`} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-2xl mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-ring-gold">Report a Find</h1>
            <p className="mt-2 text-sm text-ring-light/70">Reports are queued for admin review before they appear as located.</p>
          </div>
          <Link href={trackerPath} className="text-ring-gold hover:text-yellow-400 transition-colors">
            Back
          </Link>
        </div>
        <form onSubmit={handleSubmit} className="w-full max-w-2xl bg-ring-dark p-8 rounded-lg border border-ring-gold">
          {selectedSerialSummary && (
            <div className="mb-6 rounded border border-ring-gold/30 bg-black/20 px-4 py-3 text-sm text-ring-light">
              <p className="text-xs font-bold uppercase text-ring-gold">Reporting selected serial</p>
              <p className="mt-1 font-bold">{selectedSerialSummary}</p>
              <p className="mt-1 text-xs text-ring-light/70">
                Change the card or serial below if this is not the discovery you meant to report.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block uppercase tracking-wide text-ring-gold text-xs font-bold mb-2" htmlFor="serial">
                {hasMultipleCardDefinitions ? 'Card' : 'Serial Number'}
              </label>
              {hasMultipleCardDefinitions ? (
                <select
                  className="block w-full bg-ring-light border border-ring-gold text-ring-dark py-3 px-4 rounded leading-tight focus:outline-none focus:bg-white"
                  id="serial"
                  value={selectedCardSlug}
                  onChange={(e) => {
                    setSelectedCardSlug(e.target.value);
                    setSelectedSerialId('');
                  }}
                  required
                >
                  {cardDefinitions.map((definition) => (
                    <option key={definition.slug} value={definition.slug}>
                      {definition.title}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  className="block w-full bg-ring-light border border-ring-gold text-ring-dark py-3 px-4 rounded leading-tight focus:outline-none focus:bg-white"
                  id="serial"
                  value={cardId}
                  onChange={(e) => setCardId(e.target.value)}
                  required
                >
                  <option value="">Select a serial</option>
                  {Array.from({ length: tracker.total }, (_, i) => i + 1).map((id) => (
                    <option key={id} value={id}>
                      {tracker.title} {formatTrackerSerial(tracker, id)}/{tracker.total}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {hasMultipleCardDefinitions && (
              <div>
                <label className="block uppercase tracking-wide text-ring-gold text-xs font-bold mb-2" htmlFor="serial-number">
                  Serial Number
                </label>
                <select
                  className="block w-full bg-ring-light border border-ring-gold text-ring-dark py-3 px-4 rounded leading-tight focus:outline-none focus:bg-white"
                  id="serial-number"
                  value={selectedSerialId}
                  onChange={(e) => setSelectedSerialId(e.target.value)}
                  required
                >
                  <option value="">Select a serial</option>
                  {Array.from({
                    length: cardDefinitions.find((definition) => definition.slug === selectedCardSlug)?.total || 0,
                  }, (_, i) => i + 1).map((id) => {
                    const definition = cardDefinitions.find((candidate) => candidate.slug === selectedCardSlug);
                    if (!definition) return null;

                    return (
                      <option key={id} value={id}>
                        {formatTrackerSerial(tracker, id, definition)}/{definition.total}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            <div>
              <label className="block uppercase tracking-wide text-ring-gold text-xs font-bold mb-2" htmlFor="found-by">
                Found By
              </label>
              <input
                className="appearance-none block w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white"
                id="found-by"
                type="text"
                value={foundBy}
                onChange={(e) => setFoundBy(e.target.value)}
              />
            </div>
            <div>
              <label className="block uppercase tracking-wide text-ring-gold text-xs font-bold mb-2" htmlFor="date-found">
                Date Found
              </label>
              <input
                className="appearance-none block w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white"
                id="date-found"
                type="date"
                value={dateFound}
                onChange={(e) => setDateFound(e.target.value)}
              />
            </div>
            <div>
              <label className="block uppercase tracking-wide text-ring-gold text-xs font-bold mb-2" htmlFor="price">
                Sale Price
              </label>
              <input
                className="appearance-none block w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white"
                id="price"
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div>
              <label className="block uppercase tracking-wide text-ring-gold text-xs font-bold mb-2" htmlFor="source-type">
                Source Type
              </label>
              <select
                className="block w-full bg-ring-light border border-ring-gold text-ring-dark py-3 px-4 rounded leading-tight focus:outline-none focus:bg-white"
                id="source-type"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as SourceType)}
              >
                <option value="marketplace">Marketplace</option>
                <option value="grading-pop">Grading Pop</option>
                <option value="social">Social Post</option>
                <option value="article">Article</option>
                <option value="private-sale">Private Sale</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block uppercase tracking-wide text-ring-gold text-xs font-bold mb-2" htmlFor="verification">
                Evidence Level
              </label>
              <select
                className="block w-full bg-ring-light border border-ring-gold text-ring-dark py-3 px-4 rounded leading-tight focus:outline-none focus:bg-white"
                id="verification"
                value={verificationStatus}
                onChange={(e) => setVerificationStatus(e.target.value as VerificationStatus)}
              >
                <option value="source-linked">Source Linked</option>
                <option value="confirmed">Looks Confirmed</option>
                <option value="unverified">Unverified</option>
              </select>
            </div>
          </div>
          <div className="mt-6">
            <label className="block uppercase tracking-wide text-ring-gold text-xs font-bold mb-2" htmlFor="link">
              Source Link
            </label>
            <input
              className="appearance-none block w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white"
              id="link"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </div>
          <div className="mt-6">
              <label className="block uppercase tracking-wide text-ring-gold text-xs font-bold mb-2" htmlFor="image-url">
              Primary Image URL
            </label>
            <input
              className="appearance-none block w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white"
              id="image-url"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>
          <div className="mt-6">
            <label className="block uppercase tracking-wide text-ring-gold text-xs font-bold mb-2" htmlFor="evidence-image-urls">
              Additional Evidence Image URLs
            </label>
            <textarea
              className="appearance-none block w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white"
              id="evidence-image-urls"
              rows={3}
              placeholder="One URL per line"
              value={evidenceImageUrls}
              onChange={(e) => setEvidenceImageUrls(e.target.value)}
            />
          </div>
          <div className="mt-6">
            <label className="block uppercase tracking-wide text-ring-gold text-xs font-bold mb-2" htmlFor="evidence-image-upload">
              Upload Evidence Images
            </label>
            <input
              className="block w-full rounded border border-ring-gold bg-ring-light px-4 py-3 text-ring-dark file:mr-4 file:rounded file:border-0 file:bg-ring-gold file:px-3 file:py-2 file:font-bold file:text-ring-dark"
              id="evidence-image-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleImageUpload}
              disabled={uploading}
            />
            <p className="mt-2 text-xs text-ring-light/70">
              JPEG, PNG, or WebP. Max 4 MB per image.
            </p>
            {uploadMessage && (
              <p className="mt-2 text-sm text-ring-light">{uploadMessage}</p>
            )}
            <p className={`mt-2 text-xs ${evidenceLimitExceeded ? 'text-red-300' : 'text-ring-light/70'}`}>
              Evidence images queued: {totalEvidenceImageCount}/{MAX_EVIDENCE_IMAGES}
            </p>
            {uploadedEvidenceUrls.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-ring-light">
                {uploadedEvidenceUrls.map((url) => (
                  <li key={url} className="flex items-start justify-between gap-3">
                    <span className="min-w-0 break-all">
                      Uploaded: <a href={url} target="_blank" rel="noopener noreferrer" className="text-ring-gold hover:underline">{url}</a>
                    </span>
                    <button
                      type="button"
                      onClick={() => setUploadedEvidenceUrls((currentUrls) => currentUrls.filter((currentUrl) => currentUrl !== url))}
                      className="shrink-0 text-ring-gold underline-offset-4 hover:text-yellow-400 hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-6">
            <label className="block uppercase tracking-wide text-ring-gold text-xs font-bold mb-2" htmlFor="notes">
              Notes
            </label>
            <textarea
              className="appearance-none block w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white"
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <button
            className="mt-6 bg-ring-gold hover:bg-yellow-400 disabled:cursor-not-allowed disabled:bg-ring-light/40 text-ring-dark font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            type="submit"
            disabled={uploading || evidenceLimitExceeded}
          >
            {uploading ? 'Uploading...' : 'Submit'}
          </button>
          {message && <p className={`mt-4 text-center ${isError ? 'text-red-500' : 'text-green-400'}`}>{message}</p>}
          {errors.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-300">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </form>
        {hasMultipleCardDefinitions && (
          <p className="mt-4 max-w-2xl text-center text-xs text-ring-light/60">
            This tracker has {getTrackerTotalSlots(tracker)} serial slots across {cardDefinitions.length} cards.
          </p>
        )}
      </main>
    </>
  );
}

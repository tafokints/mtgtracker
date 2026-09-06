'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import ExternalImage from '@/components/ExternalImage';
import SubmissionChallenge from '@/components/SubmissionChallenge';
import Link from 'next/link';
import type { TrackerSummary } from '@/lib/trackers';
import {
  formatTrackerSerial,
  getTrackerCardDefinitions,
  getTrackerCardDeepLinkParams,
  getTrackerCardSlot,
  getTrackerSlotId,
  getTrackerSlotIdFromDeepLinkParams,
  getTrackerTotalSlots,
} from '@/lib/tracker-data';
import { ReportKind, SourceType, VerificationStatus } from '@/lib/types';

const MAX_EVIDENCE_IMAGES = 8;

const sourceTypeLabels: Record<SourceType, string> = {
  marketplace: 'marketplace listing or sale',
  'grading-pop': 'grading population source',
  social: 'social post',
  article: 'article or guide',
  'private-sale': 'private sale note',
  other: 'other source',
};

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
  const [kind, setKind] = useState<ReportKind>('discovery');
  const [priceKind, setPriceKind] = useState('unknown');
  const [currency, setCurrency] = useState('USD');
  const [priceDate, setPriceDate] = useState('');
  const [gradingService, setGradingService] = useState('');
  const [grade, setGrade] = useState('');
  const [dateGraded, setDateGraded] = useState('');
  const [certificateNumber, setCertificateNumber] = useState('');
  const [followUpPath, setFollowUpPath] = useState('');
  const [completedReport, setCompletedReport] = useState<{ label: string; href: string }>();
  const receiptHeadingRef = useRef<HTMLHeadingElement>(null);
  const [uploadedEvidence, setUploadedEvidence] = useState<Array<{ id: string; preview: string; status: string }>>([]);
  const previews = useRef(new Set<string>());
  const session = useRef<{ token: string; expiresAt: number; cardId: number }>();
  const [turnstileToken, setTurnstileToken] = useState('');
  const [challengeVersion, setChallengeVersion] = useState(0);
  const [consent, setConsent] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isError, setIsError] = useState(false);
  const trackerPath = `/trackers/${tracker.slug}`;
  const totalEvidenceImageCount = uploadedEvidence.length;
  const evidenceLimitExceeded = totalEvidenceImageCount > MAX_EVIDENCE_IMAGES;
  const hasSourceLink = link.trim().length > 0;
  const hasEvidenceImage = totalEvidenceImageCount > 0;
  const hasReviewNotes = notes.trim().length > 0;
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
  const evidenceChecklist = [
    {
      label: hasMultipleCardDefinitions ? 'Card and serial selected' : 'Serial selected',
      done: Boolean(selectedSerialSummary),
      detail: hasMultipleCardDefinitions
        ? 'Choose the exact card name and stamped number.'
        : 'Choose the stamped serial number.',
    },
    {
      label: 'Source or evidence image added',
      done: hasSourceLink || hasEvidenceImage,
      detail: 'Use a public listing, grading page, social post, article, or clear image.',
    },
    {
      label: 'Serial stamp is visible',
      done: hasEvidenceImage,
      detail: 'Images should show the card face and stamped serial when possible.',
    },
    {
      label: 'Review context included',
      done: hasReviewNotes || hasSourceLink,
      detail: `Mention why the ${sourceTypeLabels[sourceType]} looks credible.`,
    },
  ];
  const evidenceChecklistPassed = evidenceChecklist.filter((item) => item.done).length;
  const evidenceChecklistSummary = evidenceChecklistPassed >= evidenceChecklist.length
    ? 'Strong report'
    : evidenceChecklistPassed >= 2
      ? 'Reviewable report'
      : 'Needs more evidence';

  const selectedSlotId = hasMultipleCardDefinitions ? getTrackerSlotId(tracker, selectedCardSlug, Number(selectedSerialId)) : Number(cardId);
  useEffect(() => {
    session.current = undefined;
    setUploadedEvidence([]);
    for (const preview of previews.current) URL.revokeObjectURL(preview);
    previews.current.clear();
  }, [selectedSlotId]);
  useEffect(() => {
    const current = previews.current;
    return () => { for (const preview of current) URL.revokeObjectURL(preview); };
  }, []);
  useEffect(() => {
    if (completedReport) {
      window.scrollTo(0, 0);
      receiptHeadingRef.current?.focus();
    }
  }, [completedReport]);

  async function ensureSession() {
    if (!consent) throw new Error('Please confirm permission to submit this evidence.');
    if (!selectedSlotId) throw new Error('Select a card and serial first.');
    if (session.current?.cardId === selectedSlotId && session.current.expiresAt > Date.now()) return session.current.token;
    if (uploadedEvidence.length) throw new Error('This report permission expired. Remove its attachments and upload them again after verification.');
    if (!turnstileToken) throw new Error('Complete the verification check first.');
    try {
      const response = await fetch(`/api/trackers/${tracker.slug}/submission-session`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: selectedSlotId, turnstileToken, consent: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Verification failed.');
      session.current = { ...data, cardId: selectedSlotId };
      return data.token as string;
    } finally {
      // Verification may have consumed the token even if its response never reached us.
      setTurnstileToken('');
      setChallengeVersion((version) => version + 1);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('kind') === 'sighting' || params.get('kind') === 'correction') setKind(params.get('kind') as ReportKind);
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
    if (submitLock.current || uploading) return;
    setMessage('');
    setErrors([]);
    setIsError(false);

    if (evidenceLimitExceeded) {
      setMessage('Too many evidence images.');
      setErrors([`Please submit no more than ${MAX_EVIDENCE_IMAGES} evidence images total.`]);
      setIsError(true);
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    try {
      const token = await ensureSession();
      const response = await fetch(`/api/trackers/${tracker.slug}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-submission-token': token,
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
        kind, priceKind, currency: price ? currency : undefined, priceDate,
        grading: gradingService ? { service: gradingService, grade: Number(grade), dateGraded: dateGraded || undefined, certificateNumber: certificateNumber || undefined } : undefined,
        evidenceAssetIds: uploadedEvidence.map((asset) => asset.id),
        notes,
      }),
      });

    if (response.ok) {
      const receipt = await response.json();
      setFollowUpPath(receipt.followUpPath || '');
      const slot = getTrackerCardSlot(tracker, selectedSlotId || 0);
      setCompletedReport({ label: selectedSerialSummary || tracker.title,
        href: slot ? `${trackerPath}?${getTrackerCardDeepLinkParams(tracker, slot)}` : trackerPath });
      setMessage('Submission queued for review. Thank you!');
      setIsError(false);
      setCardId('');
      setSelectedCardSlug(cardDefinitions[0]?.slug || '');
      setSelectedSerialId('');
      setFoundBy('');
      setDateFound('');
      setLink('');
      setPrice('');
      setPriceDate('');
      setGradingService('');
      setGrade('');
      setDateGraded('');
      setCertificateNumber('');
      setUploadedEvidence([]);
      session.current = undefined;
      setUploadMessage('');
      setNotes('');
      setConsent(false);
      setTurnstileToken('');
      setChallengeVersion((version) => version + 1);
    } else {
      const data = await response.json().catch(() => null);
      setMessage(data?.message || 'Submission failed. Please check the serial and source details.');
      setErrors(Array.isArray(data?.errors) ? data.errors : []);
      setIsError(true);
    }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not confirm submission. Your report is still here.');
      setIsError(true);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (files.length === 0) return;
    if (uploading || submitting) return;
    if (files.length + totalEvidenceImageCount > MAX_EVIDENCE_IMAGES) {
      setErrors([`A report can contain up to ${MAX_EVIDENCE_IMAGES} images. Remove an image before adding more.`]);
      setIsError(true);
      return;
    }

    setUploading(true);
    setUploadMessage(`Uploading ${files.length} image${files.length === 1 ? '' : 's'}...`);
    setErrors([]);
    setIsError(false);

    const uploaded: typeof uploadedEvidence = [];
    const uploadErrors: string[] = [];

    let token: string;
    try { token = await ensureSession(); } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Verification failed.']);
      setIsError(true);
      setUploading(false);
      setUploadMessage('');
      return;
    }

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(`/api/trackers/${tracker.slug}/upload-image`, {
          method: 'POST',
          headers: { 'x-submission-token': token },
          body: formData,
        });
        const data = await response.json().catch(() => null);

        if (response.ok && typeof data?.assetId === 'string') {
          const preview = URL.createObjectURL(file);
          previews.current.add(preview);
          uploaded.push({ id: data.assetId, preview, status: data.safetyStatus });
        } else {
          uploadErrors.push(`${file.name}: ${data?.message || 'upload failed'}`);
        }
      } catch {
        uploadErrors.push(`${file.name}: upload failed`);
      }
    }

    if (uploaded.length > 0) {
      setUploadedEvidence((current) => [...current, ...uploaded]);
    }

    if (uploadErrors.length > 0) {
      setErrors(uploadErrors);
      setIsError(true);
      setUploadMessage(`Uploaded ${uploaded.length}/${files.length} image${files.length === 1 ? '' : 's'} privately.`);
    } else {
      setUploadMessage(`Uploaded ${uploaded.length} image${uploaded.length === 1 ? '' : 's'} privately.`);
    }

    setUploading(false);
  };

  if (completedReport) return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-12 sm:px-8">
      <CheckCircleIcon className="mb-4 h-10 w-10 text-ring-teal" aria-hidden="true" />
      <h1 ref={receiptHeadingRef} tabIndex={-1} className="text-2xl font-bold text-ring-gold">Report queued</h1>
      <p className="mt-3 break-words text-lg text-ring-light">{completedReport.label}</p>
      <p className="mt-3 text-sm text-ring-light/75">Awaiting admin review. This is a potential find, not a confirmed discovery. Uploaded evidence stays private until safety checks and approval are complete.</p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {followUpPath && <a href={followUpPath} className="rounded bg-ring-gold px-4 py-3 font-semibold text-ring-dark">View private report status</a>}
        <Link href={completedReport.href} className="inline-flex items-center gap-2 py-3 text-ring-teal"><ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />Back to serial</Link>
      </div>
      <button type="button" onClick={() => { setCompletedReport(undefined); setFollowUpPath(''); setMessage(''); setKind('discovery'); }} className="mt-6 rounded border border-ring-gold/40 px-4 py-2 text-sm text-ring-gold">Report another find</button>
    </main>
  );

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:px-8">
        <div className="w-full max-w-2xl mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-ring-gold">Report a Find</h1>
            <p className="mt-2 text-sm text-ring-light/70">Reports are queued for admin review before they appear as located.</p>
          </div>
          <Link href={`${trackerPath}#serials`} className="inline-flex items-center gap-2 text-ring-gold hover:text-yellow-400 transition-colors">
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />Back to tracker
          </Link>
        </div>
        <form onSubmit={handleSubmit} className="w-full max-w-2xl bg-ring-dark p-4 sm:p-8 rounded-lg border border-ring-gold">
          <label className="mb-4 block text-sm text-ring-gold">Report type
            <select value={kind} onChange={(event) => setKind(event.target.value as ReportKind)} className="mt-2 block w-full rounded p-3 text-ring-dark bg-ring-light">
              <option value="discovery">New discovery</option><option value="sighting">Later sighting or update</option><option value="correction">Correction to recorded facts</option>
            </select>
          </label>
          {selectedSerialSummary && (
            <div className="mb-6 rounded border border-ring-gold/30 bg-black/20 px-4 py-3 text-sm text-ring-light">
              <p className="text-xs font-bold uppercase text-ring-gold">Reporting selected serial</p>
              <p className="mt-1 font-bold">{selectedSerialSummary}</p>
              <p className="mt-1 text-xs text-ring-light/70">
                Change the card or serial below if this is not the discovery you meant to report.
              </p>
            </div>
          )}
          <section className="mb-6 rounded border border-ring-gold/30 bg-black/20 p-4" aria-label="Evidence quality checklist">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-ring-gold">Evidence Quality Checklist</h2>
                <p className="mt-1 text-xs text-ring-light/70">
                  Better evidence helps admins approve new discoveries faster and keeps public counts trustworthy.
                </p>
                <Link
                  href="/verification-guide"
                  className="mt-2 inline-flex text-xs font-bold text-ring-gold underline-offset-4 hover:text-yellow-400 hover:underline"
                >
                  Read the verification guide
                </Link>
              </div>
              <div className="rounded border border-ring-gold/30 px-3 py-1 text-xs font-bold text-ring-gold">
                {evidenceChecklistPassed}/{evidenceChecklist.length} {evidenceChecklistSummary}
              </div>
            </div>
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {evidenceChecklist.map((item) => (
                <li key={item.label} className="rounded border border-ring-gold/20 bg-ring-dark/70 p-3">
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${item.done ? 'bg-green-500/20 text-green-200' : 'bg-ring-light/10 text-ring-light/70'}`}>
                      {item.done ? 'Done' : 'Needed'}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-ring-light">{item.label}</p>
                      <p className="mt-1 text-xs text-ring-light/60">{item.detail}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block uppercase tracking-wide text-ring-gold text-xs font-bold mb-2" htmlFor="serial">
                {hasMultipleCardDefinitions ? 'Card' : 'Serial Number'}
              </label>
              {hasMultipleCardDefinitions ? (
                <select
                  className="block w-full bg-ring-light border border-ring-gold text-ring-dark py-3 px-4 rounded leading-tight focus:outline-none focus:bg-white"
                  id="serial"
                  disabled={uploading || submitting}
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
                  disabled={uploading || submitting}
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
                  disabled={uploading || submitting}
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
                Discoverer (optional)
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
                Price observation (optional)
              </label>
              <input
                className="appearance-none block w-full bg-ring-light text-ring-dark border border-ring-gold rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white"
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            {price !== '' && <fieldset className="grid min-w-0 gap-3 sm:grid-cols-3">
              <label className="text-sm text-ring-gold">Price type<select value={priceKind} onChange={(event) => setPriceKind(event.target.value)} className="mt-1 block w-full rounded p-2 text-ring-dark bg-ring-light"><option value="unknown">Unclassified</option><option value="asking-price">Asking price</option><option value="completed-sale">Completed sale</option></select></label>
              <label className="text-sm text-ring-gold">Currency<select value={currency} onChange={(event) => setCurrency(event.target.value)} className="mt-1 block w-full rounded p-2 text-ring-dark bg-ring-light">{['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].map((code) => <option key={code}>{code}</option>)}</select></label>
              <label className="min-w-0 text-sm text-ring-gold">Price date<input type="date" value={priceDate} required={priceKind !== 'unknown'} onChange={(event) => setPriceDate(event.target.value)} className="mt-1 block min-w-0 w-full rounded p-2 text-ring-dark bg-ring-light" /></label>
            </fieldset>}
            <details className="text-sm text-ring-gold">
              <summary className="cursor-pointer py-2">Grading observation (optional)</summary>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label>Grading service<input value={gradingService} maxLength={80} onChange={(event) => setGradingService(event.target.value)} className="mt-1 block w-full rounded p-2 text-ring-dark bg-ring-light" /></label>
                <label>Grade<input type="number" min="0" max="10" step="0.5" required={Boolean(gradingService)} value={grade} onChange={(event) => setGrade(event.target.value)} className="mt-1 block w-full rounded p-2 text-ring-dark bg-ring-light" /></label>
                <label>Grading date<input type="date" value={dateGraded} onChange={(event) => setDateGraded(event.target.value)} className="mt-1 block w-full rounded p-2 text-ring-dark bg-ring-light" /></label>
                <label>Certificate number<input value={certificateNumber} maxLength={100} onChange={(event) => setCertificateNumber(event.target.value)} className="mt-1 block w-full rounded p-2 text-ring-dark bg-ring-light" /></label>
              </div>
            </details>
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
              <p className="mt-2 text-xs text-ring-light/70">
                Use Looks Confirmed only when you can include a source link or evidence image.
              </p>
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
          <div className="mt-6 space-y-3">
            <label className="flex items-start gap-3 text-sm text-ring-light">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1" required />
              <span>I have permission to submit this evidence for safety checks and admin review. Approved evidence may be published. <Link href="/privacy" className="text-ring-gold underline">Privacy details</Link></span>
            </label>
            <SubmissionChallenge resetVersion={challengeVersion} onToken={setTurnstileToken} />
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
              disabled={uploading || submitting || !consent || !selectedSlotId || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
            />
            <p className="mt-2 text-xs text-ring-light/70">
              JPEG, PNG, or WebP. Max 4 MB per image.
            </p>
            <p className="mt-2 text-xs text-ring-light/70">
              Evidence remains private until safety checks and admin approval. Do not include private information.
            </p>
            {uploadMessage && (
              <p className="mt-2 text-sm text-ring-light">{uploadMessage}</p>
            )}
            <p className={`mt-2 text-xs ${evidenceLimitExceeded ? 'text-red-300' : 'text-ring-light/70'}`}>
              Evidence images queued: {totalEvidenceImageCount}/{MAX_EVIDENCE_IMAGES}
            </p>
            {uploadedEvidence.length > 0 && (
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {uploadedEvidence.map((asset, index) => (
                  <li key={asset.id} className="relative min-w-0">
                    <ExternalImage src={asset.preview} alt={`Uploaded evidence ${index + 1}`} className="aspect-[3/4] w-full rounded border border-ring-light/30 object-contain" />
                    <p className="mt-1 text-xs text-ring-light/70">{asset.status === 'clean' ? 'Ready for review' : asset.status === 'flagged' ? 'Held by safety checks' : 'Awaiting safety checks'}</p>
                    <button
                      type="button"
                      disabled={submitting}
                      aria-label={`Remove evidence ${index + 1} from report`}
                      title="Remove from report"
                      onClick={() => {
                        URL.revokeObjectURL(asset.preview);
                        previews.current.delete(asset.preview);
                        setUploadedEvidence((current) => current.filter((item) => item.id !== asset.id));
                      }}
                      className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded border border-ring-light/50 bg-ring-dark text-ring-light"
                    >
                      <XMarkIcon className="h-5 w-5" />
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
            disabled={uploading || submitting || evidenceLimitExceeded || !consent || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
          >
            {uploading ? 'Uploading...' : submitting ? 'Submitting...' : 'Submit'}
          </button>
          {message && <p className={`mt-4 text-center ${isError ? 'text-red-500' : 'text-green-400'}`}>{message}</p>}
          {followUpPath && <a href={followUpPath} className="mt-3 block text-center text-ring-gold underline">Private report status and follow-up</a>}
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

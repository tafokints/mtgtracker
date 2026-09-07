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
} from '@/lib/tracker-data';
import { EVIDENCE_ID, MAX_EVIDENCE_IMAGES, normalizeSourceUrl } from '@/lib/evidence-policy';
import { evidenceFileError, inferReportSourceType } from '@/lib/submission-form';
import type { ReportKind, SourceType } from '@/lib/types';

interface ReportAttachment {
  key: string;
  file: File;
  preview: string;
  assetId?: string;
  status?: string;
}

const inputClass = 'mt-2 block w-full min-w-0 rounded border border-ring-gold/40 bg-ring-light px-3 py-3 text-ring-dark focus:outline-none focus:ring-2 focus:ring-ring-teal';
const labelClass = 'block min-w-0 text-sm font-semibold text-ring-light';

export default function TrackerSubmitClient({ tracker }: { tracker: TrackerSummary }) {
  const cardDefinitions = useMemo(() => getTrackerCardDefinitions(tracker), [tracker]);
  const hasMultipleCardDefinitions = cardDefinitions.length > 1;
  const [selectedCardSlug, setSelectedCardSlug] = useState(cardDefinitions[0]?.slug || '');
  const [serial, setSerial] = useState(cardDefinitions[0]?.total === 1 ? '1' : '');
  const [foundBy, setFoundBy] = useState('');
  const [dateFound, setDateFound] = useState('');
  const [link, setLink] = useState('');
  const [sourceType, setSourceType] = useState<SourceType | 'auto'>('auto');
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
  const errorRef = useRef<HTMLDivElement>(null);
  const [attachments, setAttachments] = useState<ReportAttachment[]>([]);
  const previews = useRef(new Set<string>());
  const session = useRef<{ token: string; expiresAt: number; cardId: number }>();
  const [turnstileToken, setTurnstileToken] = useState('');
  const [challengeVersion, setChallengeVersion] = useState(0);
  const [consent, setConsent] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const trackerPath = `/trackers/${tracker.slug}`;
  const definition = cardDefinitions.find((candidate) => candidate.slug === selectedCardSlug) || cardDefinitions[0];
  const selectedSlotId = /^\d+$/.test(serial) && Number.isSafeInteger(Number(serial))
    ? getTrackerSlotId(tracker, definition.slug, Number(serial)) : undefined;
  const selectedSerialSummary = selectedSlotId
    ? `${definition.title} ${formatTrackerSerial(tracker, Number(serial), definition)}/${definition.total}` : undefined;

  useEffect(() => {
    session.current = undefined;
    // Keep local files, but never reuse uploaded evidence for a different copy.
    setAttachments((current) => current.map(({ key, file, preview }) => ({ key, file, preview })));
    setUploadMessage('');
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
  useEffect(() => {
    if (message || errors.length) errorRef.current?.focus();
  }, [message, errors]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('kind') === 'sighting' || params.get('kind') === 'correction') setKind(params.get('kind') as ReportKind);
    const slotId = getTrackerSlotIdFromDeepLinkParams(tracker, params);
    const slot = slotId ? getTrackerCardSlot(tracker, slotId) : undefined;
    if (!slot) return;
    setSelectedCardSlug(slot.cardSlug || cardDefinitions[0]?.slug || '');
    setSerial(String(Number(slot.serialNumber)));
  }, [cardDefinitions, tracker]);

  async function ensureSession() {
    if (!consent) throw new Error('Please confirm permission to submit this evidence.');
    if (!selectedSlotId) throw new Error(`Enter a serial from 1 to ${definition.total}.`);
    if (session.current?.cardId === selectedSlotId && session.current.expiresAt > Date.now()) return session.current.token;
    if (!turnstileToken) throw new Error('Complete the verification check first.');
    try {
      const response = await fetch(`/api/trackers/${tracker.slug}/submission-session`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: selectedSlotId, turnstileToken, consent: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Verification failed.');
      if (typeof data.token !== 'string' || !data.token || !Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now()) {
        throw new Error('Verification could not be confirmed. Please try again.');
      }
      session.current = { token: data.token, expiresAt: data.expiresAt, cardId: selectedSlotId };
      return data.token as string;
    } finally {
      // Verification may have consumed the token even if its response never reached us.
      setTurnstileToken('');
      setChallengeVersion((version) => version + 1);
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitLock.current) return;
    setMessage('');
    setErrors([]);
    if (!selectedSlotId) { setMessage(`Enter a serial from 1 to ${definition.total}.`); return; }
    if (!link.trim() && !attachments.length && !notes.trim()) {
      setMessage('Add a photo, source link, or note for review.'); return;
    }
    if (link.trim() && !normalizeSourceUrl(link.trim())) {
      setMessage('Use a direct HTTPS eBay listing, TCGplayer product, Reddit/X/Instagram post, PSA/CGC certificate, or Wizards article. For other sources, leave the link blank and add a note.'); return;
    }

    submitLock.current = true;
    setSubmitting(true);
    try {
      const previousToken = session.current?.token;
      const token = await ensureSession();
      // A renewed permission needs new uploads. Successful uploads otherwise survive retries.
      const evidence = attachments.map((asset): ReportAttachment => token === previousToken
        ? asset : { key: asset.key, file: asset.file, preview: asset.preview });
      setAttachments(evidence);
      const uploadErrors: string[] = [];
      for (let index = 0; index < evidence.length; index++) {
        const asset = evidence[index];
        if (asset.assetId) continue;
        setUploadMessage(`Uploading photo ${index + 1} of ${evidence.length}...`);
        const formData = new FormData();
        formData.append('file', asset.file);
        try {
          const response = await fetch(`/api/trackers/${tracker.slug}/upload-image`, {
            method: 'POST', headers: { 'x-submission-token': token }, body: formData,
          });
          const data = await response.json().catch(() => null);
          if (!response.ok || typeof data?.assetId !== 'string' || !EVIDENCE_ID.test(data.assetId)) {
            if (response.status === 401) session.current = undefined;
            throw new Error(data?.message || 'Upload failed.');
          }
          evidence[index] = { ...asset, assetId: data.assetId, status: data.safetyStatus };
          setAttachments([...evidence]);
        } catch (error) {
          uploadErrors.push(`${asset.file.name}: ${error instanceof Error ? error.message : 'Upload failed.'}`);
        }
      }
      setUploadMessage('');
      if (uploadErrors.length) {
        setErrors(uploadErrors);
        throw new Error('Some photos could not upload. Your report is still here; retry or remove those photos.');
      }
      const response = await fetch(`/api/trackers/${tracker.slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-submission-token': token },
        body: JSON.stringify({
          cardId: selectedSlotId, foundBy, dateFound, link,
          sourceType: sourceType === 'auto' ? inferReportSourceType(link) : sourceType,
          verificationStatus: link.trim() ? 'source-linked' : 'unverified',
          price, kind, priceKind, currency: price !== '' ? currency : undefined, priceDate,
          grading: gradingService ? { service: gradingService, grade: Number(grade), dateGraded: dateGraded || undefined, certificateNumber: certificateNumber || undefined } : undefined,
          evidenceAssetIds: evidence.map((asset) => asset.assetId), notes,
        }),
      });
      if (!response.ok) {
        if (response.status === 401) session.current = undefined;
        const data = await response.json().catch(() => null);
        setErrors(Array.isArray(data?.errors) ? data.errors.filter((error: unknown) => typeof error === 'string') : []);
        throw new Error(data?.message || 'Submission failed. Your report is still here.');
      }
      const receipt = await response.json();
      setFollowUpPath(receipt.followUpPath || '');
      const slot = getTrackerCardSlot(tracker, selectedSlotId);
      setCompletedReport({ label: selectedSerialSummary || tracker.title,
        href: slot ? `${trackerPath}?${getTrackerCardDeepLinkParams(tracker, slot)}` : trackerPath });
      setSerial(cardDefinitions[0]?.total === 1 ? '1' : '');
      setSelectedCardSlug(cardDefinitions[0]?.slug || '');
      setFoundBy(''); setDateFound(''); setLink(''); setSourceType('auto');
      setPrice(''); setPriceKind('unknown'); setCurrency('USD'); setPriceDate('');
      setGradingService(''); setGrade(''); setDateGraded(''); setCertificateNumber('');
      setAttachments([]);
      for (const preview of previews.current) URL.revokeObjectURL(preview);
      previews.current.clear();
      session.current = undefined;
      setNotes(''); setConsent(false); setTurnstileToken('');
      setChallengeVersion((version) => version + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not confirm submission. Your report is still here.');
    } finally {
      submitLock.current = false;
      setSubmitting(false);
      setUploadMessage('');
    }
  };

  const handleImageSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || submitLock.current) return;
    setMessage(''); setErrors([]);
    if (files.length + attachments.length > MAX_EVIDENCE_IMAGES) {
      setErrors([`A report can contain up to ${MAX_EVIDENCE_IMAGES} photos. Remove a photo before adding more.`]); return;
    }
    const invalidFiles = files.flatMap((file) => {
      const error = evidenceFileError(file);
      return error ? [`${file.name}: ${error}`] : [];
    });
    if (invalidFiles.length) { setErrors(invalidFiles); return; }
    const additions = files.map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      return { key: crypto.randomUUID(), file, preview };
    });
    setAttachments((current) => [...current, ...additions]);
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
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8 sm:px-8">
      <Link href={`${trackerPath}#serials`} className="inline-flex items-center gap-2 py-2 text-sm text-ring-teal hover:underline">
        <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />Back to tracker
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-ring-gold">Report a Find</h1>
      <p className="mt-2 break-words font-semibold text-ring-light">{tracker.displayTitle || tracker.title}</p>
      <p className="mt-1 text-sm text-ring-light/70">{tracker.subtitle}</p>
      <p className="mt-2 text-sm text-ring-light/70">Reports are queued for admin review before they appear as located.</p>
      <form onSubmit={handleSubmit} onInvalidCapture={(event) => {
        const field = event.target as HTMLInputElement;
        const details = field.closest('details');
        if (details) { details.open = true; field.focus(); }
      }} className="mt-6">
        <fieldset disabled={submitting} className="min-w-0 space-y-6 disabled:opacity-75">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            {hasMultipleCardDefinitions && <label className={`${labelClass} sm:col-span-2`} htmlFor="card-selection">Card
              <select id="card-selection" className={inputClass} value={selectedCardSlug} required onChange={(event) => {
                setSelectedCardSlug(event.target.value);
                setSerial(cardDefinitions.find((card) => card.slug === event.target.value)?.total === 1 ? '1' : '');
              }}>
                {cardDefinitions.map((card) => <option key={card.slug} value={card.slug}>{card.title}</option>)}
              </select>
            </label>}
            <div className="min-w-0">
              <label className={labelClass} htmlFor="serial">Serial Number</label>
              <div className="flex items-center gap-3">
                <input id="serial" type="text" inputMode="numeric" pattern="[0-9]+" maxLength={Math.max(definition.serialPadding, String(definition.total).length)} required
                  aria-describedby="serial-range" value={serial} onChange={(event) => setSerial(event.target.value)} className={inputClass} />
                <span className="mt-2 shrink-0 font-semibold text-ring-light/70">/ {definition.total}</span>
              </div>
              <p id="serial-range" className="mt-2 text-xs text-ring-light/60">Serials 1 to {definition.total}</p>
            </div>
            <label className={labelClass}>Report type
              <select value={kind} onChange={(event) => setKind(event.target.value as ReportKind)} className={inputClass}>
                <option value="discovery">New discovery</option><option value="sighting">Later sighting or update</option><option value="correction">Correction to recorded facts</option>
              </select>
            </label>
          </div>
          {selectedSerialSummary && <p className="break-words text-sm font-semibold text-ring-teal" role="status">{selectedSerialSummary}</p>}
          <section className="space-y-4 border-t border-ring-light/15 pt-5" aria-label="Evidence">
            <div>
              <label className={labelClass} htmlFor="evidence-image-upload">Photos</label>
              <input id="evidence-image-upload" className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-ring-dark file:px-3 file:py-2 file:font-semibold file:text-ring-light`}
                type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImageSelection} disabled={attachments.length >= MAX_EVIDENCE_IMAGES} />
              <p className="mt-2 text-xs text-ring-light/60">Up to 8 photos. JPEG, PNG, or WebP; 4 MB each. Photos stay on your device until you submit.</p>
              {attachments.length > 0 && <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Selected photos">
                {attachments.map((asset, index) => <li key={asset.key} className="relative min-w-0">
                  <ExternalImage src={asset.preview} alt={`Evidence photo ${index + 1}`} className="aspect-[3/4] w-full rounded border border-ring-light/30 object-contain" />
                  <p className="mt-1 text-xs text-ring-light/70">{!asset.assetId ? 'Not sent yet' : asset.status === 'clean' ? 'Ready for review' : asset.status === 'flagged' ? 'Held by safety checks' : 'Awaiting safety checks'}</p>
                  <button type="button" aria-label={`Remove evidence ${index + 1} from report`} title="Remove from report" onClick={() => {
                    URL.revokeObjectURL(asset.preview); previews.current.delete(asset.preview);
                    setAttachments((current) => current.filter((item) => item.key !== asset.key));
                  }} className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded border border-ring-light/50 bg-ring-dark text-ring-light">
                    <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                </li>)}
              </ul>}
            </div>
            <label className={labelClass} htmlFor="link">Source Link <span className="font-normal text-ring-light/60">(optional)</span>
              <input id="link" type="url" maxLength={2048} value={link} onChange={(event) => setLink(event.target.value)} className={inputClass} />
            </label>
            <div>
              <label className={labelClass} htmlFor="notes">Notes</label>
              <textarea id="notes" rows={2} maxLength={1200} value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} />
            </div>
          </section>
          <details className="border-y border-ring-light/15 py-3">
            <summary className="cursor-pointer py-2 text-sm font-semibold text-ring-light">Additional details (optional)</summary>
            <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
              <label className={labelClass} htmlFor="found-by">Discoverer
                <input id="found-by" type="text" maxLength={120} value={foundBy} onChange={(event) => setFoundBy(event.target.value)} className={inputClass} />
              </label>
              <label className={labelClass} htmlFor="date-found">Date found
                <input id="date-found" type="date" value={dateFound} onChange={(event) => setDateFound(event.target.value)} className={inputClass} />
              </label>
              <label className={labelClass} htmlFor="source-type">Source type
                <select id="source-type" value={sourceType} onChange={(event) => setSourceType(event.target.value as SourceType | 'auto')} className={inputClass}>
                  <option value="auto">Automatic</option><option value="marketplace">Marketplace</option><option value="grading-pop">Grading Pop</option>
                  <option value="social">Social Post</option><option value="article">Article</option><option value="private-sale">Private Sale</option><option value="other">Other</option>
                </select>
              </label>
              <label className={labelClass} htmlFor="price">Price observation
                <input id="price" type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className={inputClass} />
              </label>
              {price !== '' && <div className="grid min-w-0 gap-4 sm:col-span-2 sm:grid-cols-3">
                <label className={labelClass}>Price type<select value={priceKind} onChange={(event) => setPriceKind(event.target.value)} className={inputClass}><option value="unknown">Unclassified</option><option value="asking-price">Asking price</option><option value="completed-sale">Completed sale</option></select></label>
                <label className={labelClass}>Currency<select value={currency} onChange={(event) => setCurrency(event.target.value)} className={inputClass}>{['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].map((code) => <option key={code}>{code}</option>)}</select></label>
                <label className={labelClass}>Price date<input type="date" value={priceDate} required={priceKind !== 'unknown'} onChange={(event) => setPriceDate(event.target.value)} className={inputClass} /></label>
              </div>}
              <label className={labelClass}>Grading service<input value={gradingService} maxLength={80} onChange={(event) => setGradingService(event.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Grade<input type="number" min="0" max="10" step="0.5" required={Boolean(gradingService)} value={grade} onChange={(event) => setGrade(event.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Grading date<input type="date" value={dateGraded} onChange={(event) => setDateGraded(event.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Certificate number<input value={certificateNumber} maxLength={100} onChange={(event) => setCertificateNumber(event.target.value)} className={inputClass} /></label>
            </div>
          </details>
          <div className="space-y-4">
            <label className="flex items-start gap-3 text-sm text-ring-light">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" required />
              <span>I have permission to submit this evidence for safety checks and admin review. Approved evidence may be published. <Link href="/privacy" className="text-ring-teal underline">Privacy details</Link></span>
            </label>
            <SubmissionChallenge resetVersion={challengeVersion} onToken={setTurnstileToken} />
            <button className="min-h-11 w-full rounded bg-ring-gold px-4 py-3 font-bold text-ring-dark hover:bg-yellow-400 disabled:cursor-not-allowed disabled:bg-ring-light/40 sm:w-auto"
              type="submit" disabled={!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}>
              {submitting ? uploadMessage || 'Submitting...' : 'Submit report'}
            </button>
            {uploadMessage && <p role="status" className="text-sm text-ring-light/70">{uploadMessage}</p>}
            <p className="text-xs text-ring-light/60">Evidence remains private until safety checks and admin approval. <Link href="/verification-guide" className="text-ring-teal underline">Verification standards</Link></p>
          </div>
        </fieldset>
        {(message || errors.length > 0) && <div ref={errorRef} role="alert" tabIndex={-1} className="mt-4 rounded border border-red-300/40 p-3 text-sm text-red-300">
          {message && <p>{message}</p>}
          {errors.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
        </div>}
      </form>
    </main>
  );
}

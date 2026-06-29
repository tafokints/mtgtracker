'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { TOTAL_RING_CARDS, formatSerial } from '@/lib/ring-data';
import { SourceType, VerificationStatus } from '@/lib/types';

export default function SubmitPage() {
  const [cardId, setCardId] = useState('');
  const [foundBy, setFoundBy] = useState('');
  const [dateFound, setDateFound] = useState('');
  const [link, setLink] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('marketplace');
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('source-linked');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [evidenceImageUrls, setEvidenceImageUrls] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setIsError(false);

    const response = await fetch('/api/trackers/one-ring/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cardId,
        foundBy,
        dateFound,
        link,
        sourceType,
        verificationStatus,
        price,
        imageUrl,
        evidenceImageUrls,
        notes,
      }),
    });

    if (response.ok) {
      setMessage('Submission queued for review. Thank you!');
      setIsError(false);
      setCardId('');
      setFoundBy('');
      setDateFound('');
      setLink('');
      setPrice('');
      setImageUrl('');
      setEvidenceImageUrls('');
      setNotes('');
    } else {
      setMessage('Submission failed. Please check the serial and source details.');
      setIsError(true);
    }
  };

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Report a The One Ring Find',
    description: 'Submit information about discovered serialized The One Ring cards to help track all 100 copies.',
    url: 'https://mtgtrackers.com/trackers/one-ring/submit',
    mainEntity: {
      '@type': 'Form',
      name: 'The One Ring Discovery Report',
      description: 'Form to report newly discovered serialized The One Ring cards',
    },
  };

  return (
    <>
      <Head>
        <title>Report a Find | One Ring Tracker</title>
        <meta name="description" content="Submit a discovered serialized The One Ring card for admin review." />
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
          <Link href="/trackers/one-ring" className="text-ring-gold hover:text-yellow-400 transition-colors">
            Back
          </Link>
        </div>
        <form onSubmit={handleSubmit} className="w-full max-w-2xl bg-ring-dark p-8 rounded-lg border border-ring-gold">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block uppercase tracking-wide text-ring-gold text-xs font-bold mb-2" htmlFor="serial">
                Serial Number
              </label>
              <select
                className="block w-full bg-ring-light border border-ring-gold text-ring-dark py-3 px-4 rounded leading-tight focus:outline-none focus:bg-white"
                id="serial"
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                required
              >
                <option value="">Select a serial</option>
                {Array.from({ length: TOTAL_RING_CARDS }, (_, i) => i + 1).map((id) => (
                  <option key={id} value={id}>
                    The One Ring {formatSerial(id)}/100
                  </option>
                ))}
              </select>
            </div>
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
            className="mt-6 bg-ring-gold hover:bg-yellow-400 text-ring-dark font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            type="submit"
          >
            Submit
          </button>
          {message && <p className={`mt-4 text-center ${isError ? 'text-red-500' : 'text-green-400'}`}>{message}</p>}
        </form>
      </main>
    </>
  );
}

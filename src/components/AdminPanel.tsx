'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SerializedRingCard, GradingInfo, PriceHistoryEntry, DiscoverySubmission, VerificationStatus } from '../lib/types';
import type { TrackerSummary } from '@/lib/trackers';
import { formatTrackerSerial } from '@/lib/tracker-data';

interface AdminPanelProps {
  tracker: TrackerSummary;
  cards: SerializedRingCard[];
  onPriceUpdate: (cardId: number, price: number) => void;
  onImageUpdate: (cardId: number, imageUrl: string) => void;
  onGradingUpdate: (cardId: number, grading: GradingInfo) => void;
  onPriceHistoryAdd: (cardId: number, entry: PriceHistoryEntry) => void;
  onRefresh: () => void;
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
  const serialLabel = (serialNumber: string | number) => `${serialNumber}/${tracker.total}`;

  const [isVisible, setIsVisible] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'review' | 'price' | 'image' | 'grading' | 'history'>('review');
  const [submissions, setSubmissions] = useState<DiscoverySubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [imageOverrides, setImageOverrides] = useState<Record<string, string>>({});
  const [verificationOverrides, setVerificationOverrides] = useState<Record<string, VerificationStatus>>({});
  
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
      const response = await fetch(`${trackerApiBase}/submissions?status=pending`);
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

  const reviewSubmission = async (submission: DiscoverySubmission, action: 'approve' | 'reject') => {
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
        }),
      });

      if (response.ok) {
        setMessage(action === 'approve' ? `Approved ${serialLabel(submission.serialNumber)}` : `Rejected ${serialLabel(submission.serialNumber)}`);
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
    setMessage(`Price updated for serial ${serialLabel(formatTrackerSerial(tracker, selectedCard))}`);
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
    setMessage(`Image updated for serial ${serialLabel(formatTrackerSerial(tracker, selectedCard))}`);
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
    setMessage(`Grading updated for serial ${serialLabel(formatTrackerSerial(tracker, selectedCard))}`);
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
    setMessage(`Price history added for serial ${serialLabel(formatTrackerSerial(tracker, selectedCard))}`);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-ring-dark border border-ring-gold rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-ring-gold">Admin Panel</h2>
          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="text-xs text-ring-light hover:text-ring-gold"
              >
                Logout
              </button>
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
                  {serialLabel(card.serialNumber)} - {card.found ? card.verificationStatus : 'not found'}
                </option>
              ))}
            </select>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-ring-gold flex-wrap">
            <button
              onClick={() => setActiveTab('review')}
              className={`px-2 py-2 text-xs font-bold ${
                activeTab === 'review'
                  ? 'text-ring-gold border-b-2 border-ring-gold'
                  : 'text-ring-light hover:text-ring-gold'
              }`}
            >
              Review ({submissions.length})
            </button>
            <button
              onClick={() => setActiveTab('price')}
              className={`px-2 py-2 text-xs font-bold ${
                activeTab === 'price' 
                  ? 'text-ring-gold border-b-2 border-ring-gold' 
                  : 'text-ring-light hover:text-ring-gold'
              }`}
            >
              Price
            </button>
            <button
              onClick={() => setActiveTab('image')}
              className={`px-2 py-2 text-xs font-bold ${
                activeTab === 'image' 
                  ? 'text-ring-gold border-b-2 border-ring-gold' 
                  : 'text-ring-light hover:text-ring-gold'
              }`}
            >
              Image
            </button>
            <button
              onClick={() => setActiveTab('grading')}
              className={`px-2 py-2 text-xs font-bold ${
                activeTab === 'grading' 
                  ? 'text-ring-gold border-b-2 border-ring-gold' 
                  : 'text-ring-light hover:text-ring-gold'
              }`}
            >
              Grading
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-2 py-2 text-xs font-bold ${
                activeTab === 'history' 
                  ? 'text-ring-gold border-b-2 border-ring-gold' 
                  : 'text-ring-light hover:text-ring-gold'
              }`}
            >
              History
            </button>
          </div>

          {activeTab === 'review' && (
            <div className="space-y-4">
              {submissionsLoading && (
                <p className="text-sm text-ring-light">Loading pending reports...</p>
              )}
              {!submissionsLoading && submissions.length === 0 && (
                <p className="text-sm text-ring-light">No pending reports.</p>
              )}
              {submissions.map((submission) => (
                <div key={submission.id} className="rounded border border-ring-gold/40 bg-black/20 p-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-ring-gold">{serialLabel(submission.serialNumber)}</p>
                      <p className="text-xs text-ring-light">
                        {submission.sourceType.replace('-', ' ')} · {submission.requestedVerificationStatus.replace('-', ' ')}
                      </p>
                      <p className="text-xs text-ring-light">{new Date(submission.submittedAt).toLocaleString()}</p>
                    </div>
                    {submission.price !== undefined && (
                      <span className="rounded bg-green-900/40 px-2 py-1 text-xs text-green-300">
                        ${submission.price.toLocaleString()}
                      </span>
                    )}
                  </div>

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
                          <img src={image.url} alt={`Evidence for ${serialLabel(submission.serialNumber)}`} className="h-28 w-full object-cover" />
                        </a>
                      ))}
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

                  <div className="grid grid-cols-2 gap-2">
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
                  </div>
                </div>
              ))}
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

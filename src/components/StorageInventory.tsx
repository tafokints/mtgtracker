'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { StorageInventoryPage } from '@/lib/storage-inventory';
import styles from './OwnerDashboard.module.css';

const labels = { retained: 'Report or history retained', recent: 'Within retention window', candidate: 'Potentially abandoned', unknown: 'Needs investigation' };

export default function StorageInventory({ onSessionLost }: { onSessionLost: () => void }) {
  const [page, setPage] = useState<StorageInventoryPage | null>(null);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function load(next: Array<string | undefined>) {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setPage(null);
    try {
      const response = await fetch('/api/admin/storage-inventory', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cursor: next.at(-1) }), signal: controller.signal,
      });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (response.status === 401) { onSessionLost(); return; }
      if (!response.ok) throw new Error(data.message || 'Inventory unavailable');
      setPage(data); setCursors(next);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Inventory unavailable');
    } finally { if (!controller.signal.aborted) { request.current = null; setBusy(false); } }
  }

  return <section className={styles.storageCheck} aria-label="Upload retention inventory">
    <div className={styles.sectionTitle}><h2>Upload retention</h2>
      <button className={styles.testButton} disabled={busy} onClick={() => load([undefined])}>
        {page ? <ArrowPathIcon aria-hidden="true" /> : <MagnifyingGlassIcon aria-hidden="true" />}{busy ? 'Checking records...' : page ? 'Refresh inventory' : 'Check inventory'}
      </button>
    </div>
    <p className={styles.notice}>Read-only upload records. Deletion disabled; backup recovery has not been verified. File presence and safety are not tested here.</p>
    {busy && <p role="status">Loading upload records...</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {page && <div aria-live="polite">
      <p className={styles.notice}>{page.rows.length} {page.rows.length === 1 ? 'record' : 'records'} in this batch. {page.nextCursor ? 'More records may remain.' : 'End of inventory.'}</p>
      <ul className={styles.rows}>{page.rows.map((row) => <li className={styles.service} key={row.id}>
        <div><strong>{row.card || 'Unresolved upload'}</strong><br /><small>{row.id.slice(0, 8)}{row.createdAt ? ` / ${new Date(row.createdAt).toLocaleDateString()}` : ''}{row.bytes ? ` / ${Math.ceil(row.bytes / 1024)} KB` : ''}</small></div>
        <span className={row.status === 'retained' || row.status === 'recent' ? styles.configured : styles.missing}>{labels[row.status]}</span>
      </li>)}</ul>
      <div className={styles.pagination}>
        <button disabled={busy || cursors.length === 1} onClick={() => load(cursors.slice(0, -1))} className={styles.iconButton} title="Previous inventory batch" aria-label="Previous inventory batch"><ArrowLeftIcon /></button>
        <span>Batch {cursors.length}</span>
        <button disabled={busy || !page.nextCursor} onClick={() => load([...cursors, page.nextCursor!])} className={styles.iconButton} title="Next inventory batch" aria-label="Next inventory batch"><ArrowRightIcon /></button>
      </div>
    </div>}
  </section>;
}

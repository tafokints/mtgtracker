'use client';

import { useEffect, useRef, useState } from 'react';
import { BeakerIcon } from '@heroicons/react/24/outline';
import type { StorageCheckResult } from '@/lib/storage-check';
import styles from './OwnerDashboard.module.css';

const labels = { upload: 'Private upload', read: 'Read-back integrity', privacy: 'Anonymous access denied', cleanup: 'Test file removed' };
const statuses = { passed: 'Passed', failed: 'Not confirmed', skipped: 'Not tested' };

export default function StorageCheck({ configured, onSessionLost }: { configured: boolean; onSessionLost: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StorageCheckResult | null>(null);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); }, []);

  async function run() {
    if (request.current || !configured || !window.confirm('Run a private storage test? This creates and removes one tiny test file. Provider operations may be billed. No reports or discoveries will be changed.')) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setResult(null); setError('');
    try {
      const response = await fetch('/api/admin/storage-check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'TEST_PRIVATE_STORAGE' }), signal: controller.signal,
      });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (response.status === 401) { onSessionLost(); return; }
      if (data.checks) setResult(data);
      else throw new Error(data.message || 'Storage test could not be confirmed.');
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Storage test could not be confirmed.');
    } finally {
      if (!controller.signal.aborted) { request.current = null; setBusy(false); }
    }
  }

  return <section className={styles.storageCheck} aria-label="Private storage verification">
    <div className={styles.sectionTitle}>
      <h2>Private storage verification</h2>
      <button className={styles.testButton} disabled={!configured || busy} onClick={run}>
        <BeakerIcon aria-hidden="true" />{busy ? 'Testing storage...' : 'Test storage'}
      </button>
    </div>
    {!configured && <p className={styles.missing}>Storage connection missing</p>}
    {busy && <p role="status">Storage check in progress</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {result && <div aria-live="polite">
      <p className={result.ok ? styles.configured : styles.missing}>{result.ok ? 'Storage checks passed' : 'Storage checks incomplete'}</p>
      {Object.entries(labels).map(([id, label]) => {
        const status = result.checks[id as keyof typeof labels];
        return <div className={styles.service} key={id}><span>{label}</span><span className={status === 'passed' ? styles.configured : styles.missing}>{statuses[status]}</span></div>;
      })}
      {result.checks.cleanup !== 'passed' && <p role="alert" className={styles.error}>Cleanup needs review. A small diagnostic file may remain in storage.</p>}
      <p className={styles.notice}>Run {result.runId}<br />{new Date(result.checkedAt).toLocaleString()}</p>
    </div>}
    <p className={styles.notice}>Image scanning, report approval and backup recovery: not verified by this storage check.</p>
  </section>;
}

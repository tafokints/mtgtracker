'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon, ArrowRightIcon, ArrowPathIcon, ArrowTopRightOnSquareIcon, ArrowRightStartOnRectangleIcon, ShieldCheckIcon, InboxIcon } from '@heroicons/react/24/outline';
import { allTrackers, getTracker } from '@/lib/trackers';
import type { InboxPage, InboxRow } from '@/lib/admin-inbox';
import type { AdminPrincipal } from '@/lib/admin-auth';
import type { SerializedRingCard } from '@/lib/types';
import AdminPanel from './AdminPanel';
import ExternalImage from './ExternalImage';
import StorageCheck from './StorageCheck';
import styles from './OwnerDashboard.module.css';

const trackers = allTrackers.filter((tracker) => tracker.status === 'live').sort((a, b) => a.title.localeCompare(b.title));
const statuses = [['pending', 'Pending'], ['needs-more-info', 'Needs information'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['duplicate', 'Duplicate'], ['cannot-verify', 'Cannot verify'], ['revoked', 'Retracted'], ['all', 'All statuses']];
type Configuration = { services: Array<{ name: string; configured: boolean }> };
const unavailableEdit = async () => { throw new Error('Open the tracker admin tools for card metadata edits.'); };

export default function OwnerDashboard() {
  const [owner, setOwner] = useState<AdminPrincipal | null>(null);
  const [checking, setChecking] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(true);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'inbox' | 'configuration'>('inbox');
  const [status, setStatus] = useState('pending');
  const [trackerFilter, setTrackerFilter] = useState('');
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const [page, setPage] = useState<InboxPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<InboxRow | null>(null);
  const [cards, setCards] = useState<SerializedRingCard[] | null>(null);
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const generation = useRef(0);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const cursor = cursors.at(-1);
  const clearSession = useCallback(() => {
    generation.current++;
    setOwner(null); setPage(null); setSelected(null); setCards(null); setConfiguration(null);
    setPassword(''); setCode(''); setCursors([null]);
  }, []);
  const checkSession = useCallback(async () => {
    const current = generation.current;
    try {
      const response = await fetch('/api/admin/login', { cache: 'no-store' });
      const data = await response.json();
      if (current !== generation.current) return;
      if (!response.ok) throw new Error(data.message || 'Owner access is temporarily unavailable.');
      setMfaRequired(Boolean(data.mfaRequired));
      if (data.authenticated && data.principal?.role === 'owner') setOwner(data.principal);
      else clearSession();
    } catch (cause) {
      if (current === generation.current) { clearSession(); setError(cause instanceof Error ? cause.message : 'Owner access is unavailable.'); }
    } finally { setChecking(false); }
  }, [clearSession]);

  useEffect(() => {
    void checkSession();
    const focus = () => { if (document.visibilityState === 'visible') void checkSession(); };
    window.addEventListener('focus', focus);
    window.addEventListener('pageshow', focus);
    return () => { window.removeEventListener('focus', focus); window.removeEventListener('pageshow', focus); };
  }, [checkSession]);

  const ownerId = owner?.id;
  useEffect(() => {
    if (!ownerId) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setPage(null); setConfiguration(null);
    const query = new URLSearchParams({ status, tracker: trackerFilter });
    if (cursor) query.set('cursor', cursor);
    void (async () => {
      try {
        const response = await fetch(tab === 'inbox' ? `/api/admin/inbox?${query}` : '/api/admin/configuration', { cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (response.status === 401) { clearSession(); setError('Your session ended. Sign in again.'); return; }
        if (!response.ok) throw new Error(data.message || 'Could not load this view.');
        if (tab === 'inbox') setPage(data); else setConfiguration(data);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load this view.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [ownerId, status, trackerFilter, cursor, revision, tab, clearSession]);

  useEffect(() => {
    setCards(null);
    if (!selected || !ownerId) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/trackers/${selected.tracker}/cards`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('The copy record could not be loaded. Close the report and retry.');
        const data = await response.json();
        if (!controller.signal.aborted) setCards(data);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not open report.'); }
    })();
    detailHeading.current?.focus();
    return () => controller.abort();
  }, [selected, ownerId]);

  async function login(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password, code }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Sign-in failed.');
      await checkSession();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign-in failed.'); }
    finally { setBusy(false); setPassword(''); setCode(''); }
  }

  async function logout() {
    if (busy) return;
    setBusy(true); setError('');
    generation.current++;
    try {
      const response = await fetch('/api/admin/login', { method: 'DELETE' });
      if (!response.ok) throw new Error('Sign-out could not be confirmed. Please retry.');
      clearSession();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign-out failed.'); }
    finally { setBusy(false); }
  }
  const refresh = () => { setCursors([null]); setRevision((value) => value + 1); };
  const selectedTracker = selected ? getTracker(selected.tracker) : undefined;

  return <main className={styles.root}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>MTG Trackers <span>Owner</span></Link>
      <div className={styles.headerActions}>
        <Link href="/" title="View public site" aria-label="View public site" className={styles.iconButton}><ArrowTopRightOnSquareIcon /></Link>
        {owner && <><span className={styles.identity}>{owner.id}</span><button disabled={busy} onClick={logout} className={styles.iconButton} aria-label="Sign out" title="Sign out"><ArrowRightStartOnRectangleIcon /></button></>}
      </div>
    </header>
    <div className={styles.content}>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {checking ? <p role="status">Checking owner access...</p> : !owner ? <section className={styles.login}>
        <ShieldCheckIcon className={styles.loginIcon} />
        <h1>Owner sign-in</h1>
        <form onSubmit={login}>
          <label htmlFor="owner-password">Owner password<input id="owner-password" type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {mfaRequired && <label htmlFor="admin-code">Authenticator code<input id="admin-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} /></label>}
          <button className={styles.primary} disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
        </form>
      </section> : <>
        <div className={styles.title}><h1>Owner dashboard</h1><span className={styles.ownerBadge}><ShieldCheckIcon />Owner access</span></div>
        <nav aria-label="Owner views" className={styles.tabs}>
          <button aria-current={tab === 'inbox' ? 'page' : undefined} onClick={() => { setTab('inbox'); setSelected(null); }}>Reports</button>
          <button aria-current={tab === 'configuration' ? 'page' : undefined} onClick={() => { setTab('configuration'); setSelected(null); }}>Service setup</button>
        </nav>
        {tab === 'configuration' ? <section className={styles.services}>
          <div className={styles.sectionTitle}><h2>Environment configuration</h2><button onClick={refresh} disabled={loading} className={styles.iconButton} title="Refresh configuration" aria-label="Refresh configuration"><ArrowPathIcon /></button></div>
          {loading && <p role="status">Loading configuration...</p>}
          {configuration?.services.map((service) => <div className={styles.service} key={service.name}><span>{service.name}</span><span className={service.configured ? styles.configured : styles.missing}>{service.configured ? 'Configured' : 'Missing configuration'}</span></div>)}
          <p className={styles.notice}>Configuration is not a successful service test. Hosted upload, scanning, approval, and recovery checks remain required.</p>
          <div className={styles.service}><span>Scheduled backups and restore drill</span><span className={styles.missing}>Not verified here</span></div>
          {configuration && <StorageCheck configured={configuration.services.some((service) => service.name === 'Private image storage' && service.configured)} onSessionLost={clearSession} />}
        </section> : <>
          <div className={styles.filters}>
            <div><label htmlFor="inbox-status">Status</label><select id="inbox-status" value={status} onChange={(event) => { setStatus(event.target.value); setCursors([null]); setSelected(null); }}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div><label htmlFor="inbox-tracker">Tracker</label><select id="inbox-tracker" value={trackerFilter} onChange={(event) => { setTrackerFilter(event.target.value); setCursors([null]); setSelected(null); }}><option value="">All trackers</option>{trackers.map((tracker) => <option key={tracker.slug} value={tracker.slug}>{tracker.title}</option>)}</select></div>
            <button onClick={refresh} disabled={loading} className={styles.iconButton} title="Refresh inbox" aria-label="Refresh inbox"><ArrowPathIcon /></button>
          </div>
          <div className={`${styles.workspace} ${selected ? styles.withReview : ''}`}>
            <section className={styles.inbox} aria-label="Report inbox" aria-busy={loading}>
              <div className={styles.sectionTitle}><h2>Reports</h2><span>{page ? `${page.rows.length} on this page` : ''}</span></div>
              {loading && <p role="status" className={styles.empty}>Loading reports...</p>}
              {page?.rows.length === 0 && <div className={styles.empty}><InboxIcon /><h3>{page.nextCursor ? 'No matches in this batch' : cursors.length > 1 ? 'End of this queue' : 'No matching reports'}</h3></div>}
              <ul className={styles.rows}>{page?.rows.map((row) => {
                const reference = getTracker(row.tracker)?.referenceImage;
                return <li key={`${row.tracker}:${row.id}`}><button onClick={() => { setSelected(row); setError(''); }} aria-pressed={selected?.id === row.id && selected.tracker === row.tracker} className={styles.row}>
                  {reference ? <ExternalImage src={reference} alt="Reference artwork" loading="eager" className={styles.thumbnail} /> : <InboxIcon className={styles.thumbnail} />}
                  <span className={styles.rowBody}><strong>{row.cardTitle} <span className={styles.serial}>{row.serial}</span></strong><span>{row.trackerTitle}</span><small>{new Date(row.submittedAt).toLocaleDateString()} · {row.kind} · {row.imageCount} images{row.hasSource ? ' · source provided' : ''}</small></span>
                  <span className={styles.status}>{statuses.find(([value]) => value === row.status)?.[1] || row.status}</span><ArrowRightIcon className={styles.rowArrow} />
                </button></li>;
              })}</ul>
              <div className={styles.pagination}>
                <button disabled={loading || cursors.length === 1} onClick={() => setCursors((values) => values.slice(0, -1))} className={styles.iconButton} aria-label="Previous report page" title="Previous report page"><ArrowLeftIcon /></button>
                <span>Page {cursors.length}</span>
                <button disabled={loading || !page?.nextCursor} onClick={() => setCursors((values) => [...values, page!.nextCursor])} className={styles.iconButton} aria-label="Next report page" title="Next report page"><ArrowRightIcon /></button>
              </div>
            </section>
            {selected && selectedTracker && <section className={styles.detail} aria-label="Selected report">
              <h2 ref={detailHeading} tabIndex={-1}>{selected.cardTitle} <span>{selected.serial}</span></h2>
              <Link href={selectedTracker.href} className={styles.trackerLink}>View tracker <ArrowTopRightOnSquareIcon /></Link>
              {!cards ? <p role="status">Loading copy record...</p> : <AdminPanel key={`${selected.tracker}:${selected.id}`} tracker={selectedTracker} cards={cards}
                onPriceUpdate={unavailableEdit} onImageUpdate={unavailableEdit} onGradingUpdate={unavailableEdit} onPriceHistoryAdd={unavailableEdit}
                onRefresh={refresh} workspace={{ reportId: selected.id, onClose: () => setSelected(null), onSessionLost: clearSession }} />}
            </section>}
          </div>
        </>}
      </>}
    </div>
  </main>;
}

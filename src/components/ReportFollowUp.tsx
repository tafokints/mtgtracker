'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowPathIcon, PaperAirplaneIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';

interface Receipt { status: string; cardTitle: string; serialNumber: string; serialTotal: number; request?: string; followUps: Array<{ id: string; at: string; notes: string }> }

export default function ReportFollowUp({ slug, id }: { slug: string; id: string }) {
  const token = useRef('');
  const replyId = useRef('');
  const [receipt, setReceipt] = useState<Receipt>();
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [assets, setAssets] = useState<string[]>([]);
  const endpoint = `/api/reports/${slug}/${id}`;
  async function request(body?: unknown) {
    const response = await fetch(endpoint, { method: body ? 'POST' : 'GET', headers: { 'x-report-token': token.current, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Report unavailable');
    return data;
  }
  useEffect(() => {
    token.current = window.location.hash.slice(1);
    replyId.current = crypto.randomUUID();
    if (!token.current) { setMessage('The private access token is missing. Open the original report link.'); return; }
    let active = true;
    fetch(endpoint, { headers: { 'x-report-token': token.current }, cache: 'no-store' }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Report unavailable');
      if (active) setReceipt(data);
    }).catch((error) => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [endpoint]);
  async function upload(file?: File) {
    if (!file || busy || assets.length >= 8) return;
    setBusy(true); setMessage('');
    try {
      const session = await request({ action: 'upload-session' });
      const form = new FormData(); form.set('file', file);
      const response = await fetch(`/api/trackers/${slug}/upload-image`, { method: 'POST', headers: { 'x-submission-token': session.token }, body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Upload failed');
      setAssets((current) => [...current, data.assetId]);
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto min-h-screen max-w-2xl px-4 py-10 text-ring-light">
    <Link href={`/trackers/${slug}`} className="text-ring-gold underline">Back to tracker</Link>
    <h1 className="mt-6 text-2xl font-bold">Private Report</h1>
    {receipt && <>
      <p className="mt-3 break-words">{receipt.cardTitle} {receipt.serialNumber}/{receipt.serialTotal}</p>
      <div className="mt-4 flex items-center gap-3"><p className="capitalize">{receipt.status.replaceAll('-', ' ')}</p><button type="button" title="Refresh report status" aria-label="Refresh report status" disabled={busy} onClick={async () => { try { setReceipt(await request()); } catch (error) { setMessage((error as Error).message); } }} className="p-2 text-ring-gold"><ArrowPathIcon className="h-5 w-5" /></button></div>
      {receipt.request && <p className="mt-4 whitespace-pre-wrap border-l-2 border-ring-gold pl-4 break-words">{receipt.request}</p>}
      {receipt.followUps.map((reply) => <p key={reply.id} className="mt-4 whitespace-pre-wrap break-words text-sm">{reply.at.slice(0, 10)}: {reply.notes}</p>)}
      {receipt.status === 'needs-more-info' && <form className="mt-6 space-y-4" onSubmit={async (event) => {
        event.preventDefault(); if (busy) return; setBusy(true); setMessage('');
        try { await request({ replyId: replyId.current, notes, evidenceAssetIds: assets }); setReceipt(await request()); setNotes(''); setAssets([]); replyId.current = crypto.randomUUID(); }
        catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
      }}>
        <label className="block text-sm">Additional information<textarea value={notes} onChange={(event) => setNotes(event.target.value)} required maxLength={1200} rows={5} className="mt-2 block w-full rounded border border-ring-gold/40 bg-black/20 p-3" /></label>
        <label className="flex flex-wrap items-center gap-2 text-sm"><ArrowUpTrayIcon className="h-5 w-5" />Additional evidence<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || assets.length >= 8} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ''; }} className="block max-w-full" /></label>
        {!!assets.length && <p className="text-sm">{assets.length} attachment(s) uploaded</p>}
        <button disabled={busy} className="flex items-center gap-2 rounded bg-ring-gold px-4 py-2 text-ring-dark disabled:opacity-50"><PaperAirplaneIcon className="h-5 w-5" />Send reply</button>
      </form>}
    </>}
    {message && <p role="status" className="mt-5 break-words text-red-300">{message}</p>}
  </main>;
}

'use client';

import { useState } from 'react';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

export default function ReviewSourceLink({ tracker, reportId, url }: { tracker: string; reportId: string; url: string }) {
  const [checkedUrl, setCheckedUrl] = useState('');
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);
  return <span className="block min-w-0 space-y-1">
    <span className="block break-all text-ring-light/70">{url}</span>
    {checkedUrl === url ? <a href={checkedUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-ring-gold underline">Open source: {new URL(checkedUrl).hostname}</a> : <button type="button" disabled={checking} className="inline-flex items-center gap-1 text-ring-gold" onClick={async () => {
      setChecking(true);
      setMessage('');
      try {
        const response = await fetch(`/api/trackers/${encodeURIComponent(tracker)}/submissions/${encodeURIComponent(reportId)}/source`, { method: 'POST' });
        const data = await response.json();
        if (!response.ok || data.url !== url) throw new Error(data.message || 'Source changed. Refresh the queue.');
        setCheckedUrl(data.url);
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Source check unavailable'); }
      finally { setChecking(false); }
    }}><ShieldCheckIcon className="h-4 w-4" />{checking ? 'Checking...' : 'Check source link'}</button>}
    {message && <span role="status" className="block text-amber-200">{message}</span>}
  </span>;
}

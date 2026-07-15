'use client';

import { useState } from 'react';

interface PublicDiscoveryShareActionsProps {
  copyText: string;
  xUrl: string;
  redditUrl: string;
}

export default function PublicDiscoveryShareActions({ copyText, xUrl, redditUrl }: PublicDiscoveryShareActionsProps) {
  const [message, setMessage] = useState('');

  const copyShareText = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setMessage('Copied');
    } catch {
      setMessage('Copy failed');
    }
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={copyShareText}
        className="rounded border border-ring-teal px-3 py-2 text-xs font-bold text-ring-teal transition-colors hover:bg-ring-teal hover:text-ring-dark"
      >
        Copy Share Text
      </button>
      <a
        href={xUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded border border-ring-teal px-3 py-2 text-xs font-bold text-ring-teal transition-colors hover:bg-ring-teal hover:text-ring-dark"
      >
        Share on X
      </a>
      <a
        href={redditUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded border border-ring-teal px-3 py-2 text-xs font-bold text-ring-teal transition-colors hover:bg-ring-teal hover:text-ring-dark"
      >
        Share on Reddit
      </a>
      {message && <span className="text-xs text-ring-light/60">{message}</span>}
    </div>
  );
}

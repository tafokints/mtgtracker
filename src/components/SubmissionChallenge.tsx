'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

interface Turnstile {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
}

export default function SubmissionChallenge({ onToken, resetVersion }: { onToken: (token: string) => void; resetVersion: number }) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<{ api: Turnstile; id: string }>();
  const previousReset = useRef(resetVersion);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  useEffect(() => {
    const turnstile = (window as Window & { turnstile?: Turnstile }).turnstile;
    if (!ready || !container.current || !sitekey || !turnstile) return;
    let active = true;
    try {
      const id = turnstile.render(container.current, {
        sitekey, action: 'discovery', theme: 'dark', size: container.current.clientWidth < 300 ? 'compact' : 'flexible',
        'response-field': false,
        callback: (token: string) => { if (active) { onToken(token); setFailed(false); } },
        'expired-callback': () => { if (active) onToken(''); },
        'timeout-callback': () => { if (active) onToken(''); },
        'error-callback': () => { if (active) { onToken(''); setFailed(true); } },
      });
      widget.current = { api: turnstile, id };
      return () => { active = false; widget.current = undefined; turnstile.remove(id); };
    } catch { onToken(''); setFailed(true); }
  }, [ready, sitekey, onToken]);
  useEffect(() => {
    if (previousReset.current === resetVersion) return;
    previousReset.current = resetVersion;
    onToken('');
    setFailed(false);
    try { if (widget.current) widget.current.api.reset(widget.current.id); }
    catch { setFailed(true); }
  }, [resetVersion, onToken]);
  if (!sitekey) return <p role="status" className="text-sm text-amber-200">Submissions are temporarily unavailable while security setup is completed.</p>;
  return <>
    <Script id="submission-turnstile" src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setReady(true)} onError={() => { onToken(''); setFailed(true); }} />
    <div ref={container} className="min-h-[65px] w-full min-w-0" />
    {failed && <p role="alert" className="text-sm text-red-300">Verification could not load. Please reload and try again.</p>}
  </>;
}

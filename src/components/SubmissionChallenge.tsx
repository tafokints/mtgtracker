'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

interface Turnstile {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  remove(id: string): void;
}

export default function SubmissionChallenge({ onToken }: { onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    const turnstile = (window as Window & { turnstile?: Turnstile }).turnstile;
    if (!ready || !container.current || !sitekey || !turnstile) return;
    const id = turnstile.render(container.current, {
      sitekey, action: 'discovery', theme: 'dark', size: container.current.clientWidth < 300 ? 'compact' : 'flexible',
      callback: onToken,
      'expired-callback': () => onToken(''),
      'error-callback': () => { onToken(''); setFailed(true); },
    });
    return () => { turnstile.remove(id); };
  }, [ready, sitekey, onToken]);
  if (!sitekey) return <p role="status" className="text-sm text-amber-200">Submissions are temporarily unavailable while security setup is completed.</p>;
  return <>
    <Script id="submission-turnstile" src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setReady(true)} onError={() => setFailed(true)} />
    <div ref={container} className="min-h-[65px] w-full min-w-0" />
    {failed && <p role="alert" className="text-sm text-red-300">Verification could not load. Please reload and try again.</p>}
  </>;
}

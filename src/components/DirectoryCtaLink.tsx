'use client';

import Link from 'next/link';
import type React from 'react';

type DirectoryCtaAction = 'open-tracker' | 'report-find' | 'latest-discovery';

interface DirectoryCtaLinkProps {
  href: string;
  trackerSlug: string;
  action: DirectoryCtaAction;
  className?: string;
  children: React.ReactNode;
}

export default function DirectoryCtaLink({ href, trackerSlug, action, className, children }: DirectoryCtaLinkProps) {
  const trackClick = () => {
    const payload = JSON.stringify({
      tracker: trackerSlug,
      action,
      href,
      sourcePath: `${window.location.pathname}${window.location.search}`,
    });

    if (navigator.sendBeacon) {
      const queued = navigator.sendBeacon('/api/directory/click', new Blob([payload], { type: 'application/json' }));
      if (queued) return;
    }

    if (typeof fetch !== 'function') return;
    void fetch('/api/directory/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  };
  const trackAuxClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button === 1) {
      trackClick();
    }
  };

  return (
    <Link href={href} className={className} onClick={trackClick} onAuxClick={trackAuxClick}>
      {children}
    </Link>
  );
}

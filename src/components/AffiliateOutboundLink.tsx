'use client';

import type React from 'react';
import { AffiliateLink } from '@/lib/trackers';

interface AffiliateOutboundLinkProps {
  link: AffiliateLink;
  trackerSlug: string;
  placement: string;
  className?: string;
  children?: React.ReactNode;
}

function getViewContext() {
  const params = new URLSearchParams(window.location.search);
  const context = {
    query: params.get('q') || undefined,
    filter: params.get('filter') || undefined,
    sort: params.get('sort') || undefined,
    cardFilter: params.get('cardFilter') || undefined,
    card: params.get('card') || undefined,
    serial: params.get('serial') || undefined,
    slot: params.get('slot') || params.get('id') || undefined,
  };

  return Object.fromEntries(Object.entries(context).filter(([, value]) => Boolean(value)));
}

export default function AffiliateOutboundLink({ link, trackerSlug, placement, className, children }: AffiliateOutboundLinkProps) {
  const trackClick = () => {
    const payload = JSON.stringify({
      tracker: trackerSlug,
      merchant: link.merchant,
      href: link.href,
      label: link.label,
      intent: link.intent,
      placement,
      sourcePath: `${window.location.pathname}${window.location.search}`,
      viewContext: getViewContext(),
    });

    if (navigator.sendBeacon) {
      const queued = navigator.sendBeacon('/api/affiliate/click', new Blob([payload], { type: 'application/json' }));
      if (queued) {
        return;
      }
    }

    if (typeof fetch !== 'function') {
      return;
    }

    void fetch('/api/affiliate/click', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={className}
      onClick={trackClick}
      onAuxClick={trackAuxClick}
    >
      {children || link.label}
    </a>
  );
}

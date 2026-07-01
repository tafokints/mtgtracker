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

export default function AffiliateOutboundLink({ link, trackerSlug, placement, className, children }: AffiliateOutboundLinkProps) {
  const trackClick = () => {
    const payload = JSON.stringify({
      tracker: trackerSlug,
      merchant: link.merchant,
      href: link.href,
      label: link.label,
      placement,
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/affiliate/click', new Blob([payload], { type: 'application/json' }));
      return;
    }

    fetch('/api/affiliate/click', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  };

  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={className}
      onClick={trackClick}
    >
      {children || link.label}
    </a>
  );
}

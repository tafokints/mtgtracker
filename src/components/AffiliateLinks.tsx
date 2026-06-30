import React from 'react';
import { AffiliateLink, defaultAffiliateLinks } from '@/lib/trackers';
import AffiliateDisclosureNotice from '@/components/AffiliateDisclosureNotice';

interface AffiliateLinksProps {
  links?: AffiliateLink[];
  title?: string;
}

export default function AffiliateLinks({ links, title = 'Related Marketplace Links' }: AffiliateLinksProps) {
  const resolvedLinks = links && links.length > 0 ? links : defaultAffiliateLinks;

  return (
    <div className="w-full max-w-5xl mt-12">
      <h2 className="text-2xl font-bold text-center mb-4 text-ring-gold">{title}</h2>
      <div className="mb-4">
        <AffiliateDisclosureNotice links={resolvedLinks} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {resolvedLinks.map((link) => (
          <a
            key={`${link.merchant}-${link.href}`}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="bg-ring-dark border border-ring-gold hover:bg-ring-gold hover:text-ring-dark text-ring-gold font-bold py-2 px-4 rounded text-center transition-colors"
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}

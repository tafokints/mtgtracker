import React from 'react';
import { AffiliateLink, defaultAffiliateLinks } from '@/lib/trackers';

interface AffiliateLinksProps {
  links?: AffiliateLink[];
  title?: string;
}

export default function AffiliateLinks({ links, title = 'Related Marketplace Links' }: AffiliateLinksProps) {
  const resolvedLinks = links && links.length > 0 ? links : defaultAffiliateLinks;

  return (
    <div className="w-full max-w-5xl mt-12">
      <h2 className="text-2xl font-bold text-center mb-4 text-ring-gold">{title}</h2>
      <div className="mb-4 p-3 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-900 rounded text-sm text-center" role="alert">
        Some links may be affiliate links. Purchases through them may support the site at no extra cost to you.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {resolvedLinks.map((link) => (
          <a
            key={`${link.merchant}-${link.href}`}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-ring-dark border border-ring-gold hover:bg-ring-gold hover:text-ring-dark text-ring-gold font-bold py-2 px-4 rounded text-center transition-colors"
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}

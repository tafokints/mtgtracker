import React from 'react';
import { AffiliateLink, defaultAffiliateLinks } from '@/lib/trackers';

interface AffiliateLinksProps {
  links?: AffiliateLink[];
  title?: string;
}

export default function AffiliateLinks({ links, title = 'Related Marketplace Links' }: AffiliateLinksProps) {
  const resolvedLinks = links && links.length > 0 ? links : defaultAffiliateLinks;
  const hasEbayLink = resolvedLinks.some((link) => link.merchant === 'ebay');
  const hasAmazonLink = resolvedLinks.some((link) => link.merchant === 'amazon');

  return (
    <div className="w-full max-w-5xl mt-12">
      <h2 className="text-2xl font-bold text-center mb-4 text-ring-gold">{title}</h2>
      <div className="mb-4 rounded border border-ring-gold/40 bg-ring-dark/80 p-4 text-sm leading-6 text-ring-light" role="note">
        <p>
          Marketplace links are affiliate links. Purchases through them may support MTG Trackers at no extra cost to you.
        </p>
        {hasEbayLink && (
          <p className="mt-2">
            As an eBay Partner Network Affiliate, I earn from qualifying purchases.
          </p>
        )}
        {hasAmazonLink && (
          <p className="mt-2">
            As an Amazon Associate I earn from qualifying purchases.
          </p>
        )}
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

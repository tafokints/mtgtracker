import React from 'react';
import { AffiliateLink, defaultAffiliateLinks } from '@/lib/trackers';
import AffiliateDisclosureNotice from '@/components/AffiliateDisclosureNotice';
import AffiliateOutboundLink from '@/components/AffiliateOutboundLink';

interface AffiliateLinksProps {
  links?: AffiliateLink[];
  title?: string;
  trackerSlug?: string;
  placement?: string;
}

export default function AffiliateLinks({
  links,
  title = 'Related Marketplace Links',
  trackerSlug = 'default',
  placement = 'marketplace-links',
}: AffiliateLinksProps) {
  const resolvedLinks = links && links.length > 0 ? links : defaultAffiliateLinks;

  return (
    <div className="w-full max-w-5xl mt-12">
      <h2 className="text-2xl font-bold text-center mb-4 text-ring-gold">{title}</h2>
      <div className="mb-4">
        <AffiliateDisclosureNotice links={resolvedLinks} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {resolvedLinks.map((link) => (
          <AffiliateOutboundLink
            key={`${link.merchant}-${link.href}`}
            link={link}
            trackerSlug={trackerSlug}
            placement={placement}
            className="bg-ring-dark border border-ring-gold hover:bg-ring-gold hover:text-ring-dark text-ring-gold font-bold py-2 px-4 rounded text-center transition-colors"
          />
        ))}
      </div>
    </div>
  );
}

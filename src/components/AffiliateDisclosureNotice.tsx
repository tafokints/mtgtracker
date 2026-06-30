import { AffiliateLink, defaultAffiliateLinks } from '@/lib/trackers';

interface AffiliateDisclosureNoticeProps {
  links?: AffiliateLink[];
  compact?: boolean;
}

export default function AffiliateDisclosureNotice({ links, compact = false }: AffiliateDisclosureNoticeProps) {
  const resolvedLinks = links && links.length > 0 ? links : defaultAffiliateLinks;
  const hasEbayLink = resolvedLinks.some((link) => link.merchant === 'ebay');
  const hasAmazonLink = resolvedLinks.some((link) => link.merchant === 'amazon');

  return (
    <div className="rounded border border-ring-gold/40 bg-ring-dark/80 p-4 text-sm leading-6 text-ring-light" role="note">
      <p>
        Marketplace links are affiliate links. Purchases through them may support MTG Trackers at no extra cost to you.
      </p>
      {!compact && hasEbayLink && (
        <p className="mt-2">
          As an eBay Partner Network Affiliate, I earn from qualifying purchases.
        </p>
      )}
      {!compact && hasAmazonLink && (
        <p className="mt-2">
          As an Amazon Associate I earn from qualifying purchases.
        </p>
      )}
      {compact && hasEbayLink && (
        <p className="mt-2">
          As an eBay Partner Network Affiliate, I earn from qualifying purchases.
          {hasAmazonLink ? ' As an Amazon Associate I earn from qualifying purchases.' : ''}
        </p>
      )}
    </div>
  );
}

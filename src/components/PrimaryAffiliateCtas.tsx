import { AffiliateLink, defaultAffiliateLinks } from '@/lib/trackers';
import AffiliateOutboundLink from '@/components/AffiliateOutboundLink';

interface PrimaryAffiliateCtasProps {
  links?: AffiliateLink[];
  trackerSlug: string;
}

const merchantCopy: Record<AffiliateLink['merchant'], { eyebrow: string; detail: string }> = {
  ebay: {
    eyebrow: 'Auction Watch',
    detail: 'Search active listings and sold-market signals.',
  },
  tcgplayer: {
    eyebrow: 'Singles Market',
    detail: 'Check TCGplayer marketplace availability.',
  },
  amazon: {
    eyebrow: 'Sealed Product',
    detail: 'Browse relevant collector booster products.',
  },
  other: {
    eyebrow: 'Marketplace',
    detail: 'Open a related marketplace search.',
  },
};

function orderLinks(links: AffiliateLink[]) {
  const merchantOrder: AffiliateLink['merchant'][] = ['ebay', 'tcgplayer', 'amazon', 'other'];
  const uniqueByMerchant = new Map<AffiliateLink['merchant'], AffiliateLink>();

  for (const merchant of merchantOrder) {
    const link = links.find((item) => item.merchant === merchant);
    if (link) {
      uniqueByMerchant.set(merchant, link);
    }
  }

  return [...uniqueByMerchant.values()];
}

export default function PrimaryAffiliateCtas({ links, trackerSlug }: PrimaryAffiliateCtasProps) {
  const resolvedLinks = orderLinks(links && links.length > 0 ? links : defaultAffiliateLinks);

  if (resolvedLinks.length === 0) {
    return null;
  }

  return (
    <section className="mb-5 rounded-lg border border-ring-gold/30 bg-black/20 p-4" aria-label="Primary marketplace links">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {resolvedLinks.slice(0, 3).map((link) => {
          const copy = merchantCopy[link.merchant];
          const eyebrow = link.ctaEyebrow || copy.eyebrow;
          const detail = link.ctaDetail || copy.detail;

          return (
            <AffiliateOutboundLink
              key={`${link.merchant}-${link.href}`}
              link={link}
              trackerSlug={trackerSlug}
              placement="tracker-top-cta"
              className="block rounded border border-ring-gold/40 bg-black/20 p-3 text-left transition-colors hover:border-ring-gold hover:bg-ring-gold hover:text-ring-dark"
            >
              <span className="block text-xs font-bold uppercase opacity-75">{eyebrow}</span>
              <span className="mt-1 block font-bold">{link.label}</span>
              <span className="mt-1 block text-xs opacity-80">{detail}</span>
            </AffiliateOutboundLink>
          );
        })}
      </div>
    </section>
  );
}

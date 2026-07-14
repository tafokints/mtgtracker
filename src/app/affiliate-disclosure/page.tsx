import type { Metadata } from 'next';
import Link from 'next/link';
import { buildBreadcrumbJsonLd } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Affiliate Disclosure',
  description: 'Affiliate relationship disclosure for marketplace links on MTG Trackers.',
  alternates: {
    canonical: '/affiliate-disclosure',
  },
};

export default function AffiliateDisclosurePage() {
  return (
    <main className="min-h-screen px-6 py-8 md:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd([
          { name: 'MTG Trackers', path: '/' },
          { name: 'Affiliate Disclosure', path: '/affiliate-disclosure' },
        ])) }}
      />
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/" className="text-sm text-ring-gold hover:text-yellow-400">
          &larr; MTG Trackers
        </Link>

        <h1 className="mt-6 text-4xl font-bold text-ring-gold md:text-5xl">Affiliate Disclosure</h1>
        <div className="mt-6 space-y-5 text-base leading-8 text-ring-light/85">
          <p>
            Some marketplace links on MTG Trackers are affiliate links. If you click one of those links and make a qualifying purchase, MTG Trackers may earn a commission at no extra cost to you.
          </p>
          <p>
            As an eBay Partner Network Affiliate, I earn from qualifying purchases.
          </p>
          <p>
            As an Amazon Associate I earn from qualifying purchases.
          </p>
          <p>
            Affiliate links are used to point collectors toward relevant searches, sealed products, or singles related to each tracker. They do not determine whether a discovery is approved, rejected, or marked with a particular verification status.
          </p>
          <p>
            MTG Trackers may also link to marketplaces, card databases, social posts, articles, and seller pages for source verification without an affiliate relationship.
          </p>
        </div>
      </div>
    </main>
  );
}

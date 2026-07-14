import type { Metadata } from 'next';
import Link from 'next/link';
import { buildBreadcrumbJsonLd } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'About',
  description: 'About MTG Trackers, an independent community project for tracking serialized Magic: The Gathering cards.',
  alternates: {
    canonical: '/about',
  },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen px-6 py-8 md:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd([
          { name: 'MTG Trackers', path: '/' },
          { name: 'About', path: '/about' },
        ])) }}
      />
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/" className="text-sm text-ring-gold hover:text-yellow-400">
          &larr; MTG Trackers
        </Link>

        <h1 className="mt-6 text-4xl font-bold text-ring-gold md:text-5xl">About MTG Trackers</h1>
        <div className="mt-6 space-y-5 text-base leading-8 text-ring-light/85">
          <p>
            MTG Trackers is a community-maintained reference for serialized Magic: The Gathering cards. The goal is to make discoveries easier to submit, review, verify, and browse across different serialized treatments.
          </p>
          <p>
            Each tracker focuses on a specific serialized card or treatment and keeps source links, evidence notes, price history, grading details, and discovery status together in one place.
          </p>
          <p>
            Public submissions enter a review queue before they appear as verified discoveries. Admin review is meant to keep the tracker useful without treating every social post, marketplace listing, or screenshot as equally reliable.
          </p>
          <p>
            MTG Trackers is independent and is not affiliated with, endorsed by, or sponsored by Wizards of the Coast, Hasbro, eBay, Amazon, TCGplayer, or any card grading company.
          </p>
        </div>
      </div>
    </main>
  );
}

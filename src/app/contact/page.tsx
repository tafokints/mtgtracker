import type { Metadata } from 'next';
import Link from 'next/link';
import { buildBreadcrumbJsonLd } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact MTG Trackers for corrections, source updates, tracker requests, and site issues.',
  alternates: {
    canonical: '/contact',
  },
};

export default function ContactPage() {
  return (
    <main className="min-h-screen px-6 py-8 md:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd([
          { name: 'MTG Trackers', path: '/' },
          { name: 'Contact', path: '/contact' },
        ])) }}
      />
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/" className="text-sm text-ring-gold hover:text-yellow-400">
          &larr; MTG Trackers
        </Link>

        <h1 className="mt-6 text-4xl font-bold text-ring-gold md:text-5xl">Contact</h1>
        <div className="mt-6 space-y-5 text-base leading-8 text-ring-light/85">
          <p>
            For discovery corrections, source updates, tracker requests, or site issues, open a GitHub issue so the request can be reviewed publicly.
          </p>
          <p>
            If you are reporting a discovered serial, the best path is the tracker submit page. Include the serial number, source link, image evidence, sale price if relevant, and any notes that help an admin verify the report.
          </p>
          <p>
            For private or sensitive corrections, use the project owner contact channel listed on the GitHub repository.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/trackers"
            className="inline-flex h-11 items-center rounded bg-ring-gold px-5 text-sm font-bold text-ring-dark transition-colors hover:bg-yellow-400"
          >
            Browse Trackers
          </Link>
          <Link
            href="https://github.com/tafokints/mtgtracker/issues"
            className="inline-flex h-11 items-center rounded border border-ring-gold px-5 text-sm font-bold text-ring-gold transition-colors hover:bg-ring-gold hover:text-ring-dark"
          >
            Open GitHub Issue
          </Link>
        </div>
      </div>
    </main>
  );
}

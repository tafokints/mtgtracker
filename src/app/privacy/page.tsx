import type { Metadata } from 'next';
import Link from 'next/link';
import { buildBreadcrumbJsonLd } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'Privacy information for MTG Trackers submissions, analytics, and admin review data.',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-6 py-8 md:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd([
          { name: 'MTG Trackers', path: '/' },
          { name: 'Privacy', path: '/privacy' },
        ])) }}
      />
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/" className="text-sm text-ring-gold hover:text-yellow-400">
          &larr; MTG Trackers
        </Link>

        <h1 className="mt-6 text-4xl font-bold text-ring-gold md:text-5xl">Privacy</h1>
        <div className="mt-6 space-y-5 text-base leading-8 text-ring-light/85">
          <p>
            MTG Trackers collects the information visitors choose to submit through tracker forms, including serial number, source links, image URLs, notes, prices, dates, and optional finder names.
          </p>
          <p>
            Submitted reports are stored for admin review. Approved details may become public on tracker pages when they help document a discovered serialized card. Avoid submitting private contact details, addresses, payment details, or anything you do not want reviewed by site admins.
          </p>
          <p>
            The site uses Vercel hosting, Vercel Analytics, Vercel Speed Insights, and Upstash Redis or Vercel KV to run the app, store tracker data, and understand basic site performance.
          </p>
          <p>
            Marketplace affiliate clicks and promoted discovery visits may be counted with tracker, source, campaign, card, serial, and page-path context so admins can understand which public pages and promotion channels are useful. These counters do not create visitor accounts or store payment information.
          </p>
          <p>
            Admin authentication uses a secure session cookie. The public tracker submit flow uses basic rate limiting to reduce spam and protect the review queue.
          </p>
          <p>
            To request a correction or removal of submitted tracker data, use the contact options on the contact page and include enough context for an admin to identify the report.
          </p>
        </div>
      </div>
    </main>
  );
}

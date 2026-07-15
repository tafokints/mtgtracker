import type { Metadata } from 'next';
import Link from 'next/link';
import { buildBreadcrumbJsonLd, buildVerificationGuideJsonLd } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Serialized MTG Verification Guide',
  description: 'How MTG Trackers reviews serialized Magic: The Gathering discovery reports, evidence images, source links, and verification status.',
  alternates: {
    canonical: '/verification-guide',
  },
  openGraph: {
    title: 'Serialized MTG Verification Guide',
    description: 'Learn what evidence helps serialized MTG discoveries move through admin review quickly and accurately.',
    url: '/verification-guide',
    type: 'website',
  },
};

const evidenceTiers = [
  {
    title: 'Confirmed',
    detail: 'A clear image or source shows the card face and stamped serial, with enough context for an admin to match the exact card and number.',
  },
  {
    title: 'Source-linked',
    detail: 'A public marketplace, grading, social, article, or sale source identifies the serialized card, but the serial image or provenance may need extra review.',
  },
  {
    title: 'Unverified',
    detail: 'The report is useful as a lead, but the serial, image, source, or context is not strong enough to update public counts confidently.',
  },
];

const sourceGuidance = [
  {
    label: 'Marketplace listing or sale',
    detail: 'Send the public listing or sold-comp URL, sale date when known, price if public, and screenshots only as supporting context.',
  },
  {
    label: 'Grading population source',
    detail: 'Include the grading company page or cert lookup, visible grade/cert context, and the card name plus stamped serial.',
  },
  {
    label: 'Social post',
    detail: 'Link the original post when possible. Reposts are weaker unless they preserve the original image, author, and date.',
  },
  {
    label: 'Article or guide',
    detail: 'Use articles for provenance and discovery history, then add a direct source or image if the article does not show the stamp clearly.',
  },
  {
    label: 'Private sale note',
    detail: 'Avoid private contact details. Share only the serial, price/date if allowed, and enough non-private context for admin review.',
  },
];

const imageRules = [
  'Show the stamped serial number clearly enough to read.',
  'Include the full card face or enough of the card to identify the exact treatment.',
  'Prefer original uploads or public image URLs over compressed repost screenshots.',
  'Do not include addresses, payment details, private messages, or personal contact information.',
  'Use multiple images when one photo shows the serial and another proves the source, grade, or listing context.',
];

export default function VerificationGuidePage() {
  return (
    <main className="min-h-screen px-6 py-8 md:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildVerificationGuideJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd([
          { name: 'MTG Trackers', path: '/' },
          { name: 'Verification Guide', path: '/verification-guide' },
        ])) }}
      />

      <div className="mx-auto w-full max-w-4xl">
        <Link href="/" className="text-sm text-ring-gold hover:text-yellow-400">
          &larr; MTG Trackers
        </Link>

        <header className="mt-6 border-b border-ring-gold/30 pb-6">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-ring-teal">Admin review standards</p>
          <h1 className="mt-3 text-4xl font-bold text-ring-gold md:text-5xl">Serialized MTG Verification Guide</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-ring-light/80">
            Strong discovery reports make new serialized card sightings easier to approve, easier to cite, and safer to share.
            Use this guide before submitting a find so the review queue gets the exact card, serial, source, and evidence context an admin needs.
          </p>
        </header>

        <section className="mt-8">
          <h2 className="text-2xl font-bold text-ring-light">Verification Status</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {evidenceTiers.map((tier) => (
              <article key={tier.title} className="rounded border border-ring-gold/30 bg-ring-dark/70 p-5">
                <h3 className="text-lg font-bold text-ring-gold">{tier.title}</h3>
                <p className="mt-3 text-sm leading-6 text-ring-light/75">{tier.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-ring-light">Best Evidence</h2>
          <div className="mt-4 rounded border border-ring-gold/30 bg-ring-dark/70 p-5">
            <ul className="space-y-3 text-sm leading-6 text-ring-light/80">
              {imageRules.map((rule) => (
                <li key={rule} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-ring-gold" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-ring-light">Source Types</h2>
          <div className="mt-4 divide-y divide-ring-gold/15 rounded border border-ring-gold/30 bg-ring-dark/70">
            {sourceGuidance.map((source) => (
              <article key={source.label} className="p-5">
                <h3 className="text-base font-bold text-ring-gold">{source.label}</h3>
                <p className="mt-2 text-sm leading-6 text-ring-light/75">{source.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded border border-ring-teal/35 bg-ring-teal/10 p-5">
          <h2 className="text-2xl font-bold text-ring-light">Fastest Approval Path</h2>
          <p className="mt-3 text-sm leading-6 text-ring-light/80">
            Pick the exact card and serial, add the original source link, upload or link a clear image of the stamp, include price/date if public,
            and add a short note explaining why the source is credible. That gives admins enough evidence to approve the discovery without guessing.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/trackers"
              className="inline-flex h-10 items-center rounded bg-ring-gold px-4 text-sm font-bold text-ring-dark transition-colors hover:bg-yellow-400"
            >
              Choose a Tracker
            </Link>
            <Link
              href="/discoveries"
              className="inline-flex h-10 items-center rounded border border-ring-gold/50 px-4 text-sm font-bold text-ring-gold transition-colors hover:border-ring-gold hover:bg-ring-gold hover:text-ring-dark"
            >
              View Recent Discoveries
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

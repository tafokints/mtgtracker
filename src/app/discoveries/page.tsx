import type { Metadata } from 'next';
import Link from 'next/link';
import { buildBreadcrumbJsonLd, buildDiscoveriesPageJsonLd } from '@/lib/seo';
import { getPublicRecentDiscoveries } from '@/lib/recent-discoveries';
import type { RecentTrackerDiscovery } from '@/lib/tracker-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Recent Discoveries',
  description: 'Recent admin-reviewed serialized Magic: The Gathering discoveries across MTG Trackers.',
  alternates: {
    canonical: '/discoveries',
    types: {
      'application/feed+json': '/discoveries.json',
      'application/rss+xml': '/discoveries.xml',
    },
  },
};

async function getDiscoveries() {
  try {
    return await getPublicRecentDiscoveries(40);
  } catch (error) {
    console.error('Error loading discoveries page:', error);
    return [];
  }
}

function formatStatus(value: string) {
  return value.replace(/-/g, ' ');
}

function formatDate(value?: string) {
  if (!value) return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function DiscoveryCard({ discovery }: { discovery: RecentTrackerDiscovery }) {
  const dateLabel = formatDate(discovery.dateFound);
  const statusLabel = formatStatus(discovery.verificationStatus);
  const sourceLabel = discovery.sourceType ? formatStatus(discovery.sourceType) : undefined;

  return (
    <article className="rounded-lg border border-ring-gold/25 bg-ring-dark/75 p-5 transition-colors hover:border-ring-gold/70 hover:bg-ring-gold/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-ring-teal">{discovery.trackerTitle}</p>
          <h2 className="mt-2 text-2xl font-bold text-ring-gold">
            <Link href={discovery.detailHref} className="hover:text-yellow-400">
              {discovery.label}
            </Link>
          </h2>
        </div>
        <span className="w-fit rounded border border-ring-gold/30 px-3 py-1 text-xs font-bold uppercase text-ring-light/70">
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-ring-light/75 sm:grid-cols-2 lg:grid-cols-4">
        {sourceLabel && <p>Source: {sourceLabel}</p>}
        {dateLabel && <p>Found: {dateLabel}</p>}
        {discovery.foundBy && <p>By: {discovery.foundBy}</p>}
        {discovery.price !== undefined && <p>Price: ${discovery.price.toLocaleString()}</p>}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={discovery.detailHref}
          className="inline-flex h-10 items-center rounded bg-ring-gold px-4 text-sm font-bold text-ring-dark transition-colors hover:bg-yellow-400"
        >
          Open Discovery
        </Link>
        <Link
          href={discovery.trackerHref}
          className="inline-flex h-10 items-center rounded border border-ring-gold px-4 text-sm font-bold text-ring-gold transition-colors hover:bg-ring-gold hover:text-ring-dark"
        >
          View Tracker
        </Link>
      </div>
    </article>
  );
}

export default async function DiscoveriesPage() {
  const discoveries = await getDiscoveries();

  return (
    <main className="min-h-screen px-6 py-8 md:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd([
          { name: 'MTG Trackers', path: '/' },
          { name: 'Recent Discoveries', path: '/discoveries' },
        ])) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildDiscoveriesPageJsonLd(discoveries)) }}
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div>
          <Link href="/" className="text-sm text-ring-gold hover:text-yellow-400">
            &larr; MTG Trackers
          </Link>
          <h1 className="mt-6 text-4xl font-bold text-ring-gold md:text-5xl">Recent Discoveries</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-ring-light/80">
            Fresh admin-reviewed serialized Magic: The Gathering discoveries across live trackers. Use these links to inspect source quality, evidence, sale context, and exact serial status.
          </p>
        </div>

        <section className="rounded-lg border border-ring-gold/30 bg-black/20 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-ring-light">Discovery Feeds</h2>
              <p className="mt-1 text-sm text-ring-light/65">
                Follow the same admin-reviewed discovery stream as JSON or RSS for bots, readers, and collector watchlists.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/discoveries.json" className="rounded border border-ring-gold px-4 py-2 text-sm font-bold text-ring-gold hover:bg-ring-gold hover:text-ring-dark">
                JSON Feed
              </Link>
              <Link href="/discoveries.xml" className="rounded border border-ring-gold px-4 py-2 text-sm font-bold text-ring-gold hover:bg-ring-gold hover:text-ring-dark">
                RSS Feed
              </Link>
            </div>
          </div>
        </section>

        {discoveries.length === 0 ? (
          <section className="rounded-lg border border-ring-light/10 bg-ring-dark/70 p-6 text-ring-light/70">
            No public discoveries have been confirmed yet. New finds will appear here after admin review.
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-4" aria-label="Recent serialized card discoveries">
            {discoveries.map((discovery) => (
              <DiscoveryCard key={`${discovery.trackerSlug}-${discovery.cardId}`} discovery={discovery} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

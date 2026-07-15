import type { Metadata } from 'next';
import Link from 'next/link';
import AffiliateDisclosureNotice from '@/components/AffiliateDisclosureNotice';
import AffiliateOutboundLink from '@/components/AffiliateOutboundLink';
import { serializedCatalog, type SerializedCatalogEntry } from '@/lib/serialized-catalog';
import { buildBreadcrumbJsonLd, buildSerializedCatalogJsonLd } from '@/lib/seo';
import { defaultAffiliateLinks, trackers } from '@/lib/trackers';

export const metadata: Metadata = {
  title: 'Serialized MTG Catalog',
  description: 'A researched catalog of Magic: The Gathering serialized card treatments, print ranges, release sets, and tracker launch status.',
  alternates: {
    canonical: '/serialized-mtg-catalog',
  },
  openGraph: {
    title: 'Serialized MTG Catalog',
    description: 'Browse serialized Magic: The Gathering card treatments by set, print range, release date, and tracker status.',
    url: '/serialized-mtg-catalog',
    type: 'website',
  },
};

const trackingModeLabels: Record<SerializedCatalogEntry['trackingMode'], string> = {
  'single-card': 'Single card',
  'multi-card-treatment': 'Multi-card treatment',
  'variant-card': 'Variant card',
  'promo-series': 'Promo series',
};

const statusLabels: Record<SerializedCatalogEntry['status'], string> = {
  live: 'Live tracker',
  planned: 'Planned',
  announced: 'Announced',
  'needs-verification': 'Needs verification',
};

function getNumberedLabel(entry: SerializedCatalogEntry) {
  if (entry.serialVariants?.length) {
    return entry.serialVariants.map((variant) => `${variant.label}: ${variant.total}`).join(', ');
  }

  if (entry.numbered) {
    return entry.numbered;
  }

  if (entry.defaultSerialTotal) {
    return `${entry.defaultSerialTotal}${entry.cardCount > 1 ? ' each' : ''}`;
  }

  return 'Verify';
}

function getDateLabel(entry: SerializedCatalogEntry) {
  return entry.releaseMonth || entry.releaseYear || 'TBD';
}

function getTrackerHref(entry: SerializedCatalogEntry) {
  return trackers.find((tracker) => tracker.catalogSlug === entry.slug && tracker.status === 'live')?.href;
}

function getCatalogCounts() {
  const totalCards = serializedCatalog.reduce((sum, entry) => sum + entry.cardCount, 0);
  const liveCount = serializedCatalog.filter((entry) => entry.status === 'live').length;
  const singleCardCount = serializedCatalog.filter((entry) => entry.trackingMode === 'single-card').length;
  const multiCardCount = serializedCatalog.length - singleCardCount;

  return {
    totalTreatments: serializedCatalog.length,
    totalCards,
    liveCount,
    singleCardCount,
    multiCardCount,
  };
}

export default function SerializedMtgCatalogPage() {
  const counts = getCatalogCounts();

  return (
    <main className="min-h-screen px-6 py-8 md:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildSerializedCatalogJsonLd(serializedCatalog)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd([
          { name: 'MTG Trackers', path: '/' },
          { name: 'Serialized MTG Catalog', path: '/serialized-mtg-catalog' },
        ])) }}
      />

      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 border-b border-ring-gold/30 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/" className="text-sm text-ring-gold hover:text-yellow-400">
              &larr; MTG Trackers
            </Link>
            <p className="mt-4 text-sm font-bold uppercase tracking-[0.2em] text-ring-teal">Research catalog</p>
            <h1 className="mt-3 text-4xl font-bold text-ring-gold">Serialized MTG Catalog</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-ring-light/75">
              A working index of serialized Magic: The Gathering treatments, print ranges, release sets, and tracker readiness.
              Live trackers can accept reports now; planned entries are the backlog for future tracker pages.
            </p>
          </div>
          <Link
            href="/trackers"
            className="inline-flex h-11 items-center justify-center rounded border border-ring-gold px-5 font-bold text-ring-gold transition-colors hover:bg-ring-gold hover:text-ring-dark"
          >
            Open Trackers
          </Link>
        </header>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <CatalogMetric label="Treatments" value={counts.totalTreatments.toLocaleString()} />
          <CatalogMetric label="Card names" value={counts.totalCards.toLocaleString()} />
          <CatalogMetric label="Live" value={counts.liveCount.toLocaleString()} />
          <CatalogMetric label="Single-card" value={counts.singleCardCount.toLocaleString()} />
          <CatalogMetric label="Multi-card" value={counts.multiCardCount.toLocaleString()} />
        </section>

        <section className="mt-8 border border-ring-gold/30 bg-ring-dark/70 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-ring-light">Marketplace Research</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ring-light/70">
                Use these broad serialized MTG searches when comparing listings, sealed-product odds, and public sale comps across treatments.
              </p>
            </div>
            <div className="md:text-right">
              <AffiliateDisclosureNotice links={defaultAffiliateLinks} compact />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {defaultAffiliateLinks.map((link) => (
              <AffiliateOutboundLink
                key={`${link.merchant}-${link.href}`}
                link={link}
                trackerSlug="default"
                placement="marketplace-links"
                viewContext={{ card: 'serialized-mtg-catalog' }}
                className="inline-flex min-h-10 items-center rounded border border-ring-gold/35 px-4 py-2 text-sm font-bold text-ring-gold transition-colors hover:border-ring-gold hover:bg-ring-gold hover:text-ring-dark"
              >
                {link.label}
              </AffiliateOutboundLink>
            ))}
          </div>
        </section>

        <section className="mt-8 overflow-x-auto rounded-lg border border-ring-gold/30">
          <table className="min-w-full border-collapse bg-ring-dark/70 text-left text-sm">
            <thead className="border-b border-ring-gold/30 text-xs uppercase tracking-wide text-ring-light/55">
              <tr>
                <th className="px-4 py-3 font-semibold">Treatment</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Set</th>
                <th className="px-4 py-3 font-semibold">Cards</th>
                <th className="px-4 py-3 font-semibold">Numbered</th>
                <th className="px-4 py-3 font-semibold">Found In</th>
                <th className="px-4 py-3 font-semibold">Mode</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Links</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ring-gold/15 text-ring-light/80">
              {serializedCatalog.map((entry) => {
                const trackerHref = getTrackerHref(entry);

                return (
                  <tr id={entry.slug} key={entry.slug} className="align-top transition-colors hover:bg-ring-gold/5">
                    <td className="px-4 py-3">
                      <Link
                        href={`/serialized-mtg-catalog/${entry.slug}`}
                        className="font-semibold text-ring-light underline-offset-4 hover:text-ring-gold hover:underline"
                      >
                        {entry.title}
                      </Link>
                      <div className="mt-1 max-w-md text-xs leading-5 text-ring-light/55">{entry.treatment}</div>
                      {entry.sampleCards.length > 0 && (
                        <div className="mt-2 text-xs leading-5 text-ring-light/60">
                          Examples: {entry.sampleCards.join(', ')}
                        </div>
                      )}
                      {entry.notes && (
                        <div className="mt-2 max-w-md text-xs leading-5 text-ring-teal">{entry.notes}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">{getDateLabel(entry)}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ring-gold">{entry.setCode}</div>
                      <div className="mt-1 max-w-[12rem] text-xs leading-5 text-ring-light/55">{entry.setName}</div>
                    </td>
                    <td className="px-4 py-3">{entry.cardCount}</td>
                    <td className="px-4 py-3 text-xs leading-5">{getNumberedLabel(entry)}</td>
                    <td className="px-4 py-3 max-w-xs text-xs leading-5">{entry.foundIn || 'Verify source'}</td>
                    <td className="px-4 py-3">{trackingModeLabels[entry.trackingMode]}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded border border-ring-gold/30 px-2 py-1 text-xs uppercase text-ring-light/65">
                        {statusLabels[entry.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2 text-xs">
                        {trackerHref && (
                          <Link href={trackerHref} className="font-bold text-ring-gold underline-offset-4 hover:text-yellow-400 hover:underline">
                            Tracker
                          </Link>
                        )}
                        <Link
                          href={`/serialized-mtg-catalog/${entry.slug}`}
                          className="font-bold text-ring-gold underline-offset-4 hover:text-yellow-400 hover:underline"
                        >
                          Details
                        </Link>
                        <Link
                          href={`https://scryfall.com/search?q=${encodeURIComponent(entry.scryfallQuery)}`}
                          className="font-bold text-ring-gold underline-offset-4 hover:text-yellow-400 hover:underline"
                        >
                          Scryfall
                        </Link>
                        {entry.sourceUrls.map((sourceUrl, index) => (
                          <Link
                            key={sourceUrl}
                            href={sourceUrl}
                            className="text-ring-light/65 underline-offset-4 hover:text-ring-light hover:underline"
                          >
                            Source {index + 1}
                          </Link>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function CatalogMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-ring-gold/25 bg-ring-dark/70 p-4">
      <p className="text-2xl font-bold text-ring-gold">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-ring-light/55">{label}</p>
    </div>
  );
}

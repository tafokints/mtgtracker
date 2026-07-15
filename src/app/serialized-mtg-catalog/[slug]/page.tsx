import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import AffiliateDisclosureNotice from '@/components/AffiliateDisclosureNotice';
import AffiliateOutboundLink from '@/components/AffiliateOutboundLink';
import { serializedCatalog, type SerializedCatalogEntry } from '@/lib/serialized-catalog';
import { buildBreadcrumbJsonLd, buildSerializedCatalogEntryJsonLd } from '@/lib/seo';
import { buildAmazonSearchUrl, buildTrackerEbaySearchUrl, defaultAffiliateLinks, trackers, type AffiliateLink } from '@/lib/trackers';

type CatalogEntryPageProps = {
  params: Promise<{ slug: string }>;
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

export function generateStaticParams() {
  return serializedCatalog.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: CatalogEntryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = getCatalogEntry(slug);

  if (!entry) {
    return {};
  }

  return {
    title: `${entry.title} Serialized MTG`,
    description: `Research ${entry.title} serialized Magic: The Gathering cards from ${entry.setName}, including print range, source links, tracker status, and marketplace research.`,
    alternates: {
      canonical: `/serialized-mtg-catalog/${entry.slug}`,
    },
    openGraph: {
      title: `${entry.title} Serialized MTG`,
      description: `Serialized MTG catalog entry for ${entry.title}: ${entry.treatment}, ${getNumberedLabel(entry)}, ${entry.setName}.`,
      url: `/serialized-mtg-catalog/${entry.slug}`,
      type: 'website',
    },
  };
}

function getCatalogEntry(slug: string) {
  return serializedCatalog.find((entry) => entry.slug === slug);
}

function getTracker(entry: SerializedCatalogEntry) {
  return trackers.find((tracker) => tracker.catalogSlug === entry.slug);
}

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

function getCatalogAffiliateLinks(entry: SerializedCatalogEntry): AffiliateLink[] {
  const ebayLink = defaultAffiliateLinks.find((link) => link.merchant === 'ebay');
  const amazonLink = defaultAffiliateLinks.find((link) => link.merchant === 'amazon');
  const specificEbayLink = ebayLink
    ? {
      ...ebayLink,
      label: `${entry.title} serials on eBay`,
      href: buildTrackerEbaySearchUrl(`serialized ${entry.title} mtg`, 'serialized-mtg'),
      ctaEyebrow: 'Auction comps',
      ctaDetail: `Search public eBay listings and sold comps for ${entry.title}.`,
    }
    : undefined;
  const specificAmazonLink = amazonLink
    ? {
      ...amazonLink,
      label: `${entry.setName} on Amazon`,
      href: buildAmazonSearchUrl(`${entry.setName} collector booster`),
      ctaEyebrow: 'Sealed product',
      ctaDetail: `Search sealed product and collector booster availability for ${entry.setName}.`,
    }
    : undefined;

  return defaultAffiliateLinks.map((link) => (
    link.merchant === 'ebay' && specificEbayLink
      ? specificEbayLink
      : link.merchant === 'amazon' && specificAmazonLink
        ? specificAmazonLink
        : link
  ));
}

export default async function SerializedCatalogEntryPage({ params }: CatalogEntryPageProps) {
  const { slug } = await params;
  const entry = getCatalogEntry(slug);

  if (!entry) {
    notFound();
  }

  const linkedTracker = getTracker(entry);
  const affiliateLinks = getCatalogAffiliateLinks(entry);

  return (
    <main className="min-h-screen px-6 py-8 md:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildSerializedCatalogEntryJsonLd(entry)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd([
          { name: 'MTG Trackers', path: '/' },
          { name: 'Serialized MTG Catalog', path: '/serialized-mtg-catalog' },
          { name: entry.title, path: `/serialized-mtg-catalog/${entry.slug}` },
        ])) }}
      />

      <div className="mx-auto w-full max-w-5xl">
        <header className="border-b border-ring-gold/30 pb-6">
          <Link href="/serialized-mtg-catalog" className="text-sm text-ring-gold hover:text-yellow-400">
            &larr; Serialized MTG Catalog
          </Link>
          <p className="mt-4 text-sm font-bold uppercase tracking-[0.2em] text-ring-teal">{entry.setCode} serialized entry</p>
          <h1 className="mt-3 text-4xl font-bold text-ring-gold md:text-5xl">{entry.title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-ring-light/80">
            {entry.treatment} from {entry.setName}. This page collects print-run notes, source links, tracker status,
            and marketplace research paths for this serialized Magic: The Gathering treatment.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {linkedTracker?.status === 'live' ? (
              <Link
                href={linkedTracker.href}
                className="inline-flex h-10 items-center rounded bg-ring-gold px-4 text-sm font-bold text-ring-dark transition-colors hover:bg-yellow-400"
              >
                Open Live Tracker
              </Link>
            ) : (
              <Link
                href="/verification-guide"
                className="inline-flex h-10 items-center rounded border border-ring-teal/60 px-4 text-sm font-bold text-ring-teal transition-colors hover:bg-ring-teal hover:text-ring-dark"
              >
                Review Evidence Standards
              </Link>
            )}
            <Link
              href={`https://scryfall.com/search?q=${encodeURIComponent(entry.scryfallQuery)}`}
              className="inline-flex h-10 items-center rounded border border-ring-gold/50 px-4 text-sm font-bold text-ring-gold transition-colors hover:border-ring-gold hover:bg-ring-gold hover:text-ring-dark"
            >
              Scryfall Search
            </Link>
          </div>
        </header>

        <section className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-4">
          <CatalogMetric label="Status" value={statusLabels[entry.status]} />
          <CatalogMetric label="Cards" value={entry.cardCount.toLocaleString()} />
          <CatalogMetric label="Numbered" value={getNumberedLabel(entry)} />
          <CatalogMetric label="Release" value={String(getDateLabel(entry))} />
        </section>

        <section className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_0.7fr]">
          <article className="rounded border border-ring-gold/30 bg-ring-dark/70 p-5">
            <h2 className="text-2xl font-bold text-ring-light">Tracker Notes</h2>
            <dl className="mt-4 grid grid-cols-1 gap-4 text-sm text-ring-light/80 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-ring-light/50">Set</dt>
                <dd className="mt-1">{entry.setName}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-ring-light/50">Treatment</dt>
                <dd className="mt-1">{entry.treatment}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-ring-light/50">Tracking Mode</dt>
                <dd className="mt-1">{trackingModeLabels[entry.trackingMode]}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-ring-light/50">Found In</dt>
                <dd className="mt-1">{entry.foundIn || 'Needs source verification'}</dd>
              </div>
            </dl>
            {entry.sampleCards.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-bold uppercase tracking-wide text-ring-gold">Example Cards</h3>
                <p className="mt-2 text-sm leading-6 text-ring-light/75">{entry.sampleCards.join(', ')}</p>
              </div>
            )}
            {entry.serialVariants?.length ? (
              <div className="mt-5">
                <h3 className="text-sm font-bold uppercase tracking-wide text-ring-gold">Serial Variants</h3>
                <ul className="mt-2 space-y-2 text-sm text-ring-light/75">
                  {entry.serialVariants.map((variant) => (
                    <li key={variant.label}>{variant.label}: {variant.total.toLocaleString()}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {entry.notes && (
              <p className="mt-5 rounded border border-ring-teal/30 bg-ring-teal/10 p-4 text-sm leading-6 text-ring-light/80">
                {entry.notes}
              </p>
            )}
          </article>

          <aside className="rounded border border-ring-gold/30 bg-ring-dark/70 p-5">
            <h2 className="text-2xl font-bold text-ring-light">Sources</h2>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              <Link
                href={`https://scryfall.com/search?q=${encodeURIComponent(entry.scryfallQuery)}`}
                className="font-bold text-ring-gold underline-offset-4 hover:text-yellow-400 hover:underline"
              >
                Scryfall query
              </Link>
              {entry.sourceUrls.map((sourceUrl, index) => (
                <Link
                  key={sourceUrl}
                  href={sourceUrl}
                  className="text-ring-light/70 underline-offset-4 hover:text-ring-light hover:underline"
                >
                  Source {index + 1}
                </Link>
              ))}
            </div>
          </aside>
        </section>

        <section className="mt-8 border border-ring-gold/30 bg-ring-dark/70 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-ring-light">Marketplace Research</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ring-light/70">
                Compare active listings, sold comps, singles demand, and sealed-product availability. Marketplace links are tracked so we can learn which entry pages turn collector interest into useful clicks.
              </p>
            </div>
            <div className="md:text-right">
              <AffiliateDisclosureNotice links={affiliateLinks} compact />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {affiliateLinks.map((link) => (
              <AffiliateOutboundLink
                key={`${link.merchant}-${link.href}`}
                link={link}
                trackerSlug="default"
                placement="marketplace-links"
                viewContext={{ card: entry.slug }}
                className="inline-flex min-h-10 items-center rounded border border-ring-gold/35 px-4 py-2 text-sm font-bold text-ring-gold transition-colors hover:border-ring-gold hover:bg-ring-gold hover:text-ring-dark"
              >
                {link.label}
              </AffiliateOutboundLink>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function CatalogMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-ring-gold/25 bg-ring-dark/70 p-4">
      <p className="text-lg font-bold text-ring-gold">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-ring-light/55">{label}</p>
    </div>
  );
}

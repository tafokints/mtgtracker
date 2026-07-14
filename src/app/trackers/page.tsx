import Link from 'next/link';
import { getRedis } from '@/lib/redis';
import { getTrackerCardDefinitions, getTrackerDirectoryStats, getTrackerDirectoryStatsSnapshot, getTrackerTotalSlots } from '@/lib/tracker-data';
import { trackers } from '@/lib/trackers';
import { serializedCatalog } from '@/lib/serialized-catalog';
import ReferenceLinks from '@/components/ReferenceLinks';
import AffiliateDisclosureNotice from '@/components/AffiliateDisclosureNotice';
import AffiliateOutboundLink from '@/components/AffiliateOutboundLink';
import { buildBreadcrumbJsonLd, buildTrackerDirectoryJsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type DirectoryStats = ReturnType<typeof getTrackerDirectoryStats>;

function getNumberedLabel(entry: (typeof serializedCatalog)[number]) {
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

function getDateLabel(entry: (typeof serializedCatalog)[number]) {
  return entry.releaseMonth || entry.releaseYear || 'TBD';
}

const trackingModeLabels: Record<(typeof serializedCatalog)[number]['trackingMode'], string> = {
  'single-card': 'Single card',
  'multi-card-treatment': 'Multi-card',
  'variant-card': 'Variants',
  'promo-series': 'Promo series',
};

async function getDirectoryStats() {
  try {
    const redis = getRedis();
    const liveTrackers = trackers.filter((tracker) => tracker.status === 'live');
    const entries = await Promise.all(liveTrackers.map(async (tracker) => {
      return [tracker.slug, await getTrackerDirectoryStatsSnapshot(redis, tracker)] as const;
    }));

    return Object.fromEntries(entries) as Record<string, DirectoryStats>;
  } catch (error) {
    console.error('Error loading tracker directory stats:', error);
    return {} as Record<string, DirectoryStats>;
  }
}

export default async function TrackersPage() {
  const directoryStats = await getDirectoryStats();
  const liveTrackers = trackers.filter((tracker) => tracker.status === 'live');

  return (
    <main className="min-h-screen px-6 py-8 md:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildTrackerDirectoryJsonLd(liveTrackers)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd([
          { name: 'MTG Trackers', path: '/' },
          { name: 'Trackers', path: '/trackers' },
        ])) }}
      />
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8 flex flex-col gap-3 border-b border-ring-gold/30 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/" className="text-sm text-ring-gold hover:text-yellow-400">
              &larr; MTG Trackers
            </Link>
            <h1 className="mt-3 text-4xl font-bold text-ring-gold">Trackers</h1>
          </div>
          <p className="max-w-xl text-sm leading-6 text-ring-light/75">
            Each tracker has its own serial range, Redis key, submit flow, stats, and source-quality metadata.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {trackers.map((tracker) => {
            const disabled = tracker.status === 'planned';
            const stats = directoryStats[tracker.slug];
            const foundCount = stats?.foundCount || 0;
            const pendingReportCount = stats?.pendingReportCount || 0;
            const cardDefinitionCount = getTrackerCardDefinitions(tracker).length;
            const totalSlots = getTrackerTotalSlots(tracker);
            const foundPercentage = totalSlots > 0 ? (foundCount / totalSlots) * 100 : 0;
            const quantityLabel = cardDefinitionCount > 1
              ? `${totalSlots.toLocaleString()} slots (${tracker.total.toLocaleString()} each)`
              : tracker.total.toLocaleString();

            return (
              <article key={tracker.slug} className="rounded-lg border border-ring-gold/40 bg-ring-dark/80 p-5">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl font-bold text-ring-gold">{tracker.title}</h2>
                  <span className="rounded border border-ring-gold/30 px-2 py-1 text-xs uppercase text-ring-light/70">
                    {tracker.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-ring-teal">{tracker.subtitle}</p>
                <p className="mt-4 text-sm leading-6 text-ring-light/75">{tracker.description}</p>
                <dl className="mt-4 space-y-1 text-xs text-ring-light/70">
                  {tracker.setName && (
                    <div className="flex justify-between gap-4">
                      <dt>Set</dt>
                      <dd className="text-right">{tracker.setName}</dd>
                    </div>
                  )}
                  {tracker.releaseName && (
                    <div className="flex justify-between gap-4">
                      <dt>Release</dt>
                      <dd className="text-right">{tracker.releaseName}</dd>
                    </div>
                  )}
                  {tracker.cardType && (
                    <div className="flex justify-between gap-4">
                      <dt>Type</dt>
                      <dd className="text-right">{tracker.cardType}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt>Serialized Qty</dt>
                    <dd>{quantityLabel}</dd>
                  </div>
                  {cardDefinitionCount > 1 && (
                    <div className="flex justify-between gap-4">
                      <dt>Tracked Cards</dt>
                      <dd>{cardDefinitionCount}</dd>
                    </div>
                  )}
                  {!disabled && (
                    <>
                      <div className="flex justify-between gap-4">
                        <dt>Located</dt>
                        <dd>{foundCount}/{totalSlots}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Pending Reports</dt>
                        <dd>{pendingReportCount}</dd>
                      </div>
                    </>
                  )}
                </dl>
                {!disabled && (
                  <div className="mt-4">
                    <div className="h-2 overflow-hidden rounded bg-ring-light/10">
                      <div
                        className="h-full rounded bg-ring-gold"
                        style={{ width: `${Math.min(100, foundPercentage)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-ring-light/55">
                      {foundPercentage.toFixed(1)}% located - {stats?.confirmedCount || 0} confirmed
                    </p>
                  </div>
                )}
                <ReferenceLinks links={tracker.referenceLinks} compact />
                {(tracker.affiliateLinks || []).length > 0 && (
                  <div className="mt-5 border-t border-ring-gold/20 pt-4">
                    <div className="mb-3">
                      <AffiliateDisclosureNotice links={tracker.affiliateLinks} compact />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(tracker.affiliateLinks || []).slice(0, 3).map((link) => (
                        <AffiliateOutboundLink
                          key={`${link.merchant}-${link.href}`}
                          link={link}
                          trackerSlug={tracker.slug}
                          placement="tracker-directory"
                          className="inline-flex min-h-9 items-center rounded border border-ring-gold/35 px-3 py-2 text-xs font-bold text-ring-gold transition-colors hover:border-ring-gold hover:bg-ring-gold hover:text-ring-dark"
                        >
                          <span>{link.merchant}</span>
                          <span className="ml-2 rounded border border-current/25 px-1.5 py-0.5 text-[0.65rem] uppercase opacity-75">
                            {link.intent.replace('-', ' ')}
                          </span>
                        </AffiliateOutboundLink>
                      ))}
                    </div>
                  </div>
                )}
                {disabled ? (
                  <span className="mt-5 inline-flex h-10 items-center rounded border border-ring-light/20 px-4 text-sm font-bold text-ring-light/50">
                    Coming later
                  </span>
                ) : (
                  <Link
                    href={tracker.href}
                    className="mt-5 inline-flex h-10 items-center rounded bg-ring-gold px-4 text-sm font-bold text-ring-dark transition-colors hover:bg-yellow-400"
                  >
                    Open
                  </Link>
                )}
              </article>
            );
          })}
        </div>

        <section className="mt-12 border-t border-ring-gold/30 pt-8">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-ring-gold">Serialized Scaffold Queue</h2>
              <p className="mt-2 text-sm text-ring-light/70">
                Researched serialized MTG treatments to convert into tracker pages.
              </p>
            </div>
            <Link
              href="https://scryfall.com/search?q=is%3Aserialized&unique=prints&order=set"
              className="text-sm text-ring-gold underline-offset-4 hover:text-yellow-400 hover:underline"
            >
              Scryfall source query
            </Link>
          </div>

          <div className="overflow-x-auto rounded-lg border border-ring-gold/30">
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
                </tr>
              </thead>
              <tbody className="divide-y divide-ring-gold/15 text-ring-light/80">
                {serializedCatalog.map((entry) => (
                  <tr key={entry.slug} className="align-top transition-colors hover:bg-ring-gold/5">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ring-light">{entry.title}</div>
                      <div className="mt-1 max-w-md text-xs leading-5 text-ring-light/55">{entry.treatment}</div>
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
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

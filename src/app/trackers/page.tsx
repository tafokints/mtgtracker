import Link from 'next/link';
import DirectoryCtaLink from '@/components/DirectoryCtaLink';
import { buildBreadcrumbJsonLd, buildTrackerDirectoryJsonLd } from '@/lib/seo';
import { serializedCatalog } from '@/lib/serialized-catalog';
import { getCatalogPrintings, getPrintingCoverage } from '@/lib/serialized-printings';
import {
  getLiveTrackers,
  getPrintingTracker,
  trackers,
  type TrackerSummary,
} from '@/lib/trackers';
import {
  getTrackerCardDeepLinkParams,
  getTrackerCardDefinitions,
  getTrackerDirectoryStats,
  getTrackerDirectoryStatsSnapshot,
  getTrackerTotalSlots,
} from '@/lib/tracker-data';
import { getRedis } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type DirectoryStats = ReturnType<typeof getTrackerDirectoryStats>;

function getNumberedLabel(entry: (typeof serializedCatalog)[number]) {
  if (entry.serialVariants?.length) {
    const totals = entry.serialVariants.map((variant) => variant.total);
    return `${Math.min(...totals)}-${Math.max(...totals)} by variant`;
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
  const reportingTrackers = trackers.filter((tracker) => tracker.status === 'live');
  const allLiveTrackers = getLiveTrackers();
  const coverage = getPrintingCoverage();
  const reportingSlots = reportingTrackers.reduce((total, tracker) => total + getTrackerTotalSlots(tracker), 0);
  const allTrackedSlots = allLiveTrackers.reduce((total, tracker) => total + getTrackerTotalSlots(tracker), 0);
  const locatedCards = Object.values(directoryStats).reduce((total, stats) => total + (stats?.foundCount || 0), 0);
  const openReports = Object.values(directoryStats).reduce((total, stats) => total + (stats?.pendingReportCount || 0), 0);

  return (
    <main className="min-h-screen px-6 py-8 md:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildTrackerDirectoryJsonLd(reportingTrackers)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd([
          { name: 'MTG Trackers', path: '/' },
          { name: 'Trackers', path: '/trackers' },
        ])) }}
      />

      <div className="mx-auto w-full max-w-7xl">
        <header className="border-b border-white/10 pb-8">
          <Link href="/" className="text-sm font-semibold text-ring-gold underline-offset-4 hover:text-yellow-300 hover:underline">
            MTG Trackers
          </Link>
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <h1 className="text-4xl font-semibold leading-tight text-ring-light md:text-5xl">Trackers</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-ring-light/68">
                Every released English serialized printing has a live tracker page. The priority hubs below collect community reporting for the most active treatments; the full live directory follows.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/serialized-mtg-catalog"
                className="inline-flex min-h-11 items-center rounded-sm bg-ring-light px-5 py-3 text-sm font-semibold text-ring-dark transition-colors hover:bg-white"
              >
                Full Catalog
              </Link>
              <Link
                href="/sets"
                className="inline-flex min-h-11 items-center rounded-sm border border-ring-light/25 px-5 py-3 text-sm font-semibold text-ring-light transition-colors hover:border-ring-light/55 hover:bg-white/5"
              >
                Browse Sets
              </Link>
            </div>
          </div>
        </header>

        <section aria-label="Tracker summary" className="grid grid-cols-2 gap-x-6 border-b border-white/10 py-1 md:grid-cols-4">
          <Metric label="Live tracker pages" value={allLiveTrackers.length.toLocaleString()} />
          <Metric label="Tracked serial slots" value={allTrackedSlots.toLocaleString()} />
          <Metric label="Located" value={locatedCards.toLocaleString()} />
          <Metric label="Open reports" value={openReports.toLocaleString()} />
        </section>

        <section aria-labelledby="live-trackers" className="pt-10">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-ring-teal">Community reporting</p>
              <h2 id="live-trackers" className="mt-2 text-2xl font-semibold text-ring-light md:text-3xl">Priority reporting hubs</h2>
            </div>
            <p className="text-sm text-ring-light/56">
              {reportingSlots.toLocaleString()} serial slots with discovery stats
            </p>
          </div>

          <div className="mt-5 divide-y divide-white/10 border-y border-white/10">
            {reportingTrackers.map((tracker) => (
              <TrackerRow key={tracker.slug} tracker={tracker} stats={directoryStats[tracker.slug]} />
            ))}
          </div>
        </section>

        <section aria-labelledby="all-live-trackers" className="mt-12 border-t border-white/10 pt-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-ring-teal">Live directory</p>
              <h2 id="all-live-trackers" className="mt-2 text-2xl font-semibold text-ring-light md:text-3xl">All live tracker pages</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-ring-light/62">
                {allLiveTrackers.length.toLocaleString()} active pages are ready for serial lookups and submissions, including generated card-level trackers for the broader catalog.
              </p>
            </div>
            <Link
              href="/serialized-mtg-catalog"
              className="text-sm font-semibold text-ring-gold underline-offset-4 hover:text-yellow-300 hover:underline"
            >
              Open catalog
            </Link>
          </div>

          <div className="mt-5 overflow-x-auto border-y border-white/10">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase text-ring-light/45">
                <tr>
                  <th className="px-4 py-3 font-semibold">Tracker</th>
                  <th className="px-4 py-3 font-semibold">Set</th>
                  <th className="px-4 py-3 font-semibold">Scope</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-ring-light/72">
                {allLiveTrackers.map((tracker) => (
                  <LiveTrackerTableRow key={tracker.slug} tracker={tracker} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12 border-t border-white/10 pt-10">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-ring-teal">Reference catalog</p>
              <h2 className="mt-2 text-2xl font-semibold text-ring-light md:text-3xl">Serialized treatments</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ring-light/62">
                {serializedCatalog.length.toLocaleString()} treatments covering {coverage.all.toLocaleString()} serialized printings. Use this table to pick a release, then drill into individual card pages.
              </p>
            </div>
            <Link
              href="https://scryfall.com/search?q=is%3Aserialized&unique=prints&order=set"
              className="text-sm font-semibold text-ring-gold underline-offset-4 hover:text-yellow-300 hover:underline"
            >
              Scryfall source query
            </Link>
          </div>

          <div className="overflow-x-auto border-y border-white/10">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase text-ring-light/45">
                <tr>
                  <th className="px-4 py-3 font-semibold">Treatment</th>
                  <th className="px-4 py-3 font-semibold">Release</th>
                  <th className="px-4 py-3 font-semibold">Cards</th>
                  <th className="px-4 py-3 font-semibold">Numbered</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-ring-light/72">
                {serializedCatalog.map((entry) => (
                  <tr key={entry.slug} className="align-top transition-colors hover:bg-white/[0.035]">
                    <td className="px-4 py-3">
                      <Link href={`/serialized-mtg-catalog/${entry.slug}`} className="font-semibold text-ring-light hover:text-ring-gold">
                        {entry.title}
                      </Link>
                      <div className="mt-1 max-w-lg text-xs leading-5 text-ring-light/48">{entry.treatment}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="font-semibold text-ring-teal">{entry.setCode}</div>
                      <div className="mt-1 text-xs text-ring-light/48">{getDateLabel(entry)}</div>
                    </td>
                    <td className="px-4 py-3">{entry.cardCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs leading-5">{getNumberedLabel(entry)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-sm border border-white/15 px-2 py-1 text-xs uppercase text-ring-light/58">
                        {getCatalogPrintings(entry.slug).some((printing) => getPrintingTracker(printing)?.status === 'live') ? 'Open' : entry.status === 'announced' ? 'Announced' : 'Reference'}
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-4">
      <p className="text-xs font-semibold uppercase text-ring-light/45">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ring-light">{value}</p>
    </div>
  );
}

function TrackerRow({ tracker, stats }: { tracker: TrackerSummary; stats?: DirectoryStats }) {
  const cardDefinitionCount = getTrackerCardDefinitions(tracker).length;
  const totalSlots = getTrackerTotalSlots(tracker);
  const foundCount = stats?.foundCount || 0;
  const pendingReportCount = stats?.pendingReportCount || 0;
  const foundPercentage = totalSlots > 0 ? (foundCount / totalSlots) * 100 : 0;
  const latestDiscovery = stats?.latestDiscovery;
  const latestDiscoveryHref = latestDiscovery
    ? `${tracker.href}?${getTrackerCardDeepLinkParams(tracker, {
      serialNumber: latestDiscovery.serialNumber,
      cardSlug: latestDiscovery.cardSlug,
    }).toString()}`
    : undefined;
  const scopeLabel = cardDefinitionCount > 1
    ? `${cardDefinitionCount.toLocaleString()} cards / ${totalSlots.toLocaleString()} serials`
    : `${totalSlots.toLocaleString()} serials`;

  return (
    <article className="grid gap-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.45fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-words text-xl font-semibold text-ring-light">{tracker.displayTitle || tracker.title}</h3>
          <span className="rounded-sm border border-ring-teal/35 px-2 py-1 text-xs font-semibold uppercase text-ring-teal">
            Live
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-ring-light/60">
          {tracker.subtitle}
          {tracker.setName ? ` - ${tracker.setName}` : ''}
        </p>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-4 text-sm">
          <span className="text-ring-light/58">{scopeLabel}</span>
          <span className="font-semibold text-ring-light">{foundCount.toLocaleString()} found</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-ring-light/10">
          <div
            className="h-full rounded-sm bg-ring-teal"
            style={{ width: `${Math.min(100, foundPercentage)}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ring-light/48">
          <span>{foundPercentage.toFixed(1)}% located</span>
          <span>{stats?.confirmedCount || 0} confirmed</span>
          <span>{pendingReportCount.toLocaleString()} pending</span>
        </div>
        {latestDiscovery && latestDiscoveryHref && (
          <DirectoryCtaLink
            href={latestDiscoveryHref}
            trackerSlug={tracker.slug}
            action="latest-discovery"
            className="mt-3 inline-flex text-xs font-semibold text-ring-gold underline-offset-4 hover:text-yellow-300 hover:underline"
          >
            Latest: {latestDiscovery.label}
          </DirectoryCtaLink>
        )}
      </div>

      <div className="flex flex-wrap gap-2 lg:justify-end">
        <DirectoryCtaLink
          href={tracker.href}
          trackerSlug={tracker.slug}
          action="open-tracker"
          className="inline-flex min-h-10 items-center rounded-sm bg-ring-light px-4 py-2 text-sm font-semibold text-ring-dark transition-colors hover:bg-white"
        >
          Open
        </DirectoryCtaLink>
        <DirectoryCtaLink
          href={`${tracker.href}/submit`}
          trackerSlug={tracker.slug}
          action="report-find"
          className="inline-flex min-h-10 items-center rounded-sm border border-ring-teal/45 px-4 py-2 text-sm font-semibold text-ring-teal transition-colors hover:bg-ring-teal hover:text-ring-dark"
        >
          Report
        </DirectoryCtaLink>
      </div>
    </article>
  );
}

function LiveTrackerTableRow({ tracker }: { tracker: TrackerSummary }) {
  const cardDefinitionCount = getTrackerCardDefinitions(tracker).length;
  const totalSlots = getTrackerTotalSlots(tracker);
  const scopeLabel = cardDefinitionCount > 1
    ? `${cardDefinitionCount.toLocaleString()} cards / ${totalSlots.toLocaleString()} serials`
    : `${totalSlots.toLocaleString()} serials`;

  return (
    <tr className="align-top transition-colors hover:bg-white/[0.035]">
      <td className="px-4 py-3">
        <Link href={tracker.href} className="font-semibold text-ring-light hover:text-ring-gold">
          {tracker.displayTitle || tracker.title}
        </Link>
        <div className="mt-1 max-w-lg text-xs leading-5 text-ring-light/48">{tracker.subtitle}</div>
      </td>
      <td className="px-4 py-3 text-xs leading-5 text-ring-light/58">
        {tracker.setName || 'Unknown set'}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-xs leading-5 text-ring-light/58">
        {scopeLabel}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex rounded-sm border border-white/15 px-2 py-1 text-xs uppercase text-ring-light/58">
          {tracker.catalogGenerated ? 'Card tracker' : 'Hub'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-3 text-xs font-semibold">
          <DirectoryCtaLink
            href={tracker.href}
            trackerSlug={tracker.slug}
            action="open-tracker"
            className="text-ring-gold underline-offset-4 hover:text-yellow-300 hover:underline"
          >
            Open
          </DirectoryCtaLink>
          <DirectoryCtaLink
            href={`${tracker.href}/submit`}
            trackerSlug={tracker.slug}
            action="report-find"
            className="text-ring-teal underline-offset-4 hover:underline"
          >
            Report
          </DirectoryCtaLink>
        </div>
      </td>
    </tr>
  );
}

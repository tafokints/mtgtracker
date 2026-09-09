import Link from 'next/link';
import DirectoryCtaLink from '@/components/DirectoryCtaLink';
import { getPublicRecentDiscoveries } from '@/lib/recent-discoveries';
import { buildBreadcrumbJsonLd } from '@/lib/seo';
import {
  catalogCheckedAt,
  getPrintingCoverage,
  isReleasedPrinting,
  printingPath,
  printingReleaseDate,
  printingTitle,
  printingTotal,
  serializedPrintings,
  serializedSets,
} from '@/lib/serialized-printings';
import { getLiveTrackers, getPrintingTrackerHref, trackers, type TrackerSummary } from '@/lib/trackers';
import {
  getTrackerCardDefinitions,
  getTrackerCardDeepLinkParams,
  getTrackerDirectoryStats,
  getTrackerDirectoryStatsSnapshot,
  getTrackerTotalSlots,
  type RecentTrackerDiscovery,
} from '@/lib/tracker-data';
import { getRedis } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type DirectoryStats = ReturnType<typeof getTrackerDirectoryStats>;

async function getRecentDiscoveries() {
  try {
    return await getPublicRecentDiscoveries(5);
  } catch (error) {
    console.error('Error loading homepage discoveries:', error);
    return [];
  }
}

async function getSpotlightStats(spotlightTrackers: TrackerSummary[]) {
  try {
    const redis = getRedis();
    const entries = await Promise.all(spotlightTrackers.map(async (tracker) => {
      return [tracker.slug, await getTrackerDirectoryStatsSnapshot(redis, tracker)] as const;
    }));

    return Object.fromEntries(entries) as Record<string, DirectoryStats>;
  } catch (error) {
    console.error('Error loading homepage tracker stats:', error);
    return {} as Record<string, DirectoryStats>;
  }
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function getLatestReleasedPrintings() {
  return serializedPrintings
    .filter((printing) => printing.language === 'en' && isReleasedPrinting(printing))
    .toSorted((a, b) => printingReleaseDate(b).localeCompare(printingReleaseDate(a)))
    .slice(0, 8);
}

function getSetCoverageRows() {
  return serializedSets
    .map((set) => {
      const catalogSlugs = new Set(set.entries.map((entry) => entry.slug));
      const printings = serializedPrintings.filter((printing) => catalogSlugs.has(printing.catalogSlug));
      const latestRelease = printings.reduce((latest, printing) => {
        const releasedAt = printingReleaseDate(printing);
        return releasedAt > latest ? releasedAt : latest;
      }, '');

      return {
        ...set,
        printingCount: printings.length,
        latestRelease,
      };
    })
    .toSorted((a, b) => b.latestRelease.localeCompare(a.latestRelease))
    .slice(0, 6);
}

export default async function HomePage() {
  const spotlightTrackers = trackers.filter((tracker) => tracker.status === 'live');
  const liveTrackers = getLiveTrackers();
  const plannedTrackers = trackers.filter((tracker) => tracker.status === 'planned');
  const coverage = getPrintingCoverage();
  const recentDiscoveries = await getRecentDiscoveries();
  const spotlightStats = await getSpotlightStats(spotlightTrackers);
  const latestPrintings = getLatestReleasedPrintings();
  const setCoverageRows = getSetCoverageRows();
  const activeSerialSlots = liveTrackers.reduce((total, tracker) => total + getTrackerTotalSlots(tracker), 0);
  const reportingSlots = spotlightTrackers.reduce((total, tracker) => total + getTrackerTotalSlots(tracker), 0);
  const locatedSpotlightCards = Object.values(spotlightStats).reduce((total, stats) => total + (stats?.foundCount || 0), 0);
  const openReports = Object.values(spotlightStats).reduce((total, stats) => total + (stats?.pendingReportCount || 0), 0);

  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd([{ name: 'MTG Trackers', path: '/' }])) }}
      />

      <section className="border-b border-white/10 px-6 py-10 md:px-10 lg:py-14">
        <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)] lg:items-start">
          <div className="min-w-0">
            <div>
              <p className="text-sm font-semibold text-ring-teal">MTG Trackers</p>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight text-ring-light sm:text-5xl lg:text-[3.75rem]">
                A public ledger for serialized Magic cards.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-ring-light/72 md:text-lg">
                Browse known serialized printings, open live trackers, and submit evidence when cards surface in collections, sales, grading reports, or public posts.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/serialized-mtg-catalog"
                className="inline-flex min-h-11 items-center justify-center rounded-sm bg-ring-light px-5 py-3 text-sm font-semibold text-ring-dark transition-colors hover:bg-white"
              >
                Browse Catalog
              </Link>
              <Link
                href="/trackers"
                className="inline-flex min-h-11 items-center justify-center rounded-sm border border-ring-light/25 px-5 py-3 text-sm font-semibold text-ring-light transition-colors hover:border-ring-light/55 hover:bg-white/5"
              >
                Open Trackers
              </Link>
            </div>

            <div className="mt-10 border-y border-white/10 py-1">
              <div className="grid grid-cols-2 gap-x-6 md:grid-cols-4">
                <Metric label="Serialized printings" value={coverage.all.toLocaleString()} detail={`${coverage.releasedEnglish.toLocaleString()} released English`} />
                <Metric label="Set families" value={coverage.sets.toLocaleString()} detail="cataloged and routed" />
                <Metric label="Live tracker pages" value={liveTrackers.length.toLocaleString()} detail={`${activeSerialSlots.toLocaleString()} serial slots`} />
                <Metric label="Data checked" value={formatDateLabel(catalogCheckedAt)} detail="Scryfall sync date" compact />
              </div>
            </div>
          </div>

          <aside className="border-t border-white/10 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-ring-teal">Status</p>
                <h2 className="mt-2 text-2xl font-semibold text-ring-light">Reporting pulse</h2>
              </div>
              <span className="rounded-sm border border-ring-teal/35 px-2.5 py-1 text-xs font-semibold uppercase text-ring-teal">
                Live
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-x-6 border-y border-white/10 py-1">
              <Metric label="Spotlight serials" value={reportingSlots.toLocaleString()} detail="community hubs" />
              <Metric label="Located" value={locatedSpotlightCards.toLocaleString()} detail="public finds" />
              <Metric label="Open reports" value={openReports.toLocaleString()} detail="awaiting review" />
              <Metric label="New queues" value={plannedTrackers.length === 0 ? '0' : plannedTrackers.length.toLocaleString()} detail="planned hubs" />
            </div>

            <div className="mt-6">
              <p className="text-sm font-semibold text-ring-light/55">Priority lanes</p>
              <div className="mt-3 border-t border-white/10">
                <QuickLink href="/trackers/golden-chocobo" label="Golden Chocobo" detail="Final Fantasy serials are active." />
                <QuickLink href="/trackers/one-ring" label="The One Ring" detail="Poster edition /100 tracker." />
                <QuickLink href="/sets" label="Serialized sets" detail="Browse by release family." />
                <QuickLink href="/verification-guide" label="Verification guide" detail="How reports become trusted records." />
              </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-6 py-12 md:px-10">
        <section aria-labelledby="live-reporting-hubs">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-ring-teal">Community reporting</p>
              <h2 id="live-reporting-hubs" className="mt-2 text-2xl font-semibold text-ring-light md:text-3xl">Live reporting hubs</h2>
            </div>
            <Link href="/trackers" className="text-sm font-semibold text-ring-gold underline-offset-4 hover:text-yellow-300 hover:underline">
              View every tracker
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {spotlightTrackers.map((tracker) => (
              <TrackerCard key={tracker.slug} tracker={tracker} stats={spotlightStats[tracker.slug]} />
            ))}
          </div>
        </section>

        <RecentActivity discoveries={recentDiscoveries} />

        <section aria-labelledby="catalog-coverage" className="border-t border-white/10 pt-10">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <p className="text-sm font-semibold text-ring-teal">Catalog coverage</p>
              <h2 id="catalog-coverage" className="mt-2 text-2xl font-semibold text-ring-light md:text-3xl">Pages for every known serialized printing</h2>
              <p className="mt-4 text-sm leading-6 text-ring-light/68">
                The catalog currently covers {coverage.all.toLocaleString()} serialized printings across {coverage.sets.toLocaleString()} set families, including {coverage.otherLanguages.toLocaleString()} non-English or special-language records.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/sets"
                  className="inline-flex min-h-10 items-center rounded-sm border border-ring-light/25 px-4 py-2 text-sm font-semibold text-ring-light transition-colors hover:border-ring-light/55 hover:bg-white/5"
                >
                  Browse Sets
                </Link>
                <Link
                  href="/discoveries"
                  className="inline-flex min-h-10 items-center rounded-sm border border-ring-teal/45 px-4 py-2 text-sm font-semibold text-ring-teal transition-colors hover:bg-ring-teal hover:text-ring-dark"
                >
                  Recent Discoveries
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {setCoverageRows.map((set) => (
                <Link
                  key={set.slug}
                  href={`/sets/${set.slug}`}
                  className="border-t border-white/10 py-4 transition-colors hover:border-ring-gold/45"
                >
                  <p className="text-xs font-semibold uppercase text-ring-teal">{set.latestRelease ? formatDateLabel(set.latestRelease) : 'Release TBD'}</p>
                  <h3 className="mt-2 text-lg font-semibold text-ring-light">{set.title}</h3>
                  <p className="mt-3 text-sm text-ring-light/58">
                    {set.entries.length.toLocaleString()} treatments / {set.printingCount.toLocaleString()} printings
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="latest-printings" className="border-t border-white/10 pt-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-ring-teal">Fresh catalog pages</p>
              <h2 id="latest-printings" className="mt-2 text-2xl font-semibold text-ring-light md:text-3xl">Newest released serialized cards</h2>
            </div>
            <Link href="/serialized-mtg-catalog" className="text-sm font-semibold text-ring-gold underline-offset-4 hover:text-yellow-300 hover:underline">
              Open catalog
            </Link>
          </div>

          <div className="mt-5 overflow-hidden border-y border-white/10">
            <div className="grid grid-cols-1 divide-y divide-white/10 md:grid-cols-2 md:divide-x md:divide-y-0">
              {latestPrintings.slice(0, 4).map((printing) => (
                <PrintingFeature key={printing.id} printing={printing} />
              ))}
            </div>
            <div className="grid grid-cols-1 divide-y divide-white/10 border-t border-white/10 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
              {latestPrintings.slice(4).map((printing) => (
                <PrintingLink key={printing.id} printing={printing} />
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="trust-workflow" className="border-t border-white/10 pt-10">
          <div className="grid gap-4 md:grid-cols-3">
            <WorkflowStep
              label="1"
              title="Catalog the printing"
              body="Every released serialized printing gets a canonical page with set, collector number, print run, language, source, and marketplace routes."
            />
            <WorkflowStep
              label="2"
              title="Collect evidence"
              body="Collectors can report serials with source links, images, dates, prices, and grading details without losing the original context."
            />
            <WorkflowStep
              label="3"
              title="Publish the record"
              body="Reviewed discoveries become public serial records that can be browsed, shared, corrected, and compared over time."
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, detail, compact = false }: { label: string; value: string; detail: string; compact?: boolean }) {
  return (
    <div className="py-4">
      <p className="text-xs font-semibold uppercase text-ring-light/48">{label}</p>
      <p className={`mt-2 font-semibold text-ring-light ${compact ? 'text-lg' : 'text-2xl'}`}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-ring-light/60">{detail}</p>
    </div>
  );
}

function QuickLink({ href, label, detail }: { href: string; label: string; detail: string }) {
  return (
    <Link href={href} className="block border-b border-white/10 py-3 transition-colors hover:border-ring-teal/55">
      <span className="block text-sm font-semibold text-ring-light">{label}</span>
      <span className="mt-1 block text-xs leading-5 text-ring-light/62">{detail}</span>
    </Link>
  );
}

function RecentActivity({ discoveries }: { discoveries: RecentTrackerDiscovery[] }) {
  return (
    <section aria-labelledby="recent-discoveries" className="border-t border-white/10 pt-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-ring-teal">Verified movement</p>
          <h2 id="recent-discoveries" className="mt-2 text-2xl font-semibold text-ring-light md:text-3xl">Recent discoveries</h2>
        </div>
        <Link href="/discoveries" className="text-sm font-semibold text-ring-gold underline-offset-4 hover:text-yellow-300 hover:underline">
          View all discoveries
        </Link>
      </div>

      {discoveries.length === 0 ? (
        <div className="mt-5 border-y border-white/10 py-5">
          <p className="text-sm leading-6 text-ring-light/64">
            No public discoveries have been confirmed yet. New finds will appear here after admin review.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-5">
          {discoveries.map((discovery) => (
            <Link
              key={`${discovery.trackerSlug}-${discovery.cardId}-${discovery.serialNumber}`}
              href={discovery.detailHref}
              className="border-t border-white/10 py-4 transition-colors hover:border-ring-gold/45"
            >
              <p className="text-xs font-semibold uppercase text-ring-teal">{discovery.trackerTitle}</p>
              <h3 className="mt-2 text-lg font-semibold text-ring-light">{discovery.label}</h3>
              <p className="mt-2 text-xs text-ring-light/60">
                {discovery.verificationStatus.replace('-', ' ')}
                {discovery.sourceType ? ` via ${discovery.sourceType.replace('-', ' ')}` : ''}
              </p>
              <div className="mt-4 space-y-1 text-xs text-ring-light/70">
                {discovery.foundBy && <p>Found by {discovery.foundBy}</p>}
                {discovery.dateFound && <p>{discovery.dateFound}</p>}
                {discovery.price !== undefined && <p>${discovery.price.toLocaleString()}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function TrackerCard({ tracker, stats }: { tracker: TrackerSummary; stats?: DirectoryStats }) {
  const referenceImage = tracker.cardDefinitions?.[0]?.referenceImage || tracker.referenceImage;
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
  const quantityLabel = cardDefinitionCount > 1
    ? `${totalSlots.toLocaleString()} serial slots across ${cardDefinitionCount.toLocaleString()} cards`
    : `${tracker.total.toLocaleString()} serials`;

  return (
    <article className="grid gap-4 border-t border-white/10 py-5 md:grid-cols-[auto_minmax(0,1fr)]">
      {referenceImage && (
        // Reference artwork identifies the printing; it is not discovery evidence.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={referenceImage}
          alt={`${tracker.cardDefinitions?.[0]?.title || tracker.title} reference printing`}
          width={112}
          height={156}
          loading="lazy"
          className="aspect-[112/156] w-24 shrink-0 rounded-sm border border-white/10 bg-black/25 object-contain p-1 md:w-28"
        />
      )}
      <div className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-ring-teal">{tracker.subtitle}</p>
            <h3 className="mt-2 break-words text-xl font-semibold text-ring-light">{tracker.displayTitle || tracker.title}</h3>
          </div>
          <span className="inline-flex w-fit shrink-0 rounded-sm border border-ring-teal/35 px-2.5 py-1 text-xs font-semibold uppercase text-ring-teal">
            Reporting open
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-ring-light/68">{tracker.description}</p>

        <div className="mt-4 grid gap-3 text-xs text-ring-light/58 sm:grid-cols-3">
          <span>{quantityLabel}</span>
          {tracker.setName && <span>{tracker.setName}</span>}
          <span>{foundCount.toLocaleString()} located / {pendingReportCount.toLocaleString()} pending</span>
        </div>

        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-sm bg-ring-light/10">
            <div
              className="h-full rounded-sm bg-ring-teal"
              style={{ width: `${Math.min(100, foundPercentage)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-ring-light/55">
            {foundPercentage.toFixed(1)}% located{stats?.confirmedCount ? ` - ${stats.confirmedCount.toLocaleString()} confirmed` : ''}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <DirectoryCtaLink
            href={tracker.href}
            trackerSlug={tracker.slug}
            action="open-tracker"
            className="inline-flex min-h-10 items-center rounded-sm bg-ring-light px-4 py-2 text-sm font-semibold text-ring-dark transition-colors hover:bg-white"
          >
            Open Tracker
          </DirectoryCtaLink>
          <DirectoryCtaLink
            href={`${tracker.href}/submit`}
            trackerSlug={tracker.slug}
            action="report-find"
            className="inline-flex min-h-10 items-center rounded-sm border border-ring-teal/45 px-4 py-2 text-sm font-semibold text-ring-teal transition-colors hover:bg-ring-teal hover:text-ring-dark"
          >
            Report a Find
          </DirectoryCtaLink>
          {latestDiscovery && latestDiscoveryHref && (
            <DirectoryCtaLink
              href={latestDiscoveryHref}
              trackerSlug={tracker.slug}
              action="latest-discovery"
              className="inline-flex min-h-10 items-center rounded-sm border border-ring-light/20 px-4 py-2 text-sm font-semibold text-ring-light/72 transition-colors hover:border-ring-light/50 hover:text-ring-light"
            >
              Latest: {latestDiscovery.label}
            </DirectoryCtaLink>
          )}
        </div>
      </div>
    </article>
  );
}

function PrintingFeature({ printing }: { printing: (typeof serializedPrintings)[number] }) {
  const trackerHref = getPrintingTrackerHref(printing);

  return (
    <article className="grid gap-4 p-4 sm:grid-cols-[5rem_minmax(0,1fr)] sm:p-5">
      {printing.referenceImage && (
        // Reference artwork identifies the printing; it is not discovery evidence.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={printing.referenceImage}
          alt={`${printingTitle(printing)} reference printing`}
          width={80}
          height={112}
          loading="lazy"
          className="aspect-[80/112] w-20 rounded-sm border border-white/10 bg-black/25 object-contain p-1"
        />
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-ring-teal">{formatDateLabel(printingReleaseDate(printing))}</p>
        <h3 className="mt-2 break-words text-lg font-semibold text-ring-light">{printingTitle(printing)}</h3>
        <p className="mt-2 text-xs leading-5 text-ring-light/62">
          {printing.setCode} #{printing.collectorNumber} / {printingTotal(printing).toLocaleString()} copies
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
          <Link href={printingPath(printing)} className="text-ring-teal underline-offset-4 hover:underline">
            Catalog Page
          </Link>
          {trackerHref && (
            <Link href={trackerHref} className="text-ring-gold underline-offset-4 hover:underline">
              Tracker
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function PrintingLink({ printing }: { printing: (typeof serializedPrintings)[number] }) {
  return (
    <Link href={printingPath(printing)} className="block p-4 transition-colors hover:bg-white/[0.035]">
      <p className="text-xs font-semibold uppercase text-ring-teal">{printing.setCode} #{printing.collectorNumber}</p>
      <h3 className="mt-2 break-words text-sm font-semibold leading-5 text-ring-light">{printingTitle(printing)}</h3>
      <p className="mt-2 text-xs text-ring-light/60">{formatDateLabel(printingReleaseDate(printing))}</p>
    </Link>
  );
}

function WorkflowStep({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <article className="border-t border-white/10 pt-5">
      <p className="text-xs font-semibold uppercase text-ring-teal">Step {label}</p>
      <h2 id={label === '1' ? 'trust-workflow' : undefined} className="mt-3 text-xl font-semibold text-ring-light">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-ring-light/64">{body}</p>
    </article>
  );
}

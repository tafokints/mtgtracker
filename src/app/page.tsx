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

      <section className="border-b border-ring-gold/25 px-6 py-8 md:px-10 lg:py-10">
        <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)] lg:items-stretch">
          <div className="flex min-h-[32rem] flex-col justify-between rounded-lg border border-ring-gold/35 bg-ring-dark/85 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-7 lg:p-8">
            <div>
              <p className="text-sm font-bold uppercase text-ring-teal">Live serialized MTG registry</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight text-ring-gold sm:text-5xl lg:text-6xl">
                Track every serialized Magic card from one public index.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-ring-light/82 md:text-lg">
                MTG Trackers keeps serialized printings, source links, discovery reports, marketplace context, and individual card pages together so collectors can verify what exists and what has surfaced.
              </p>
            </div>

            <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Metric label="Serialized printings" value={coverage.all.toLocaleString()} detail={`${coverage.releasedEnglish.toLocaleString()} released English`} />
                <Metric label="Set families" value={coverage.sets.toLocaleString()} detail="cataloged and routed" />
                <Metric label="Live tracker pages" value={liveTrackers.length.toLocaleString()} detail={`${activeSerialSlots.toLocaleString()} serial slots`} />
                <Metric label="Data checked" value={formatDateLabel(catalogCheckedAt)} detail="Scryfall sync date" compact />
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/serialized-mtg-catalog"
                  className="inline-flex min-h-11 items-center justify-center rounded bg-ring-gold px-5 py-3 text-sm font-bold text-ring-dark transition-colors hover:bg-yellow-400"
                >
                  Browse Full Catalog
                </Link>
                <Link
                  href="/trackers"
                  className="inline-flex min-h-11 items-center justify-center rounded border border-ring-teal/70 px-5 py-3 text-sm font-bold text-ring-teal transition-colors hover:bg-ring-teal hover:text-ring-dark"
                >
                  Open Trackers
                </Link>
              </div>
            </div>
          </div>

          <aside className="rounded-lg border border-ring-teal/35 bg-black/25 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase text-ring-teal">Right now</p>
                <h2 className="mt-2 text-2xl font-bold text-ring-light">Reporting pulse</h2>
              </div>
              <span className="rounded border border-ring-gold/35 px-2.5 py-1 text-xs font-bold uppercase text-ring-gold">
                Live
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Metric label="Spotlight serials" value={reportingSlots.toLocaleString()} detail="community hubs" />
              <Metric label="Located" value={locatedSpotlightCards.toLocaleString()} detail="public finds" />
              <Metric label="Open reports" value={openReports.toLocaleString()} detail="awaiting review" />
              <Metric label="New queues" value={plannedTrackers.length === 0 ? '0' : plannedTrackers.length.toLocaleString()} detail="planned hubs" />
            </div>

            <div className="mt-6 border-t border-ring-gold/20 pt-5">
              <p className="text-sm font-bold uppercase text-ring-light/55">Priority lanes</p>
              <div className="mt-3 grid gap-2">
                <QuickLink href="/trackers/golden-chocobo" label="Golden Chocobo" detail="Final Fantasy serials are active." />
                <QuickLink href="/trackers/one-ring" label="The One Ring" detail="Poster edition /100 tracker." />
                <QuickLink href="/sets" label="Serialized sets" detail="Browse by release family." />
                <QuickLink href="/verification-guide" label="Verification guide" detail="How reports become trusted records." />
              </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-10 md:px-10">
        <section aria-labelledby="live-reporting-hubs">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase text-ring-teal">Community reporting</p>
              <h2 id="live-reporting-hubs" className="mt-2 text-3xl font-bold text-ring-light">Live Reporting Hubs</h2>
            </div>
            <Link href="/trackers" className="text-sm font-bold text-ring-gold underline-offset-4 hover:text-yellow-400 hover:underline">
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

        <section aria-labelledby="catalog-coverage" className="border-t border-ring-gold/25 pt-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <p className="text-sm font-bold uppercase text-ring-teal">Source-of-truth coverage</p>
              <h2 id="catalog-coverage" className="mt-2 text-3xl font-bold text-ring-light">Every Known Serialized Printing Gets a Page</h2>
              <p className="mt-4 text-sm leading-6 text-ring-light/72">
                The catalog currently covers {coverage.all.toLocaleString()} serialized printings across {coverage.sets.toLocaleString()} set families, including {coverage.otherLanguages.toLocaleString()} non-English or special-language records.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href="/sets"
                  className="inline-flex min-h-10 items-center rounded border border-ring-gold/55 px-4 py-2 text-sm font-bold text-ring-gold transition-colors hover:bg-ring-gold hover:text-ring-dark"
                >
                  Browse Sets
                </Link>
                <Link
                  href="/discoveries"
                  className="inline-flex min-h-10 items-center rounded border border-ring-teal/60 px-4 py-2 text-sm font-bold text-ring-teal transition-colors hover:bg-ring-teal hover:text-ring-dark"
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
                  className="rounded border border-ring-gold/25 bg-ring-dark/75 p-4 transition-colors hover:border-ring-gold/70 hover:bg-ring-gold/10"
                >
                  <p className="text-xs font-bold uppercase text-ring-teal">{set.latestRelease ? formatDateLabel(set.latestRelease) : 'Release TBD'}</p>
                  <h3 className="mt-2 text-lg font-bold text-ring-gold">{set.title}</h3>
                  <p className="mt-3 text-sm text-ring-light/70">
                    {set.entries.length.toLocaleString()} treatments / {set.printingCount.toLocaleString()} printings
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="latest-printings" className="border-t border-ring-gold/25 pt-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase text-ring-teal">Fresh catalog pages</p>
              <h2 id="latest-printings" className="mt-2 text-3xl font-bold text-ring-light">Newest Released Serialized Cards</h2>
            </div>
            <Link href="/serialized-mtg-catalog" className="text-sm font-bold text-ring-gold underline-offset-4 hover:text-yellow-400 hover:underline">
              Open catalog
            </Link>
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-ring-gold/30">
            <div className="grid grid-cols-1 divide-y divide-ring-gold/15 bg-ring-dark/75 md:grid-cols-2 md:divide-x md:divide-y-0">
              {latestPrintings.slice(0, 4).map((printing) => (
                <PrintingFeature key={printing.id} printing={printing} />
              ))}
            </div>
            <div className="grid grid-cols-1 divide-y divide-ring-gold/15 border-t border-ring-gold/20 bg-black/20 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
              {latestPrintings.slice(4).map((printing) => (
                <PrintingLink key={printing.id} printing={printing} />
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="trust-workflow" className="border-t border-ring-gold/25 pt-8">
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
    <div className="rounded border border-ring-gold/25 bg-black/20 p-3">
      <p className="text-xs font-bold uppercase text-ring-light/55">{label}</p>
      <p className={`mt-2 font-bold text-ring-gold ${compact ? 'text-xl' : 'text-2xl'}`}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-ring-light/60">{detail}</p>
    </div>
  );
}

function QuickLink({ href, label, detail }: { href: string; label: string; detail: string }) {
  return (
    <Link href={href} className="rounded border border-ring-light/15 bg-ring-dark/70 p-3 transition-colors hover:border-ring-teal/70 hover:bg-ring-teal/10">
      <span className="block text-sm font-bold text-ring-gold">{label}</span>
      <span className="mt-1 block text-xs leading-5 text-ring-light/62">{detail}</span>
    </Link>
  );
}

function RecentActivity({ discoveries }: { discoveries: RecentTrackerDiscovery[] }) {
  return (
    <section aria-labelledby="recent-discoveries" className="border-t border-ring-gold/25 pt-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-ring-teal">Verified movement</p>
          <h2 id="recent-discoveries" className="mt-2 text-3xl font-bold text-ring-light">Recent Discoveries</h2>
        </div>
        <Link href="/discoveries" className="text-sm font-bold text-ring-gold underline-offset-4 hover:text-yellow-400 hover:underline">
          View all discoveries
        </Link>
      </div>

      {discoveries.length === 0 ? (
        <div className="mt-5 rounded-lg border border-ring-gold/25 bg-ring-dark/75 p-5">
          <p className="text-sm leading-6 text-ring-light/70">
            No public discoveries have been confirmed yet. New finds will appear here after admin review.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-5">
          {discoveries.map((discovery) => (
            <Link
              key={`${discovery.trackerSlug}-${discovery.cardId}-${discovery.serialNumber}`}
              href={discovery.detailHref}
              className="rounded border border-ring-gold/25 bg-ring-dark/75 p-4 transition-colors hover:border-ring-gold/70 hover:bg-ring-gold/10"
            >
              <p className="text-xs font-bold uppercase text-ring-teal">{discovery.trackerTitle}</p>
              <h3 className="mt-2 text-lg font-bold text-ring-gold">{discovery.label}</h3>
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
    <article className="grid gap-4 rounded-lg border border-ring-gold/35 bg-ring-dark/80 p-4 sm:p-5 md:grid-cols-[auto_minmax(0,1fr)]">
      {referenceImage && (
        // Reference artwork identifies the printing; it is not discovery evidence.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={referenceImage}
          alt={`${tracker.cardDefinitions?.[0]?.title || tracker.title} reference printing`}
          width={112}
          height={156}
          loading="lazy"
          className="aspect-[112/156] w-24 shrink-0 object-contain md:w-28"
        />
      )}
      <div className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-ring-teal">{tracker.subtitle}</p>
            <h3 className="mt-2 break-words text-xl font-bold text-ring-gold">{tracker.displayTitle || tracker.title}</h3>
          </div>
          <span className="inline-flex w-fit shrink-0 rounded border border-ring-teal/45 px-2.5 py-1 text-xs font-bold uppercase text-ring-teal">
            Reporting open
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-ring-light/78">{tracker.description}</p>

        <div className="mt-4 grid gap-3 text-xs text-ring-light/70 sm:grid-cols-3">
          <span>{quantityLabel}</span>
          {tracker.setName && <span>{tracker.setName}</span>}
          <span>{foundCount.toLocaleString()} located / {pendingReportCount.toLocaleString()} pending</span>
        </div>

        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded bg-ring-light/10">
            <div
              className="h-full rounded bg-ring-gold"
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
            className="inline-flex min-h-10 items-center rounded bg-ring-gold px-4 py-2 text-sm font-bold text-ring-dark transition-colors hover:bg-yellow-400"
          >
            Open Tracker
          </DirectoryCtaLink>
          <DirectoryCtaLink
            href={`${tracker.href}/submit`}
            trackerSlug={tracker.slug}
            action="report-find"
            className="inline-flex min-h-10 items-center rounded border border-ring-teal/60 px-4 py-2 text-sm font-bold text-ring-teal transition-colors hover:bg-ring-teal hover:text-ring-dark"
          >
            Report a Find
          </DirectoryCtaLink>
          {latestDiscovery && latestDiscoveryHref && (
            <DirectoryCtaLink
              href={latestDiscoveryHref}
              trackerSlug={tracker.slug}
              action="latest-discovery"
              className="inline-flex min-h-10 items-center rounded border border-ring-light/20 px-4 py-2 text-sm font-bold text-ring-light/75 transition-colors hover:border-ring-light/50 hover:text-ring-light"
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
          className="aspect-[80/112] w-20 object-contain"
        />
      )}
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase text-ring-teal">{formatDateLabel(printingReleaseDate(printing))}</p>
        <h3 className="mt-2 break-words text-lg font-bold text-ring-gold">{printingTitle(printing)}</h3>
        <p className="mt-2 text-xs leading-5 text-ring-light/62">
          {printing.setCode} #{printing.collectorNumber} / {printingTotal(printing).toLocaleString()} copies
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
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
    <Link href={printingPath(printing)} className="block p-4 transition-colors hover:bg-ring-gold/10">
      <p className="text-xs font-bold uppercase text-ring-teal">{printing.setCode} #{printing.collectorNumber}</p>
      <h3 className="mt-2 break-words text-sm font-bold leading-5 text-ring-gold">{printingTitle(printing)}</h3>
      <p className="mt-2 text-xs text-ring-light/60">{formatDateLabel(printingReleaseDate(printing))}</p>
    </Link>
  );
}

function WorkflowStep({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <article className="rounded-lg border border-ring-gold/25 bg-ring-dark/75 p-5">
      <p className="flex h-8 w-8 items-center justify-center rounded border border-ring-teal/55 text-sm font-bold text-ring-teal">{label}</p>
      <h2 id={label === '1' ? 'trust-workflow' : undefined} className="mt-4 text-xl font-bold text-ring-gold">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-ring-light/70">{body}</p>
    </article>
  );
}

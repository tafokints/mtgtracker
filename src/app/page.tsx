import Link from 'next/link';
import { trackers } from '@/lib/trackers';
import { getTrackerCardDefinitions, getTrackerTotalSlots, type RecentTrackerDiscovery } from '@/lib/tracker-data';
import { buildBreadcrumbJsonLd } from '@/lib/seo';
import { getPublicRecentDiscoveries } from '@/lib/recent-discoveries';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getRecentDiscoveries() {
  try {
    return await getPublicRecentDiscoveries(5);
  } catch (error) {
    console.error('Error loading homepage discoveries:', error);
    return [];
  }
}

export default async function HomePage() {
  const liveTrackers = trackers.filter((tracker) => tracker.status === 'live');
  const plannedTrackers = trackers.filter((tracker) => tracker.status === 'planned');
  const recentDiscoveries = await getRecentDiscoveries();

  return (
    <main className="min-h-screen px-6 py-8 md:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd([{ name: 'MTG Trackers', path: '/' }])) }}
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-ring-gold/30 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase text-ring-teal">MTG serialized cards</p>
            <h1 className="mt-2 text-3xl font-bold text-ring-gold sm:text-4xl">MTG Trackers</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-ring-light/85">
              Serialized Magic: The Gathering cards, community finds, and verified history.
            </p>
          </div>
          <nav aria-label="Browse MTG Trackers" className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="/trackers"
              className="inline-flex h-11 items-center justify-center rounded border border-ring-gold px-5 font-bold text-ring-gold transition-colors hover:bg-ring-gold hover:text-ring-dark"
            >
              Browse Trackers
            </Link>
            <Link
              href="/sets"
              className="inline-flex h-11 items-center justify-center rounded border border-ring-teal/60 px-5 font-bold text-ring-teal transition-colors hover:bg-ring-teal hover:text-ring-dark"
            >
              Browse All Sets
            </Link>
          </nav>
        </header>

        <section aria-labelledby="featured-trackers">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="featured-trackers" className="text-2xl font-bold text-ring-light">Featured Trackers</h2>
            <Link href="/sets" className="text-sm text-ring-teal">All serialized sets</Link>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {liveTrackers.map((tracker) => (
              <TrackerCard key={tracker.slug} tracker={tracker} />
            ))}
          </div>
        </section>

        <RecentActivity discoveries={recentDiscoveries} />

        <section aria-labelledby="planned-trackers">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 id="planned-trackers" className="text-2xl font-bold text-ring-light">Planned</h2>
            <span className="text-sm text-ring-light/60">{plannedTrackers.length} queued</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {plannedTrackers.map((tracker) => (
              <TrackerCard key={tracker.slug} tracker={tracker} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function RecentActivity({ discoveries }: { discoveries: RecentTrackerDiscovery[] }) {
  return (
    <section aria-labelledby="recent-discoveries" className="border-t border-ring-gold/30 pt-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 id="recent-discoveries" className="text-2xl font-bold text-ring-light">Recent Discoveries</h2>
          <p className="mt-2 text-sm text-ring-light/65">
            Fresh located serials from active community trackers.
          </p>
        </div>
        <Link href="/discoveries" className="text-sm font-bold text-ring-gold underline-offset-4 hover:text-yellow-400 hover:underline">
          View all discoveries
        </Link>
      </div>

      {discoveries.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-ring-light/65">
          No public discoveries have been confirmed yet. New finds will appear here after admin review.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-5">
          {discoveries.map((discovery) => (
            <Link
              key={`${discovery.trackerSlug}-${discovery.cardId}`}
              href={discovery.detailHref}
              className="rounded border border-ring-gold/25 bg-black/20 p-4 transition-colors hover:border-ring-gold/70 hover:bg-ring-gold/10"
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

function TrackerCard({ tracker }: { tracker: (typeof trackers)[number] }) {
  const disabled = tracker.status === 'planned';
  const referenceImage = tracker.cardDefinitions?.[0]?.referenceImage || tracker.referenceImage;
  const cardDefinitionCount = getTrackerCardDefinitions(tracker).length;
  const totalSlots = getTrackerTotalSlots(tracker);
  const quantityLabel = cardDefinitionCount > 1
    ? `${totalSlots.toLocaleString()} slots / ${cardDefinitionCount} cards`
    : `${tracker.total.toLocaleString()} serials`;

  return (
    <article className="flex min-w-0 flex-col rounded-lg border border-ring-gold/40 bg-ring-dark/80 p-4 sm:p-5">
      <div className="flex items-start gap-4">
        {referenceImage && (
          // Reference artwork identifies the printing; it is not discovery evidence.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={referenceImage}
            alt={`${tracker.cardDefinitions?.[0]?.title || tracker.title} reference printing`}
            width={96}
            height={134}
            loading="lazy"
            className="aspect-[96/134] w-16 shrink-0 object-contain sm:w-24"
          />
        )}
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-ring-teal">{tracker.subtitle}</p>
          <h3 className="mt-2 break-words text-xl font-bold text-ring-gold">{tracker.displayTitle || tracker.title}</h3>
          <p className="mt-3 text-xs text-ring-light/70">{quantityLabel}</p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-ring-light/80">{tracker.description}</p>
      <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-ring-light/70 sm:grid-cols-3">
        {tracker.setName && <span>Set: {tracker.setName}</span>}
        {tracker.releaseName && <span>Release: {tracker.releaseName}</span>}
        {tracker.cardType && <span>Type: {tracker.cardType}</span>}
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        {disabled ? (
          <span className="inline-flex min-h-10 items-center rounded border border-ring-light/20 px-4 py-2 text-sm font-bold text-ring-light/50">
            Planned
          </span>
        ) : (
          <>
            <Link
              href={tracker.href}
              className="inline-flex min-h-10 items-center rounded bg-ring-gold px-4 py-2 text-sm font-bold text-ring-dark transition-colors hover:bg-yellow-400"
            >
              Open Tracker
            </Link>
            <Link
              href={`${tracker.href}/submit`}
              className="inline-flex min-h-10 items-center rounded border border-ring-teal/60 px-4 py-2 text-sm font-bold text-ring-teal transition-colors hover:bg-ring-teal hover:text-ring-dark"
            >
              Report a Find
            </Link>
          </>
        )}
      </div>
    </article>
  );
}

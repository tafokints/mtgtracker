import Link from 'next/link';
import { getRedis } from '@/lib/redis';
import { trackers } from '@/lib/trackers';
import { getRecentTrackerDiscoveriesSnapshot, getTrackerCardDefinitions, getTrackerTotalSlots, type RecentTrackerDiscovery } from '@/lib/tracker-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getRecentDiscoveries() {
  try {
    const redis = getRedis();
    return await getRecentTrackerDiscoveriesSnapshot(
      redis,
      trackers.filter((tracker) => tracker.status === 'live'),
      5
    );
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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-4 border-b border-ring-gold/30 pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-ring-teal">MTG serialized cards</p>
            <h1 className="mt-3 text-4xl font-bold text-ring-gold md:text-6xl">MTG Trackers</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-ring-light/85">
              A home for community-maintained trackers covering Magic: The Gathering serialized chase cards, sightings, sales, grading, and source quality.
            </p>
          </div>
          <Link
            href="/trackers"
            className="inline-flex h-11 items-center justify-center rounded border border-ring-gold px-5 font-bold text-ring-gold transition-colors hover:bg-ring-gold hover:text-ring-dark"
          >
            Browse Trackers
          </Link>
        </header>

        <RecentActivity discoveries={recentDiscoveries} />

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-ring-light">Live Trackers</h2>
            <span className="text-sm text-ring-light/60">{liveTrackers.length} active</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {liveTrackers.map((tracker) => (
              <TrackerCard key={tracker.slug} tracker={tracker} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-ring-light">Planned</h2>
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
    <section className="rounded-lg border border-ring-gold/30 bg-ring-dark/70 p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ring-light">Recent Discoveries</h2>
          <p className="mt-2 text-sm text-ring-light/65">
            Fresh located serials from active community trackers.
          </p>
        </div>
        <Link href="/trackers" className="text-sm font-bold text-ring-gold underline-offset-4 hover:text-yellow-400 hover:underline">
          View all trackers
        </Link>
      </div>

      {discoveries.length === 0 ? (
        <div className="mt-5 rounded border border-ring-light/10 bg-black/20 p-4 text-sm text-ring-light/65">
          No public discoveries have been confirmed yet. New finds will appear here after admin review.
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-5">
          {discoveries.map((discovery) => (
            <Link
              key={`${discovery.trackerSlug}-${discovery.cardId}`}
              href={discovery.trackerHref}
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
  const cardDefinitionCount = getTrackerCardDefinitions(tracker).length;
  const totalSlots = getTrackerTotalSlots(tracker);
  const quantityLabel = cardDefinitionCount > 1
    ? `${totalSlots.toLocaleString()} slots / ${cardDefinitionCount} cards`
    : `${tracker.total.toLocaleString()} serials`;

  return (
    <article className="rounded-lg border border-ring-gold/40 bg-ring-dark/80 p-5 shadow-[0_0_20px_rgba(43,174,158,0.12)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-ring-teal">{tracker.subtitle}</p>
          <h3 className="mt-2 text-2xl font-bold text-ring-gold">{tracker.title}</h3>
        </div>
        <span className="rounded border border-ring-gold/30 px-2 py-1 text-xs uppercase text-ring-light/70">
          {quantityLabel}
        </span>
      </div>
      <p className="mt-4 min-h-14 text-sm leading-6 text-ring-light/80">{tracker.description}</p>
      <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-ring-light/70 sm:grid-cols-3">
        {tracker.setName && <span>Set: {tracker.setName}</span>}
        {tracker.releaseName && <span>Release: {tracker.releaseName}</span>}
        {tracker.cardType && <span>Type: {tracker.cardType}</span>}
      </div>
      {disabled ? (
        <span className="mt-5 inline-flex h-10 items-center rounded border border-ring-light/20 px-4 text-sm font-bold text-ring-light/50">
          Planned
        </span>
      ) : (
        <Link
          href={tracker.href}
          className="mt-5 inline-flex h-10 items-center rounded bg-ring-gold px-4 text-sm font-bold text-ring-dark transition-colors hover:bg-yellow-400"
        >
          Open Tracker
        </Link>
      )}
    </article>
  );
}

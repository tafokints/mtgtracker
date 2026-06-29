import Link from 'next/link';
import { trackers } from '@/lib/trackers';

export default function TrackersPage() {
  return (
    <main className="min-h-screen px-6 py-8 md:px-10">
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
                    <dd>{tracker.total}</dd>
                  </div>
                </dl>
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
      </div>
    </main>
  );
}

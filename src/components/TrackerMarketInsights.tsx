import type { TrackerSummary } from '@/lib/trackers';

export default function TrackerMarketInsights({ tracker }: { tracker: TrackerSummary }) {
  const insights = tracker.marketInsights || [];

  if (insights.length === 0) {
    return null;
  }

  return (
    <section className="w-full rounded-lg border border-ring-gold/30 bg-ring-dark/75 p-5" aria-label={`${tracker.title} collector research notes`}>
      <div className="mb-4">
        <p className="text-xs font-bold uppercase text-ring-light/60">Collector Notes</p>
        <h2 className="mt-1 text-xl font-bold text-ring-gold" aria-label={`${tracker.title} Market Context`}>
          {tracker.title} Market Context
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {insights.map((insight) => (
          <article key={insight.title} className="rounded border border-ring-gold/20 bg-black/20 p-4">
            <h3 className="text-base font-bold text-ring-light">{insight.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ring-light/75">{insight.summary}</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-ring-light/70">
              {insight.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-ring-gold" aria-hidden="true" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

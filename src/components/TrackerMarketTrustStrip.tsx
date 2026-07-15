import type { TrackerMarketSummary } from '@/lib/tracker-market-summary';

interface TrackerMarketTrustStripProps {
  summary: TrackerMarketSummary;
}

export default function TrackerMarketTrustStrip({ summary }: TrackerMarketTrustStripProps) {
  return (
    <section className="mb-5 rounded-lg border border-ring-teal/30 bg-ring-teal/10 p-4 text-left" aria-label="Tracker market and trust summary">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase text-ring-teal">Tracker Trust And Market Signals</h2>
          <p className="mt-1 text-xs text-ring-light/70">
            Best current marketplace path: <span className="font-bold text-ring-teal">{summary.primaryMerchantLabel}</span>.
          </p>
        </div>
        <span className="rounded border border-ring-teal/40 px-2 py-1 text-xs font-bold uppercase text-ring-light/70">
          {summary.foundCount} located
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summary.trustSignals.map((signal) => (
          <div key={signal.label} className="rounded border border-ring-teal/20 bg-black/20 p-3">
            <p className="text-xs uppercase text-ring-light/55">{signal.label}</p>
            <p className="mt-1 text-lg font-bold text-ring-teal">{signal.value}</p>
            <p className="mt-1 text-xs leading-5 text-ring-light/65">{signal.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

import type { TrackerSummary } from '@/lib/trackers';

export default function TrackerFaq({ tracker }: { tracker: TrackerSummary }) {
  const faqs = tracker.faqs || [];

  if (faqs.length === 0) {
    return null;
  }

  return (
    <section className="w-full rounded-lg border border-ring-gold/30 bg-ring-dark/75 p-5" aria-label={`${tracker.title} frequently asked questions`}>
      <div className="mb-4">
        <p className="text-xs font-bold uppercase text-ring-light/60">FAQ</p>
        <h2 className="mt-1 text-xl font-bold text-ring-gold" aria-label={`${tracker.title} Frequently Asked Questions`}>
          {tracker.title} Frequently Asked Questions
        </h2>
      </div>
      <div className="space-y-3">
        {faqs.map((faq) => (
          <details key={faq.question} className="rounded border border-ring-gold/20 bg-black/20 p-4">
            <summary className="cursor-pointer text-left text-sm font-bold text-ring-light marker:text-ring-gold">
              {faq.question}
            </summary>
            <p className="mt-3 text-sm leading-6 text-ring-light/75">{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

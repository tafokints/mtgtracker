import Link from 'next/link';
import type { Metadata } from 'next';
import ExternalImage from '@/components/ExternalImage';
import { catalogCheckedAt, getCatalogPrintings, getPrintingCoverage, serializedSets } from '@/lib/serialized-printings';

export const metadata: Metadata = { title: 'Serialized MTG Sets', description: 'Browse serialized Magic cards by release, treatment, exact printing, and numbered run.', alternates: { canonical: '/sets' } };

export default function SetsPage() {
  const coverage = getPrintingCoverage();
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8">
      <Link href="/" className="text-sm text-cyan-200">MTG Trackers</Link>
      <header className="mt-6 border-b border-zinc-600 pb-6">
        <h1 className="text-4xl font-bold text-zinc-100">Serialized MTG Sets</h1>
        <p className="mt-3 text-zinc-300">{coverage.releasedEnglish} released English printings · {coverage.english - coverage.releasedEnglish} announced · {coverage.sets} release groups</p>
        <p className="mt-2 text-sm text-zinc-400">Catalog checked {catalogCheckedAt}. Non-English variants are listed separately. Reference artwork is not a discovery.</p>
      </header>
      <div className="grid gap-x-8 sm:grid-cols-2">
        {serializedSets.map((set) => {
          const printings = set.entries.flatMap((entry) => getCatalogPrintings(entry.slug));
          return (
            <Link key={set.slug} href={`/sets/${set.slug}`} className="flex min-w-0 items-center gap-5 border-b border-zinc-700 py-6 hover:bg-zinc-800/40">
              {printings[0] && <ExternalImage src={printings[0].referenceImage} alt={`${set.title} serialized reference card`} className="h-28 w-20 shrink-0 object-contain" width={80} height={112} />}
              <div className="min-w-0">
                <h2 className="break-words text-xl font-bold text-zinc-100">{set.title}</h2>
                <p className="mt-2 text-sm text-cyan-200">{printings.filter((card) => card.language === 'en').length} English printings</p>
                <p className="mt-1 text-sm text-zinc-400">{set.entries.length} treatment{set.entries.length === 1 ? '' : 's'}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

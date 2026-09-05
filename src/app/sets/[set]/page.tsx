import Link from 'next/link';
import { notFound } from 'next/navigation';
import SerializedPrintingList from '@/components/SerializedPrintingList';
import { getCatalogPrintings, serializedSets } from '@/lib/serialized-printings';
import { buildBreadcrumbJsonLd } from '@/lib/seo';

type Props = { params: Promise<{ set: string }> };
export function generateStaticParams() { return serializedSets.map((set) => ({ set: set.slug })); }
export async function generateMetadata({ params }: Props) {
  const { set: slug } = await params;
  const set = serializedSets.find((set) => set.slug === slug);
  return set ? { title: `${set.title} Serialized Cards`, description: `All catalogued ${set.title} serialized card printings and numbered runs.`, alternates: { canonical: `/sets/${set.slug}` } } : {};
}
export default async function SetPage({ params }: Props) {
  const { set: slug } = await params;
  const set = serializedSets.find((set) => set.slug === slug);
  if (!set) notFound();
  const cards = set.entries.flatMap((entry) => getCatalogPrintings(entry.slug));
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd([{ name: 'MTG Trackers', path: '/' }, { name: 'Sets', path: '/sets' }, { name: set.title, path: `/sets/${set.slug}` }])) }} />
      <Link href="/sets" className="text-sm text-cyan-200">All Sets</Link>
      <h1 className="mt-5 text-4xl font-bold text-zinc-100">{set.title}</h1>
      <div className="mt-6 divide-y divide-zinc-700 border-y border-zinc-600">
        {set.entries.map((entry) => <Link key={entry.slug} href={`/serialized-mtg-catalog/${entry.slug}`} className="flex flex-wrap justify-between gap-2 py-4 text-zinc-100 hover:text-cyan-200"><span className="font-semibold">{entry.title}</span><span className="text-sm text-zinc-400">{getCatalogPrintings(entry.slug).length} printings</span></Link>)}
      </div>
      <SerializedPrintingList printings={cards} />
    </main>
  );
}

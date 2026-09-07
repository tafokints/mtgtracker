import Link from 'next/link';
import { notFound } from 'next/navigation';
import ExternalImage from '@/components/ExternalImage';
import AffiliateDisclosureNotice from '@/components/AffiliateDisclosureNotice';
import AffiliateOutboundLink from '@/components/AffiliateOutboundLink';
import { serializedCatalog } from '@/lib/serialized-catalog';
import { catalogCheckedAt, catalogOfficialSources, getCatalogSet, getRelatedPrintings, getSerializedPrinting, isReleasedPrinting, printingLanguage, printingPath, printingReleaseDate, printingTitle, printingTotal, serializedPrintings } from '@/lib/serialized-printings';
import { getPrintingAffiliateLinks, getPrintingTracker, getPrintingTrackerHref } from '@/lib/trackers';
import { buildBreadcrumbJsonLd } from '@/lib/seo';

type Props = { params: Promise<{ slug: string; card: string }> };
export function generateStaticParams() { return serializedPrintings.map((card) => ({ slug: card.catalogSlug, card: card.slug })); }
export async function generateMetadata({ params }: Props) {
  const { slug, card } = await params;
  const printing = getSerializedPrinting(slug, card);
  return printing ? { title: `${printingTitle(printing)} | ${printing.setCode} Serialized /${printingTotal(printing)}`, description: `${printingLanguage(printing)} ${printingTitle(printing)}, collector number ${printing.collectorNumber}. Numbered run of ${printingTotal(printing)}.`, alternates: { canonical: printingPath(printing) } } : {};
}
export default async function PrintingPage({ params }: Props) {
  const { slug, card } = await params;
  const printing = getSerializedPrinting(slug, card);
  const entry = serializedCatalog.find((entry) => entry.slug === slug);
  if (!printing || !entry) notFound();
  const set = getCatalogSet(entry);
  const tracker = getPrintingTracker(printing);
  const trackerHref = getPrintingTrackerHref(printing);
  const released = isReleasedPrinting(printing);
  const title = printingTitle(printing);
  const total = printingTotal(printing);
  const links = getPrintingAffiliateLinks(printing);
  const official = catalogOfficialSources[entry.slug];
  const relatedPrintings = getRelatedPrintings(printing);
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 sm:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd([{ name: 'MTG Trackers', path: '/' }, { name: 'Sets', path: '/sets' }, { name: set.title, path: `/sets/${set.slug}` }, { name: entry.title, path: `/serialized-mtg-catalog/${entry.slug}` }, { name: title, path: printingPath(printing) }])) }} />
      <nav aria-label="Card navigation" className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-cyan-200"><Link href="/sets">Sets</Link><Link href={`/sets/${set.slug}`}>{set.title}</Link><Link href={`/serialized-mtg-catalog/${entry.slug}`}>{entry.title}</Link></nav>
      <header className="mt-6 border-b border-zinc-600 pb-6">
        <p className="text-sm text-cyan-200">{printing.setCode} #{printing.collectorNumber} · {printingLanguage(printing)}</p>
        <h1 className="mt-2 break-words text-3xl font-bold text-zinc-100 sm:text-4xl">{title}</h1>
        <p className="mt-3 text-zinc-300">{entry.treatment}</p>
        {relatedPrintings.length > 0 && <nav aria-label="Other printings of this card" className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-cyan-200">
          {relatedPrintings.map((related) => <Link key={related.id} className="underline" href={printingPath(related)}>{printingTitle(related)}</Link>)}
        </nav>}
      </header>
      <div className="mt-5"><AffiliateDisclosureNotice compact links={links} /></div>
      <section className="mt-7 grid items-start gap-8 sm:grid-cols-[220px_minmax(0,1fr)]">
        <figure>
          <ExternalImage src={printing.referenceImage} alt={`${title}, serialized reference printing`} loading="eager" width={220} height={307} className="mx-auto aspect-[220/307] w-full max-w-[220px] object-contain" />
          <figcaption className="mt-3 text-center text-xs text-zinc-400">Reference artwork, not a reported discovery</figcaption>
        </figure>
        <div className="min-w-0">
          <dl className="grid grid-cols-2 gap-5 text-sm">
            <div><dt className="text-zinc-400">Numbered copies</dt><dd className="mt-1 text-2xl font-bold text-zinc-100">{total}</dd></div>
            <div><dt className="text-zinc-400">Release</dt><dd className="mt-1 font-semibold text-zinc-100">{released ? 'Released' : 'Announced'} · {printingReleaseDate(printing)}</dd></div>
            <div className="col-span-2"><dt className="text-zinc-400">Distribution</dt><dd className="mt-1 text-zinc-100">{entry.foundIn || 'Promo distribution; see printing sources'}</dd></div>
          </dl>
          {trackerHref ? <div className="mt-6 flex flex-wrap gap-3"><Link href={trackerHref} className="rounded bg-cyan-200 px-4 py-2 font-semibold text-zinc-950">Open Serial Tracker</Link><Link href={`${tracker!.href}/submit${trackerHref.includes('?') ? `?${trackerHref.split('?')[1]}` : ''}`} className="rounded border border-cyan-300 px-4 py-2 font-semibold text-cyan-200">Report a Find</Link></div>
            : <p className="mt-6 border-l-2 border-cyan-300 pl-4 text-sm text-zinc-300">{!released ? 'Announced release. Discovery reports are not open yet.' : printing.setCode === 'FIN' ? 'Reference page only. The separate Golden Chocobo tracker remains unchanged; migration is deferred.' : 'Non-English printing. Included for reference; English trackers are the current reporting scope.'}</p>}
          {!official && <p className="mt-5 text-sm text-zinc-400">Promo quantity is catalogued from card references. Primary publisher distribution documentation has not been located.</p>}
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-cyan-200"><a href={printing.scryfallUrl} rel="noopener noreferrer" target="_blank">Scryfall printing</a>{official && <a href={official} rel="noopener noreferrer" target="_blank">Wizards source</a>}</div>
          <p className="mt-3 text-xs text-zinc-400">Catalog checked {catalogCheckedAt}</p>
        </div>
      </section>
      <section className="mt-8 border-t border-zinc-600 pt-6" aria-label="Card marketplaces">
        <h2 className="text-xl font-bold text-zinc-100">Marketplaces</h2>
        <div className="mt-4 flex flex-wrap gap-3">{links.map((link) => <AffiliateOutboundLink key={link.merchant} trackerSlug="default" link={link} placement="marketplace-links" className="max-w-full break-words rounded border border-zinc-500 px-4 py-3 text-sm text-cyan-200">{link.label}</AffiliateOutboundLink>)}</div>
        <div className="mt-4"><AffiliateDisclosureNotice compact links={links} /></div>
      </section>
    </main>
  );
}

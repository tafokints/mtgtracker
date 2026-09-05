'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import ExternalImage from '@/components/ExternalImage';
import { isReleasedPrinting, printingLanguage, printingPath, printingTitle, printingTotal, type SerializedPrinting } from '@/lib/serialized-printings';

export default function SerializedPrintingList({ printings }: { printings: SerializedPrinting[] }) {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('en');
  const visible = printings.filter((card) => (language === 'all' || card.language === language)
    && `${printingTitle(card)} ${card.collectorNumber} ${card.setCode}`.toLowerCase().includes(query.trim().toLowerCase()));
  const english = printings.filter((card) => card.language === 'en').length;
  return (
    <section className="mt-8 border-t border-zinc-600 pt-6" aria-label="Serialized card printings">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-2xl font-bold text-zinc-100">Card Printings <span className="text-base font-normal text-zinc-400">{visible.length}</span></h2>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <label className="relative min-w-0 flex-1 sm:w-64">
            <span className="sr-only">Search card printings</span>
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Card name or collector number" className="h-10 w-full rounded border border-zinc-600 bg-zinc-950 pl-9 pr-3 text-sm text-zinc-100" />
          </label>
          <label>
            <span className="sr-only">Printing language</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)} className="h-10 max-w-full rounded border border-zinc-600 bg-zinc-950 px-3 text-sm text-zinc-100">
              <option value="en">English ({english})</option>
              <option value="all">All languages ({printings.length})</option>
            </select>
          </label>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((card) => (
          <Link key={card.id} href={printingPath(card)} className="flex min-w-0 gap-4 border-b border-zinc-700 py-4 hover:bg-zinc-800/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
            <ExternalImage src={card.referenceImage} alt={`${printingTitle(card)} reference artwork`} width={64} height={90} className="h-[90px] w-16 shrink-0 object-contain" />
            <div className="min-w-0 self-center">
              <h3 className="break-words text-base font-semibold leading-5 text-zinc-100">{printingTitle(card)}</h3>
              <p className="mt-2 text-xs text-cyan-200">{card.setCode} #{card.collectorNumber} · /{printingTotal(card)}</p>
              <p className="mt-1 text-xs text-zinc-400">{printingLanguage(card)}{!isReleasedPrinting(card) ? ' · Announced' : ''}</p>
            </div>
          </Link>
        ))}
      </div>
      {visible.length === 0 && <p className="py-8 text-zinc-300" role="status">{english === 0 && language === 'en' ? 'No English-text printings in this treatment. Non-English variants are listed under All languages.' : 'No matching card printings.'}</p>}
    </section>
  );
}

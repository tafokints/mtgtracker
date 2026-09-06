'use client';

import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface FilterControlsProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  cardFilter?: string;
  setCardFilter?: (cardSlug: string) => void;
  cardOptions?: Array<{ slug: string; title: string; count: number }>;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  sortOrder: string;
  setSortOrder: (order: string) => void;
  statusCounts: Record<string, number>;
}

export default function FilterControls({ searchQuery, setSearchQuery, cardFilter = 'all',
  setCardFilter, cardOptions = [], statusFilter, setStatusFilter, sortOrder, setSortOrder, statusCounts,
}: FilterControlsProps) {
  const hasCardFilter = cardOptions.length > 1 && setCardFilter;
  const inputClass = 'w-full min-w-0 h-11 bg-ring-light border border-ring-gold/50 text-ring-dark rounded px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-gold';
  return (
    <div className="w-full max-w-5xl border-y border-ring-gold/25 py-4 font-sans">
      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${hasCardFilter ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <div className="min-w-0 text-xs font-semibold text-ring-light">
          <label htmlFor="serial-search">Serial or card</label>
          <span className="relative mt-2 block">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-ring-dark" aria-hidden="true" />
            <input id="serial-search" type="search" placeholder="007, 1-20, or card name" value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)} className={`${inputClass} pl-10 pr-10 [&::-webkit-search-cancel-button]:appearance-none`} />
            {searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search" title="Clear search" className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center text-ring-dark">
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>}
          </span>
        </div>
        {hasCardFilter && <label className="min-w-0 text-xs font-semibold text-ring-light">Card
          <select value={cardFilter} onChange={(event) => setCardFilter(event.target.value)} className={`${inputClass} mt-2`}>
            <option value="all">All cards</option>
            {cardOptions.map((option) => <option key={option.slug} value={option.slug}>{option.title} ({option.count})</option>)}
          </select>
        </label>}
        <label className="min-w-0 text-xs font-semibold text-ring-light">Status or evidence
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={`${inputClass} mt-2`}>
            <option value="all">All statuses</option>
            <option value="found">Located</option>
            <option value="pending">Under review</option>
            <option value="unreported">Unreported</option>
            <option value="not-found">All unlocated</option>
            <option value="confirmed">Confirmed</option>
            <option value="source-linked">Source-linked</option>
            <option value="has-evidence">With evidence</option>
            <optgroup label="Source type">
              <option value="source-marketplace">Marketplace</option>
              <option value="source-grading-pop">Grading population</option>
              <option value="source-social">Social</option>
              <option value="source-article">Article</option>
              <option value="source-private-sale">Private sale</option>
              <option value="source-other">Other source</option>
            </optgroup>
          </select>
        </label>
        <label className="min-w-0 text-xs font-semibold text-ring-light">Sort by
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className={`${inputClass} mt-2`}>
            <option value="id-asc">Serial: low to high</option>
            <option value="id-desc">Serial: high to low</option>
            <option value="price-desc">Price: high to low</option>
            <option value="price-asc">Price: low to high</option>
            <option value="date-desc">Newest discoveries</option>
            <option value="date-asc">Oldest discoveries</option>
            <option value="evidence-desc">Most evidence</option>
          </select>
        </label>
      </div>
      <div role="group" aria-label="Quick status filters" className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {[['all', 'All'], ['found', 'Located'], ['pending', 'Under review'], ['unreported', 'Unreported']].map(([value, label]) => (
          <button key={value} type="button" aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}
            className={`flex min-h-11 items-center justify-between gap-3 rounded border px-3 py-2 text-sm sm:min-w-32 ${statusFilter === value ? 'border-ring-gold bg-ring-gold text-ring-dark' : 'border-ring-light/25 text-ring-light hover:border-ring-gold'}`}>
            <span>{label}</span><span className="tabular-nums opacity-75">{statusCounts[value] || 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

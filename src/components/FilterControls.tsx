'use client';

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

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
}

export default function FilterControls({
  searchQuery,
  setSearchQuery,
  cardFilter = 'all',
  setCardFilter,
  cardOptions = [],
  statusFilter,
  setStatusFilter,
  sortOrder,
  setSortOrder,
}: FilterControlsProps) {
  const hasCardFilter = cardOptions.length > 1 && setCardFilter;
  const controlColumns = hasCardFilter ? 'md:grid-cols-4' : 'md:grid-cols-3';
  const secondaryColumns = hasCardFilter ? 'sm:grid-cols-3' : 'sm:grid-cols-2';

  return (
    <div className={`w-full max-w-5xl mt-8 grid grid-cols-1 ${controlColumns} gap-3 md:gap-4 p-4 bg-ring-dark bg-opacity-75 rounded-lg`}>
      {/* Search Input */}
      <div className="relative col-span-1 md:col-span-1">
        <input
          type="text"
          placeholder={hasCardFilter ? 'Search serial or card' : 'Search by card #'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-10 bg-ring-light border border-ring-gold text-ring-dark rounded-lg py-2 pl-10 pr-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-gold"
        />
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ring-dark" />
      </div>

      {/* Filter and Sort Dropdowns */}
      <div className={`col-span-1 ${hasCardFilter ? 'md:col-span-3' : 'md:col-span-2'} grid grid-cols-1 ${secondaryColumns} gap-4`}>
        {hasCardFilter && (
          <div>
            <select
              value={cardFilter}
              onChange={(e) => setCardFilter(e.target.value)}
              className="w-full h-10 bg-ring-light border border-ring-gold text-ring-dark rounded-lg py-2 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-gold"
            >
              <option value="all">All Cards</option>
              {cardOptions.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.title} ({option.count})
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full h-10 bg-ring-light border border-ring-gold text-ring-dark rounded-lg py-2 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-gold"
          >
            <option value="all">Show All</option>
            <option value="found">Show Located</option>
            <option value="pending">Show Pending Review</option>
            <option value="confirmed">Show Confirmed</option>
            <option value="source-linked">Show Source-Linked</option>
            <option value="has-evidence">Show With Evidence</option>
            <option value="not-found">Show Not Found</option>
          </select>
        </div>
        <div>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full h-10 bg-ring-light border border-ring-gold text-ring-dark rounded-lg py-2 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-gold"
          >
            <option value="id-asc">Sort by ID (Asc)</option>
            <option value="id-desc">Sort by ID (Desc)</option>
            <option value="price-desc">Sort by Price (High-Low)</option>
            <option value="price-asc">Sort by Price (Low-High)</option>
            <option value="date-desc">Sort by Date (Newest)</option>
            <option value="date-asc">Sort by Date (Oldest)</option>
            <option value="evidence-desc">Sort by Evidence</option>
          </select>
        </div>
      </div>
    </div>
  );
} 

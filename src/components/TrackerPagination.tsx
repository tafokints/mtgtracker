'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

export default function TrackerPagination({ page, pageCount, onChange, position }: {
  page: number; pageCount: number; onChange: (page: number) => void; position: 'top' | 'bottom';
}) {
  if (pageCount <= 1) return null;
  const buttonClass = 'flex h-10 w-10 shrink-0 items-center justify-center rounded border border-ring-gold/40 text-ring-gold hover:bg-ring-gold/10 disabled:opacity-30 disabled:cursor-not-allowed';
  return (
    <nav aria-label={`Serial pages ${position}`} className="my-4 flex w-full max-w-5xl items-center justify-end gap-3 font-sans text-sm text-ring-light">
      <button type="button" aria-label="Previous page" title="Previous page" disabled={page === 1} onClick={() => onChange(page - 1)} className={buttonClass}>
        <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
      </button>
      <label className="flex items-center gap-2">
        Page
        <select aria-label="Page number" value={page} onChange={(event) => onChange(Number(event.target.value))} className="h-10 rounded border border-ring-gold/40 bg-ring-dark px-2 text-ring-light">
          {Array.from({ length: pageCount }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
        </select>
        <span>of {pageCount}</span>
      </label>
      <button type="button" aria-label="Next page" title="Next page" disabled={page === pageCount} onClick={() => onChange(page + 1)} className={buttonClass}>
        <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
      </button>
    </nav>
  );
}

import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import type { ReferenceLink } from '@/lib/trackers';

interface ReferenceLinksProps {
  links?: ReferenceLink[];
  compact?: boolean;
}

const typeLabels: Record<ReferenceLink['type'], string> = {
  official: 'Official',
  scryfall: 'Scryfall',
  source: 'Source',
  article: 'Article',
  other: 'Reference',
};

export default function ReferenceLinks({ links, compact = false }: ReferenceLinksProps) {
  if (!links?.length) {
    return null;
  }

  return (
    <div className={compact ? 'mt-4 text-left' : 'mt-6 text-left'}>
      <h2 className={compact ? 'text-xs font-semibold uppercase text-ring-light/50' : 'text-sm font-bold text-ring-gold'}>
        References
      </h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={`${link.type}-${link.href}`}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1.5 rounded border border-ring-gold/30 bg-black/20 px-3 py-1.5 text-xs font-semibold text-ring-light transition-colors hover:border-ring-gold hover:text-ring-gold"
          >
            <span className="text-ring-light/55">{typeLabels[link.type]}</span>
            <span>{link.label}</span>
            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
          </a>
        ))}
      </div>
    </div>
  );
}

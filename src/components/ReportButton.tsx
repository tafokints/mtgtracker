import Link from 'next/link';

export default function ReportButton({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center justify-center rounded border border-ring-gold bg-ring-gold px-4 py-2 text-sm font-bold text-ring-dark transition-colors hover:border-yellow-400 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-ring-gold focus:ring-offset-2 focus:ring-offset-ring-dark"
    >
      Report a Find
    </Link>
  );
}

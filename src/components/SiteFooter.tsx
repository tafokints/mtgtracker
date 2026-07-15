import Link from 'next/link';

const footerLinks = [
  { href: '/trackers', label: 'Trackers' },
  { href: '/serialized-mtg-catalog', label: 'Catalog' },
  { href: '/verification-guide', label: 'Verification Guide' },
  { href: '/discoveries', label: 'Discoveries' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/affiliate-disclosure', label: 'Affiliate Disclosure' },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-ring-gold/25 px-6 py-8 text-sm text-ring-light/65 md:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p>MTG Trackers is an independent community project and is not affiliated with Wizards of the Coast.</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2">
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-ring-gold hover:text-yellow-400">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

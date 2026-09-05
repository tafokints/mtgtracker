import type { Metadata } from 'next';
import OwnerDashboard from '@/components/OwnerDashboard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Owner Dashboard',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
  alternates: { canonical: '/admin' },
};

export default function AdminPage() { return <OwnerDashboard />; }

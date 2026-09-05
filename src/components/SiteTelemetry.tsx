'use client';

import { usePathname } from 'next/navigation';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';

export default function SiteTelemetry() {
  const pathname = usePathname();
  if (pathname.startsWith('/reports/')) return null;
  return <><SpeedInsights /><Analytics /></>;
}

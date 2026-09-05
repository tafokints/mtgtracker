import type { Metadata } from 'next';
import ReportFollowUp from '@/components/ReportFollowUp';

export const metadata: Metadata = { title: 'Private Report', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function ReportPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  return <ReportFollowUp slug={slug} id={id} />;
}

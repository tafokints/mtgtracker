import { notFound } from 'next/navigation';
import TrackerPageClient from '@/components/TrackerPageClient';
import { getTracker, trackers } from '@/lib/trackers';
import { buildBreadcrumbJsonLd, buildTrackerPageMetadata, buildTrackerWebPageJsonLd, trackerBreadcrumbItems } from '@/lib/seo';

type TrackerPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return trackers
    .filter((tracker) => tracker.status === 'live')
    .map((tracker) => ({ slug: tracker.slug }));
}

export async function generateMetadata({ params, searchParams }: TrackerPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const tracker = getTracker(slug);

  if (!tracker || tracker.status !== 'live') {
    return {};
  }

  return buildTrackerPageMetadata(tracker, resolvedSearchParams);
}

export default async function TrackerPage({ params }: TrackerPageProps) {
  const { slug } = await params;
  const tracker = getTracker(slug);

  if (!tracker || tracker.status !== 'live') {
    notFound();
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildTrackerWebPageJsonLd(tracker)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd(trackerBreadcrumbItems(tracker))) }}
      />
      <TrackerPageClient tracker={tracker} />
    </>
  );
}

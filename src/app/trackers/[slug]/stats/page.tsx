import { notFound } from 'next/navigation';
import TrackerStatsClient from '@/components/TrackerStatsClient';
import { getLiveTrackerStaticParams, getTracker } from '@/lib/trackers';
import { buildBreadcrumbJsonLd, buildTrackerStatsJsonLd, trackerBreadcrumbItems } from '@/lib/seo';

type TrackerStatsPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getLiveTrackerStaticParams();
}

export async function generateMetadata({ params }: TrackerStatsPageProps) {
  const { slug } = await params;
  const tracker = getTracker(slug);

  if (!tracker || tracker.status !== 'live') {
    return {};
  }

  return {
    title: `${tracker.title} Statistics`,
    description: `Statistics and analytics for serialized ${tracker.title} discoveries.`,
    alternates: {
      canonical: `/trackers/${tracker.slug}/stats`,
    },
  };
}

export default async function TrackerStatsPage({ params }: TrackerStatsPageProps) {
  const { slug } = await params;
  const tracker = getTracker(slug);

  if (!tracker || tracker.status !== 'live') {
    notFound();
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd(trackerBreadcrumbItems(tracker, {
          name: 'Stats',
          path: `${tracker.href}/stats`,
        }))) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildTrackerStatsJsonLd(tracker)) }}
      />
      <TrackerStatsClient tracker={tracker} />
    </>
  );
}

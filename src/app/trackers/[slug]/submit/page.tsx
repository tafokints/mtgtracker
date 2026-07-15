import { notFound } from 'next/navigation';
import TrackerSubmitClient from '@/components/TrackerSubmitClient';
import { getTracker, trackers } from '@/lib/trackers';
import { buildBreadcrumbJsonLd, buildTrackerSubmitJsonLd, trackerBreadcrumbItems } from '@/lib/seo';

type TrackerSubmitPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return trackers
    .filter((tracker) => tracker.status === 'live')
    .map((tracker) => ({ slug: tracker.slug }));
}

export async function generateMetadata({ params }: TrackerSubmitPageProps) {
  const { slug } = await params;
  const tracker = getTracker(slug);

  if (!tracker || tracker.status !== 'live') {
    return {};
  }

  return {
    title: `Report a Find | ${tracker.title}`,
    description: `Submit a discovered serialized ${tracker.title} card for admin review.`,
    alternates: {
      canonical: `/trackers/${tracker.slug}/submit`,
    },
  };
}

export default async function TrackerSubmitPage({ params }: TrackerSubmitPageProps) {
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
          name: 'Report a Find',
          path: `${tracker.href}/submit`,
        }))) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildTrackerSubmitJsonLd(tracker)) }}
      />
      <TrackerSubmitClient tracker={tracker} />
    </>
  );
}

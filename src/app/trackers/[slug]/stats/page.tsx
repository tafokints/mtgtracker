import { notFound } from 'next/navigation';
import TrackerStatsClient from '@/components/TrackerStatsClient';
import { getTracker, trackers } from '@/lib/trackers';

type TrackerStatsPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return trackers
    .filter((tracker) => tracker.status === 'live')
    .map((tracker) => ({ slug: tracker.slug }));
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

  return <TrackerStatsClient tracker={tracker} />;
}

import { notFound } from 'next/navigation';
import TrackerStatsClient from '@/components/TrackerStatsClient';
import { getTracker, trackers } from '@/lib/trackers';

export function generateStaticParams() {
  return trackers
    .filter((tracker) => tracker.status === 'live')
    .map((tracker) => ({ slug: tracker.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const tracker = getTracker(params.slug);

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

export default function TrackerStatsPage({ params }: { params: { slug: string } }) {
  const tracker = getTracker(params.slug);

  if (!tracker || tracker.status !== 'live') {
    notFound();
  }

  return <TrackerStatsClient tracker={tracker} />;
}

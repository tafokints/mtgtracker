import { notFound } from 'next/navigation';
import TrackerSubmitClient from '@/components/TrackerSubmitClient';
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
    title: `Report a Find | ${tracker.title}`,
    description: `Submit a discovered serialized ${tracker.title} card for admin review.`,
    alternates: {
      canonical: `/trackers/${tracker.slug}/submit`,
    },
  };
}

export default function TrackerSubmitPage({ params }: { params: { slug: string } }) {
  const tracker = getTracker(params.slug);

  if (!tracker || tracker.status !== 'live') {
    notFound();
  }

  return <TrackerSubmitClient tracker={tracker} />;
}

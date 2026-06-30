import { notFound } from 'next/navigation';
import TrackerPageClient from '@/components/TrackerPageClient';
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
    title: tracker.title,
    description: tracker.description,
    alternates: {
      canonical: `/trackers/${tracker.slug}`,
    },
  };
}

export default function TrackerPage({ params }: { params: { slug: string } }) {
  const tracker = getTracker(params.slug);

  if (!tracker || tracker.status !== 'live') {
    notFound();
  }

  return <TrackerPageClient tracker={tracker} />;
}

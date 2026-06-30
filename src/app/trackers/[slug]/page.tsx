import { notFound } from 'next/navigation';
import TrackerPageClient from '@/components/TrackerPageClient';
import { getTracker, trackers } from '@/lib/trackers';

type TrackerPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return trackers
    .filter((tracker) => tracker.status === 'live')
    .map((tracker) => ({ slug: tracker.slug }));
}

export async function generateMetadata({ params }: TrackerPageProps) {
  const { slug } = await params;
  const tracker = getTracker(slug);

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

export default async function TrackerPage({ params }: TrackerPageProps) {
  const { slug } = await params;
  const tracker = getTracker(slug);

  if (!tracker || tracker.status !== 'live') {
    notFound();
  }

  return <TrackerPageClient tracker={tracker} />;
}

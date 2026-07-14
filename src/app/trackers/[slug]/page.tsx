import { notFound } from 'next/navigation';
import TrackerPageClient from '@/components/TrackerPageClient';
import { getTracker, trackers } from '@/lib/trackers';
import { buildBreadcrumbJsonLd, buildTrackerWebPageJsonLd, trackerBreadcrumbItems, trackerCanonicalUrl, trackerKeywords, trackerSocialImage } from '@/lib/seo';

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
    keywords: trackerKeywords(tracker),
    alternates: {
      canonical: `/trackers/${tracker.slug}`,
    },
    openGraph: {
      title: `${tracker.title} Tracker`,
      description: tracker.description,
      url: trackerCanonicalUrl(tracker),
      type: 'website',
      images: [
        {
          url: trackerSocialImage(tracker),
          width: 1200,
          height: 630,
          alt: `${tracker.title} tracker`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${tracker.title} Tracker`,
      description: tracker.description,
      images: [trackerSocialImage(tracker)],
    },
  };
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

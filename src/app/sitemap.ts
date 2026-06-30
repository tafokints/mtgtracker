import { MetadataRoute } from 'next'
import { trackers } from '@/lib/trackers'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://mtgtrackers.com'

  const liveTrackerRoutes = trackers
    .filter((tracker) => tracker.status === 'live')
    .flatMap((tracker) => [
      {
        url: `${baseUrl}/trackers/${tracker.slug}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.9,
      },
      {
        url: `${baseUrl}/trackers/${tracker.slug}/stats`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      },
    ])

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/trackers`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    ...liveTrackerRoutes,
  ]
}

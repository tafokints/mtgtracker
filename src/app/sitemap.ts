import { MetadataRoute } from 'next'
import { serializedCatalog } from '@/lib/serialized-catalog'
import { allTrackers as trackers } from '@/lib/trackers'
import { catalogCheckedAt, printingPath, serializedPrintings, serializedSets } from '@/lib/serialized-printings'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://mtgtrackers.com'
  const staticRoutes = [
    '',
    '/trackers',
    '/sets',
    '/serialized-mtg-catalog',
    '/verification-guide',
    '/discoveries',
    '/about',
    '/contact',
    '/privacy',
    '/affiliate-disclosure',
    '/discoveries.json',
    '/discoveries.xml',
  ]

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
      {
        url: `${baseUrl}/trackers/${tracker.slug}/submit`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      },
    ])

  const catalogEntryRoutes = serializedCatalog.map((entry) => ({
    url: `${baseUrl}/serialized-mtg-catalog/${entry.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: entry.status === 'live' ? 0.65 : 0.5,
  }))

  return [
    ...staticRoutes.map((route) => ({
      url: `${baseUrl}${route}`,
      lastModified: new Date(),
      changeFrequency: route === '' || route === '/trackers' || route === '/serialized-mtg-catalog' || route === '/discoveries' ? 'daily' as const : 'monthly' as const,
      priority: route === '' ? 1 : route === '/trackers' ? 0.8 : route === '/serialized-mtg-catalog' ? 0.75 : route === '/discoveries' ? 0.7 : route === '/verification-guide' ? 0.6 : 0.4,
    })),
    ...catalogEntryRoutes,
    ...serializedSets.map((set) => ({ url: `${baseUrl}/sets/${set.slug}`, lastModified: catalogCheckedAt, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...serializedPrintings.map((printing) => ({ url: `${baseUrl}${printingPath(printing)}`, lastModified: catalogCheckedAt, changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...liveTrackerRoutes,
  ]
}

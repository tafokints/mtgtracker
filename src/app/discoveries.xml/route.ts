import { NextResponse } from 'next/server';
import { buildDiscoveriesRssFeed } from '@/lib/discovery-feed';
import { getPublicRecentDiscoveries } from '@/lib/recent-discoveries';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const discoveries = await getPublicRecentDiscoveries(20);
    return new NextResponse(buildDiscoveriesRssFeed(discoveries), {
      headers: {
        'content-type': 'application/rss+xml; charset=utf-8',
        'cache-control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error loading discoveries RSS feed:', error);
    return new NextResponse(buildDiscoveriesRssFeed([]), {
      headers: {
        'content-type': 'application/rss+xml; charset=utf-8',
        'cache-control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  }
}

import { NextResponse } from 'next/server';
import { buildDiscoveriesJsonFeed } from '@/lib/discovery-feed';
import { getPublicRecentDiscoveries } from '@/lib/recent-discoveries';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const discoveries = await getPublicRecentDiscoveries(20);
    return NextResponse.json(buildDiscoveriesJsonFeed(discoveries), {
      headers: {
        'cache-control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error loading discoveries JSON feed:', error);
    return NextResponse.json(buildDiscoveriesJsonFeed([]), {
      headers: {
        'cache-control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  }
}

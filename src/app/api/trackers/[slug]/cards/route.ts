import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { getTrackerCards, getTrackerSubmissions, withPendingReportCounts } from '@/lib/tracker-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const tracker = getTracker(slug);

  if (!tracker || tracker.status !== 'live') {
    return NextResponse.json({ message: 'Tracker not found' }, { status: 404 });
  }

  try {
    const redis = getRedis();
    const cards = await getTrackerCards(redis, tracker);
    const submissions = await getTrackerSubmissions(redis, tracker);

    return NextResponse.json(withPendingReportCounts(cards, submissions));
  } catch (error) {
    console.error('Error fetching tracker cards:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

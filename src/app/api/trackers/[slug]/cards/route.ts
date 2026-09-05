import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { withPendingReportCounts } from '@/lib/tracker-data';
import { getTrackerState, TrackerStoreError } from '@/lib/tracker-store';
import { activeCardEvents } from '@/lib/card-history';

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
    const { cards, submissions } = await getTrackerState(redis, tracker);

    return NextResponse.json(withPendingReportCounts(cards, submissions).map((card) => {
      const publicCard = { ...card, history: activeCardEvents(card) };
      delete publicCard.historyBaseline;
      return publicCard;
    }));
  } catch (error) {
    if (error instanceof TrackerStoreError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Error fetching tracker cards:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

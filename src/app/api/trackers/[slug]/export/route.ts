import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getRedis } from '@/lib/redis';
import { getTracker } from '@/lib/trackers';
import { getTrackerTotalSlots } from '@/lib/tracker-data';
import { getTrackerState } from '@/lib/tracker-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BACKUP_SCHEMA_VERSION = 1;

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { slug } = await params;
  const tracker = getTracker(slug);
  if (!tracker || tracker.status !== 'live') {
    return NextResponse.json({ message: 'Tracker not found' }, { status: 404 });
  }

  try {
    const redis = getRedis();
    const { cards, submissions } = await getTrackerState(redis, tracker);
    const generatedAt = new Date().toISOString();
    const backup = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      generatedAt,
      tracker: {
        slug: tracker.slug,
        title: tracker.title,
        total: tracker.total,
        totalSlots: getTrackerTotalSlots(tracker),
        storage: tracker.storage,
      },
      counts: {
        cards: cards.length,
        submissions: submissions.length,
      },
      cards,
      submissions,
    };
    const filenameDate = generatedAt.slice(0, 10);

    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${tracker.slug}-backup-${filenameDate}.json"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error exporting tracker backup:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

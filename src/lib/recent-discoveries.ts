import { getRedis } from '@/lib/redis';
import { trackers } from '@/lib/trackers';
import { getRecentTrackerDiscoveriesSnapshot } from '@/lib/tracker-data';

export async function getPublicRecentDiscoveries(limit = 20) {
  const redis = getRedis();
  return getRecentTrackerDiscoveriesSnapshot(
    redis,
    trackers.filter((tracker) => tracker.status === 'live'),
    limit,
  );
}

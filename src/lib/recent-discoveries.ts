import { getRedis } from '@/lib/redis';
import { generatedTrackers, trackers } from '@/lib/trackers';
import { ACTIVE_PRINTING_TRACKERS_KEY } from '@/lib/tracker-store';
import { getRecentTrackerDiscoveriesSnapshot } from '@/lib/tracker-data';

export async function getPublicRecentDiscoveries(limit = 20) {
  const redis = getRedis();
  const active = new Set(await redis.smembers<string[]>(ACTIVE_PRINTING_TRACKERS_KEY));
  return getRecentTrackerDiscoveriesSnapshot(
    redis,
    [...trackers, ...generatedTrackers.filter((tracker) => active.has(tracker.slug))].filter((tracker) => tracker.status === 'live'),
    limit,
  );
}

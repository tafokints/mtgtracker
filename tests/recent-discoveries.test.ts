import { afterEach, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ smembers: vi.fn(), snapshot: vi.fn() }));
vi.mock('@/lib/redis', () => ({ getRedis: () => ({ smembers: fixture.smembers }) }));
vi.mock('@/lib/tracker-data', () => ({ getRecentTrackerDiscoveriesSnapshot: fixture.snapshot }));

import { getPublicRecentDiscoveries } from '@/lib/recent-discoveries';
import { ACTIVE_PRINTING_TRACKERS_KEY } from '@/lib/tracker-store';
import { generatedTrackers, trackers } from '@/lib/trackers';

afterEach(() => vi.clearAllMocks());

it('reads only featured and active printing trackers, not hundreds of untouched keys', async () => {
  fixture.smembers.mockResolvedValue([generatedTrackers[0].slug, 'unknown-stale-slug']);
  fixture.snapshot.mockResolvedValue([]);
  expect(await getPublicRecentDiscoveries(10)).toEqual([]);
  expect(fixture.smembers).toHaveBeenCalledWith(ACTIVE_PRINTING_TRACKERS_KEY);
  expect(fixture.snapshot).toHaveBeenCalledWith(expect.anything(), [
    ...trackers.filter((tracker) => tracker.status === 'live'), generatedTrackers[0],
  ], 10);
});

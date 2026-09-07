import fs from 'node:fs';
import path from 'node:path';
import { loadProjectModule as loadTsModule } from './lib/load-project-module.mjs';
import { assertMinimalHealth, checkOwnerBoundary } from './lib/security-smoke.mjs';

const rootDir = process.cwd();
const trackerPath = path.join(rootDir, 'src', 'lib', 'trackers.ts');
const catalogPath = path.join(rootDir, 'src', 'lib', 'serialized-catalog.ts');
const baseUrl = normalizeBaseUrl(process.env.SMOKE_BASE_URL || process.argv[2] || 'https://mtgtrackers.com');
const canonicalBaseUrl = normalizeBaseUrl(process.env.SMOKE_CANONICAL_BASE_URL || baseUrl);
const skipHealth = process.env.SMOKE_SKIP_HEALTH === '1';

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function loadTrackerModule() {
  return loadTsModule(trackerPath);
}

function loadSerializedCatalogModule() {
  return loadTsModule(catalogPath);
}

async function fetchText(pathname, expectedStatus = 200) {
  const url = `${baseUrl}${pathname}`;
  const response = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
    headers: {
      'User-Agent': 'MTGTrackers/0.1 smoke-check contact mtgtrackers.com',
    },
  });
  const text = await response.text();

  if (response.status !== expectedStatus) {
    throw new Error(`${pathname} expected ${expectedStatus}, got ${response.status}`);
  }

  return { response, text };
}

function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) {
    throw new Error(`${label} missing "${needle}"`);
  }
}

async function checkPage(pathname, needles) {
  const { text } = await fetchText(pathname);

  for (const needle of needles) {
    assertIncludes(text.replaceAll('<!-- -->', ''), needle, pathname);
  }

  return { path: pathname, ok: true };
}

async function checkBreadcrumbJsonLd(pathname, expectedNames) {
  const { text } = await fetchText(pathname);

  assertIncludes(text, 'BreadcrumbList', `${pathname} breadcrumb JSON-LD`);

  for (const name of expectedNames) {
    assertIncludes(text, `"name":"${name}"`, `${pathname} breadcrumb JSON-LD`);
  }

  return { path: `${pathname} breadcrumbs`, ok: true };
}

function checkSourceFile(relativePath, needles) {
  const text = fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

  for (const needle of needles) {
    assertIncludes(text, needle, relativePath);
  }

  return { path: relativePath, ok: true };
}

function checkSourceFileExcludes(relativePath, needles) {
  const text = fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

  for (const needle of needles) {
    if (text.includes(needle)) {
      throw new Error(`${relativePath} still contains "${needle}"`);
    }
  }

  return { path: `${relativePath} excludes`, ok: true };
}

async function checkHealth() {
  const { text } = await fetchText('/api/health');
  const health = JSON.parse(text);

  assertMinimalHealth(health);

  return { path: '/api/health', ok: true };
}

async function checkTrackerData(tracker) {
  const pathname = `/api/trackers/${tracker.slug}/cards`;
  const { text } = await fetchText(pathname);
  const cards = JSON.parse(text);
  const expected = tracker.cardDefinitions?.length
    ? tracker.cardDefinitions.reduce((sum, card) => sum + (card.total || tracker.total), 0)
    : tracker.total;
  if (!Array.isArray(cards) || cards.length !== expected || cards.some((card, index) => card.id !== index + 1 || typeof card.found !== 'boolean')) {
    throw new Error(`${pathname} did not return its ${expected} numbered slots`);
  }
  return { path: pathname, ok: true };
}

async function checkSitemap(liveTrackers, catalogEntries, printingModule) {
  const { text } = await fetchText('/sitemap.xml');
  const requiredUrls = [
    `${canonicalBaseUrl}/`,
    `${canonicalBaseUrl}/trackers`,
    `${canonicalBaseUrl}/sets`,
    `${canonicalBaseUrl}/serialized-mtg-catalog`,
    `${canonicalBaseUrl}/verification-guide`,
    `${canonicalBaseUrl}/discoveries`,
    `${canonicalBaseUrl}/about`,
    `${canonicalBaseUrl}/contact`,
    `${canonicalBaseUrl}/privacy`,
    `${canonicalBaseUrl}/affiliate-disclosure`,
    `${canonicalBaseUrl}/discoveries.json`,
    `${canonicalBaseUrl}/discoveries.xml`,
    ...liveTrackers.flatMap((tracker) => [
      `${canonicalBaseUrl}/trackers/${tracker.slug}`,
      `${canonicalBaseUrl}/trackers/${tracker.slug}/stats`,
      `${canonicalBaseUrl}/trackers/${tracker.slug}/submit`,
    ]),
    ...catalogEntries.map((entry) => `${canonicalBaseUrl}/serialized-mtg-catalog/${entry.slug}`),
    ...printingModule.serializedSets.map((set) => `${canonicalBaseUrl}/sets/${set.slug}`),
    ...printingModule.serializedPrintings.map((printing) => `${canonicalBaseUrl}${printingModule.printingPath(printing)}`),
  ];

  for (const url of requiredUrls) {
    assertIncludes(text, url, '/sitemap.xml');
  }

  if (text.includes(`${canonicalBaseUrl}/admin`)) throw new Error('/admin must not appear in the public sitemap');

  return { path: '/sitemap.xml', ok: true };
}

async function checkRobots() {
  const { text } = await fetchText('/robots.txt');

  assertIncludes(text, 'User-agent: *', '/robots.txt');
  assertIncludes(text, 'Allow: /', '/robots.txt');
  assertIncludes(text, `Sitemap: ${canonicalBaseUrl}/sitemap.xml`, '/robots.txt');
  assertIncludes(text, 'Disallow: /api/', '/robots.txt');

  return { path: '/robots.txt', ok: true };
}

async function checkDiscoveryJsonFeed() {
  const { response, text } = await fetchText('/discoveries.json');
  const feed = JSON.parse(text);

  if (feed.version !== 'https://jsonfeed.org/version/1.1') {
    throw new Error('/discoveries.json is not a JSON Feed 1.1 document');
  }

  if (feed.feed_url !== `${canonicalBaseUrl}/discoveries.json`) {
    throw new Error('/discoveries.json has an unexpected feed_url');
  }

  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('/discoveries.json did not return JSON content type');
  }

  return { path: '/discoveries.json', ok: true };
}

async function checkDiscoveryRssFeed() {
  const { response, text } = await fetchText('/discoveries.xml');

  assertIncludes(text, '<rss version="2.0">', '/discoveries.xml');
  assertIncludes(text, '<title>MTG Trackers Recent Discoveries</title>', '/discoveries.xml');
  assertIncludes(text, `${canonicalBaseUrl}/discoveries.xml`, '/discoveries.xml');

  if (!response.headers.get('content-type')?.includes('application/rss+xml')) {
    throw new Error('/discoveries.xml did not return RSS content type');
  }

  return { path: '/discoveries.xml', ok: true };
}

async function main() {
  const { trackers, allTrackers } = loadTrackerModule();
  const printingModule = loadTsModule(path.join(rootDir, 'src/lib/serialized-printings.ts'));
  const { serializedCatalog } = loadSerializedCatalogModule();
  const liveTrackers = trackers.filter((tracker) => tracker.status === 'live');
  const sampleCatalogEntry = serializedCatalog.find((entry) => entry.slug === 'aetherdrift-aetherspark') || serializedCatalog[0];
  const checks = [
    checkPage('/', ['MTG Trackers', 'Featured Trackers', 'BreadcrumbList', '<meta name="impact-site-verification" value="20d9178f-daf3-44b2-924a-9f8eec1387be"/>']),
    checkPage('/trackers', ['Featured Trackers', 'All Serialized Treatments', 'Marketplace links are affiliate links', 'BreadcrumbList']),
    checkPage('/sets', ['Serialized MTG Sets', 'released English printings', '/sets/the-brothers-war']),
    checkPage('/sets/the-brothers-war', ['Card Printings', 'Search card printings', 'Printing language', 'Mox Amber']),
    checkPage('/serialized-mtg-catalog/bro-retro-schematic-artifacts/mox-amber-98z', ['Mox Amber', 'Numbered copies', 'Open Serial Tracker', 'eBay Partner Network', 'Amazon Associate', 'BreadcrumbList']),
    checkPage('/trackers/card-brr-98z', ['Mox Amber Tracker', 'CollectionPage', 'BreadcrumbList']),
    checkPage('/trackers/card-brr-98z/submit', ['Mox Amber', 'Serials 1 to 500', 'Photos', 'inputMode="numeric"']),
    checkPage('/serialized-mtg-catalog', ['Serialized MTG Catalog', 'Marketplace Research', 'Reporting open', 'Request tracker', 'CollectionPage', 'BreadcrumbList']),
    checkPage(`/serialized-mtg-catalog/${sampleCatalogEntry.slug}`, [sampleCatalogEntry.title, 'Marketplace Research', 'Tracker Notes', 'Open Live Tracker', 'Dataset', 'BreadcrumbList']),
    checkPage('/verification-guide', ['Serialized MTG Verification Guide', 'Verification Status', 'Best Evidence', 'Fastest Approval Path', 'WebPage', 'BreadcrumbList']),
    checkPage('/discoveries', ['Recent Discoveries', 'Discovery Feeds', 'JSON Feed', 'RSS Feed', 'CollectionPage', 'BreadcrumbList']),
    checkPage('/trackers/one-ring?serial=001', [
      'The One Ring 001/100 | MTG Trackers',
      `${canonicalBaseUrl}/trackers/one-ring?serial=001`,
      'ItemPage',
      'The One Ring 001/100 Tracker',
    ]),
    checkPage('/about', ['About MTG Trackers', 'BreadcrumbList']),
    checkPage('/contact', ['Contact', 'Open GitHub Issue', 'BreadcrumbList']),
    checkPage('/privacy', ['Privacy', 'IP-based rate limits', 'stored privately in Vercel Blob', 'sexual-content screening', 'BreadcrumbList']),
    checkPage('/affiliate-disclosure', ['Affiliate Disclosure', 'eBay Partner Network', 'Amazon Associate', 'BreadcrumbList']),
    ...(skipHealth ? [] : [checkHealth()]),
    ...(skipHealth ? [] : [...liveTrackers, allTrackers.find((tracker) => tracker.slug === 'card-brr-98z')].map(checkTrackerData)),
    checkRobots(),
    checkSitemap(allTrackers.filter((tracker) => tracker.status === 'live'), serializedCatalog, printingModule),
    checkDiscoveryJsonFeed(),
    checkDiscoveryRssFeed(),
    checkBreadcrumbJsonLd('/affiliate-disclosure', ['MTG Trackers', 'Affiliate Disclosure']),
    checkBreadcrumbJsonLd('/serialized-mtg-catalog', ['MTG Trackers', 'Serialized MTG Catalog']),
    checkBreadcrumbJsonLd(`/serialized-mtg-catalog/${sampleCatalogEntry.slug}`, ['MTG Trackers', 'Serialized MTG Catalog', sampleCatalogEntry.title]),
    checkBreadcrumbJsonLd('/verification-guide', ['MTG Trackers', 'Verification Guide']),
    checkBreadcrumbJsonLd('/discoveries', ['MTG Trackers', 'Recent Discoveries']),
    checkSourceFile('src/components/TrackerPageClient.tsx', [
      'TrackerMarketTrustStrip',
      'PrimaryAffiliateCtas',
      'TrackerPagination',
      'AffiliateDisclosureNotice',
      'tracker-marketplace',
    ]),
    checkSourceFileExcludes('src/components/TrackerPageClient.tsx', ['WebApplication', 'next/head']),
    checkSourceFile('src/components/TrackerStatsClient.tsx', [
      'AffiliateDisclosureNotice',
      'TrackerMarketTrustStrip',
      'tracker-stats-cta',
    ]),
    checkSourceFileExcludes('src/components/TrackerSubmitClient.tsx', ['next/head', "'@type': 'Form'"]),
    checkSourceFile('src/components/TrackerSubmitClient.tsx', ['Verification standards', '/verification-guide']),
    checkSourceFile('src/app/discoveries/page.tsx', ['AffiliateOutboundLink', 'AffiliateDisclosureNotice', 'PublicDiscoveryShareActions', 'public_copy', 'discoveries-page']),
    checkSourceFile('src/lib/affiliate-placements.ts', ['tracker-stats-cta', 'serial-detail', 'discoveries-page']),
    ...liveTrackers.flatMap((tracker) => [
      checkPage(`/trackers/${tracker.slug}`, [
        tracker.title,
        `${tracker.title} Tracker`,
        'Collector Notes',
        `${tracker.title} Market Context`,
        'FAQ',
        `${tracker.title} Frequently Asked Questions`,
        'FAQPage',
        'CollectionPage',
        'BreadcrumbList',
        'application/ld+json',
      ]),
      checkPage(`/trackers/${tracker.slug}/stats`, [
        `${tracker.title} Statistics`,
        'Collector Notes',
        `${tracker.title} Market Context`,
        'BreadcrumbList',
        'Dataset',
        `${tracker.title} Serialized Card Statistics`,
      ]),
      checkPage(`/trackers/${tracker.slug}/submit`, ['Report a Find', 'Reports are queued for admin review', 'Additional details (optional)', 'Photos stay on your device until you submit.', 'Source Link', 'Photos', 'Submit report', 'BreadcrumbList', 'ContactPage', `${tracker.title} Discovery Report`]),
      checkBreadcrumbJsonLd(`/trackers/${tracker.slug}`, ['MTG Trackers', 'Trackers', tracker.title]),
      checkBreadcrumbJsonLd(`/trackers/${tracker.slug}/stats`, ['MTG Trackers', 'Trackers', tracker.title, 'Stats']),
      checkBreadcrumbJsonLd(`/trackers/${tracker.slug}/submit`, ['MTG Trackers', 'Trackers', tracker.title, 'Report a Find']),
    ]),
  ];

  const outcomes = await Promise.allSettled(checks);
  const results = outcomes.flatMap((outcome) => outcome.status === 'fulfilled' ? [outcome.value] : []);
  const failures = outcomes.flatMap((outcome) => outcome.status === 'rejected' ? [outcome.reason] : []);
  try { results.push(...await checkOwnerBoundary(baseUrl)); } catch (error) { failures.push(error); }

  console.table(results.map((result) => ({ path: result.path, ok: result.ok })));
  if (failures.length) throw new Error(failures.map((error) => error instanceof Error ? error.message : String(error)).join('\n'));
  console.log(`Smoke checks passed for ${baseUrl}`);
}

main().catch((error) => {
  console.error(`Smoke check failed for ${baseUrl}:`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

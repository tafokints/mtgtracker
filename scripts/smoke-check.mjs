import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const rootDir = process.cwd();
const trackerPath = path.join(rootDir, 'src', 'lib', 'trackers.ts');
const catalogPath = path.join(rootDir, 'src', 'lib', 'serialized-catalog.ts');
const baseUrl = normalizeBaseUrl(process.env.SMOKE_BASE_URL || process.argv[2] || 'https://mtgtrackers.com');
const canonicalBaseUrl = normalizeBaseUrl(process.env.SMOKE_CANONICAL_BASE_URL || baseUrl);
const skipHealth = process.env.SMOKE_SKIP_HEALTH === '1';

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function loadTsModule(modulePath) {
  const source = fs.readFileSync(modulePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const sandbox = {
    URLSearchParams,
    exports: {},
    module: { exports: {} },
  };

  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(transpiled, sandbox, { filename: modulePath });

  return sandbox.module.exports;
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
    assertIncludes(text, needle, pathname);
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

  if (health.ok !== true) {
    throw new Error('/api/health did not return ok: true');
  }

  return { path: '/api/health', ok: true };
}

async function checkSitemap(liveTrackers, catalogEntries) {
  const { text } = await fetchText('/sitemap.xml');
  const requiredUrls = [
    `${canonicalBaseUrl}/`,
    `${canonicalBaseUrl}/trackers`,
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
  ];

  for (const url of requiredUrls) {
    assertIncludes(text, url, '/sitemap.xml');
  }

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
  const { trackers } = loadTrackerModule();
  const { serializedCatalog } = loadSerializedCatalogModule();
  const liveTrackers = trackers.filter((tracker) => tracker.status === 'live');
  const sampleCatalogEntry = serializedCatalog.find((entry) => entry.slug === 'aetherdrift-aetherspark') || serializedCatalog[0];
  const checks = [
    checkPage('/', ['MTG Trackers', 'Live Trackers', 'BreadcrumbList']),
    checkPage('/trackers', ['Trackers', 'Serialized Scaffold Queue', 'Marketplace links are affiliate links', 'BreadcrumbList']),
    checkPage('/serialized-mtg-catalog', ['Serialized MTG Catalog', 'Marketplace Research', 'Live tracker', 'Request tracker', 'CollectionPage', 'BreadcrumbList']),
    checkPage(`/serialized-mtg-catalog/${sampleCatalogEntry.slug}`, [sampleCatalogEntry.title, 'Marketplace Research', 'Tracker Notes', 'Request Tracker', 'Dataset', 'BreadcrumbList']),
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
    checkPage('/privacy', ['Privacy', 'rate limiting', 'BreadcrumbList']),
    checkPage('/affiliate-disclosure', ['Affiliate Disclosure', 'eBay Partner Network', 'Amazon Associate', 'BreadcrumbList']),
    ...(skipHealth ? [] : [checkHealth()]),
    checkRobots(),
    checkSitemap(liveTrackers, serializedCatalog),
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
      'tracker-filtered-cta',
      'tracker-marketplace',
    ]),
    checkSourceFileExcludes('src/components/TrackerPageClient.tsx', ['WebApplication', 'next/head']),
    checkSourceFile('src/components/TrackerStatsClient.tsx', [
      'AffiliateDisclosureNotice',
      'TrackerMarketTrustStrip',
      'tracker-stats-cta',
    ]),
    checkSourceFileExcludes('src/components/TrackerSubmitClient.tsx', ['next/head', "'@type': 'Form'"]),
    checkSourceFile('src/components/TrackerSubmitClient.tsx', ['Read the verification guide', '/verification-guide']),
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
      checkPage(`/trackers/${tracker.slug}/submit`, ['Report a Find', 'Reports are queued for admin review', 'Evidence Quality Checklist', 'Source or evidence image added', 'Source Link', 'Upload Evidence Images', 'BreadcrumbList', 'ContactPage', `${tracker.title} Discovery Report`]),
      checkBreadcrumbJsonLd(`/trackers/${tracker.slug}`, ['MTG Trackers', 'Trackers', tracker.title]),
      checkBreadcrumbJsonLd(`/trackers/${tracker.slug}/stats`, ['MTG Trackers', 'Trackers', tracker.title, 'Stats']),
      checkBreadcrumbJsonLd(`/trackers/${tracker.slug}/submit`, ['MTG Trackers', 'Trackers', tracker.title, 'Report a Find']),
    ]),
  ];

  const results = await Promise.all(checks);

  console.table(results.map((result) => ({ path: result.path, ok: result.ok })));
  console.log(`Smoke checks passed for ${baseUrl}`);
}

main().catch((error) => {
  console.error(`Smoke check failed for ${baseUrl}:`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

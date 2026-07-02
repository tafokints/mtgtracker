import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const rootDir = process.cwd();
const trackerPath = path.join(rootDir, 'src', 'lib', 'trackers.ts');
const baseUrl = normalizeBaseUrl(process.env.SMOKE_BASE_URL || process.argv[2] || 'https://mtgtrackers.com');

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function loadTrackerModule() {
  const source = fs.readFileSync(trackerPath, 'utf8');
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
  vm.runInNewContext(transpiled, sandbox, { filename: trackerPath });

  return sandbox.module.exports;
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

async function checkHealth() {
  const { text } = await fetchText('/api/health');
  const health = JSON.parse(text);

  if (health.ok !== true) {
    throw new Error('/api/health did not return ok: true');
  }

  return { path: '/api/health', ok: true };
}

async function checkSitemap(liveTrackers) {
  const { text } = await fetchText('/sitemap.xml');
  const requiredUrls = [
    `${baseUrl}/`,
    `${baseUrl}/trackers`,
    `${baseUrl}/affiliate-disclosure`,
    ...liveTrackers.flatMap((tracker) => [
      `${baseUrl}/trackers/${tracker.slug}`,
      `${baseUrl}/trackers/${tracker.slug}/stats`,
    ]),
  ];

  for (const url of requiredUrls) {
    assertIncludes(text, url, '/sitemap.xml');
  }

  return { path: '/sitemap.xml', ok: true };
}

async function main() {
  const { trackers } = loadTrackerModule();
  const liveTrackers = trackers.filter((tracker) => tracker.status === 'live');
  const checks = [
    checkPage('/', ['MTG Trackers', 'Live Trackers']),
    checkPage('/trackers', ['Trackers', 'Serialized Scaffold Queue', 'Marketplace links are affiliate links']),
    checkPage('/affiliate-disclosure', ['Affiliate Disclosure', 'eBay Partner Network', 'Amazon Associate']),
    checkHealth(),
    checkSitemap(liveTrackers),
    ...liveTrackers.flatMap((tracker) => [
      checkPage(`/trackers/${tracker.slug}`, [tracker.title, `${tracker.title} Tracker`, 'CollectionPage', 'application/ld+json']),
      checkPage(`/trackers/${tracker.slug}/stats`, [`${tracker.title} Statistics`]),
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

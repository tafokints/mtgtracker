import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const trackerPath = path.join(rootDir, 'src', 'lib', 'trackers.ts');

function loadModule(modulePath) {
  const source = fs.readFileSync(modulePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const sandbox = {
    URL,
    URLSearchParams,
    exports: {},
    module: { exports: {} },
  };

  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(transpiled, sandbox, { filename: modulePath });

  return sandbox.module.exports;
}

function collectLinks(trackers, defaultAffiliateLinks) {
  const links = new Map();

  for (const link of defaultAffiliateLinks) {
    links.set(`default:${link.merchant}:${link.href}`, { tracker: 'default', ...link });
  }

  for (const tracker of trackers) {
    for (const link of tracker.affiliateLinks || defaultAffiliateLinks) {
      links.set(`${tracker.slug}:${link.merchant}:${link.href}`, { tracker: tracker.slug, ...link });
    }
  }

  return [...links.values()];
}

export function assertUrlShape(link) {
  const url = new URL(link.href);
  const expectedIntentByMerchant = {
    tcgplayer: 'singles',
    ebay: 'auction-comps',
    amazon: 'sealed-product',
  };

  if (!['https:'].includes(url.protocol)) {
    throw new Error(`${link.tracker} ${link.label} must use https`);
  }
  if (url.username || url.password || url.port) {
    throw new Error(`${link.tracker} ${link.label} must not contain credentials or a custom port`);
  }
  for (const key of new Set(url.searchParams.keys())) {
    if (url.searchParams.getAll(key).length !== 1) throw new Error(`${link.tracker} ${link.label} has duplicate ${key} parameters`);
  }

  if (!link.intent) {
    throw new Error(`${link.tracker} ${link.label} is missing affiliate intent`);
  }

  if (expectedIntentByMerchant[link.merchant] && link.intent !== expectedIntentByMerchant[link.merchant]) {
    throw new Error(`${link.tracker} ${link.label} ${link.merchant} intent must be ${expectedIntentByMerchant[link.merchant]}`);
  }

  if (link.merchant === 'ebay') {
    if (!/(^|\.)ebay\.com$/.test(url.hostname)) {
      throw new Error(`${link.tracker} ${link.label} must point to ebay.com`);
    }
    if (url.searchParams.get('campid') !== '5339113954') {
      throw new Error(`${link.tracker} ${link.label} is missing eBay campaign id`);
    }
    if (!url.searchParams.get('customid')) {
      throw new Error(`${link.tracker} ${link.label} is missing eBay customid`);
    }
    const expectedCustomId = link.tracker === 'default' ? 'serialized-mtg' : link.tracker;
    if (url.searchParams.get('customid') !== expectedCustomId) {
      throw new Error(`${link.tracker} ${link.label} eBay customid must be ${expectedCustomId}`);
    }
    if (!url.searchParams.get('_nkw')) {
      throw new Error(`${link.tracker} ${link.label} is missing eBay search query`);
    }
    for (const [key, value] of Object.entries({ mkcid: '1', mkrid: '711-53200-19255-0', siteid: '0', mkevt: '1', toolid: '20012' })) {
      if (url.searchParams.get(key) !== value) throw new Error(`${link.tracker} ${link.label} has invalid eBay ${key}`);
    }
  }

  if (link.merchant === 'amazon') {
    if (!/(^|\.)amazon\.com$/.test(url.hostname)) {
      throw new Error(`${link.tracker} ${link.label} must point to amazon.com`);
    }
    if (url.searchParams.get('tag') !== 'meleeitonme0a-20') {
      throw new Error(`${link.tracker} ${link.label} is missing Amazon associate tag`);
    }
    if (!url.searchParams.get('k')) throw new Error(`${link.tracker} ${link.label} is missing an Amazon search query`);
  }

  if (link.merchant === 'tcgplayer') {
    if (url.hostname !== 'partner.tcgplayer.com') {
      throw new Error(`${link.tracker} ${link.label} must use the TCGplayer partner redirect`);
    }
    if (url.pathname !== '/DyJ25G') {
      throw new Error(`${link.tracker} ${link.label} is missing the TCGplayer partner link id`);
    }
  }
}

export function assessResponse(link, result) {
  if ([403, 429].includes(result.status)) return { outcome: 'manual-review', reason: 'Merchant blocked automated checking; destination not verified.' };
  if (!result.ok) return { outcome: 'failed', reason: result.error || `HTTP ${result.status}` };

  try {
    const finalUrl = new URL(result.finalUrl);
    if (link.merchant === 'tcgplayer') {
      const expected = { irpid: '6334129', irgwc: '1', utm_source: 'impact' };
      if (finalUrl.protocol !== 'https:' || !/(^|\.)tcgplayer\.com$/.test(finalUrl.hostname)
        || finalUrl.username || finalUrl.password || finalUrl.port
        || !finalUrl.searchParams.get('irclickid')
        || Object.entries(expected).some(([key, value]) => finalUrl.searchParams.get(key) !== value)) {
        throw new Error('TCGplayer redirect did not preserve the configured Impact attribution.');
      }
    } else {
      assertUrlShape({ ...link, href: result.finalUrl });
    }
    return { outcome: 'verified', reason: 'Destination and attribution parameters checked.' };
  } catch (error) {
    return { outcome: 'failed', reason: error.message };
  }
}

async function fetchStatusOnce(link) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(link.href, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'MTGTrackers/0.1 affiliate-link-check contact mtgtrackers.com',
      },
    });

    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
    };
  } catch (error) {
    return {
      ok: false,
      status: 'ERROR',
      finalUrl: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchStatus(link) {
  let lastResult;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    lastResult = await fetchStatusOnce(link);
    if (lastResult.ok || lastResult.status !== 'ERROR') {
      return lastResult;
    }
  }

  return lastResult;
}

async function main() {
  const { trackers, defaultAffiliateLinks, getSerialAffiliateLinks, getCatalogAffiliateLinks } = loadModule(trackerPath);
  const { serializedCatalog } = loadModule(path.join(rootDir, 'src', 'lib', 'serialized-catalog.ts'));
  const links = collectLinks(trackers, defaultAffiliateLinks);

  const dynamicLinks = trackers.filter((tracker) => tracker.status === 'live').flatMap((tracker) => (
    (tracker.cardDefinitions || [{ title: tracker.title, total: tracker.total }]).flatMap((card) => (
      [1, card.total || tracker.total].flatMap((serial) => getSerialAffiliateLinks(tracker, {
        cardTitle: card.title,
        serialTotal: card.total || tracker.total,
        serialNumber: String(serial).padStart(card.serialPadding || tracker.serialPadding, '0'),
      }).map((link) => ({ tracker: tracker.slug, ...link })))
    ))
  ));
  const catalogLinks = serializedCatalog.flatMap((entry) => getCatalogAffiliateLinks(entry).map((link) => ({ tracker: 'default', ...link })));

  for (const link of [...links, ...dynamicLinks, ...catalogLinks]) {
    assertUrlShape(link);
  }
  console.log(`URL checks passed for ${links.length} configured, ${dynamicLinks.length} serial-boundary, and ${catalogLinks.length} catalog links.`);
  if (process.argv.includes('--offline')) return;

  const results = [];
  const destinationResults = new Map();
  for (const link of links) {
    const result = destinationResults.get(link.href) || await fetchStatus(link);
    destinationResults.set(link.href, result);
    results.push({
      tracker: link.tracker,
      merchant: link.merchant,
      label: link.label,
      status: result.status,
      ...assessResponse(link, result),
      finalUrl: result.finalUrl,
      error: result.error,
    });
  }

  console.table(results.map(({ tracker, merchant, status, outcome }) => ({ tracker, merchant, status, outcome })));

  const manualChecks = results.filter((result) => result.outcome === 'manual-review');
  if (manualChecks.length) console.warn(`${manualChecks.length} checks need a browser/merchant-dashboard review. Bot blocks are not verified passes.`);
  console.log('These checks verify URLs, not account approval or earned commissions. Confirm earnings in merchant reports.');

  const failures = results.filter((result) => result.outcome === 'failed');
  if (failures.length > 0) {
    console.error('Affiliate link validation failures:');
    for (const failure of failures) {
      console.error(`${failure.tracker} ${failure.merchant} ${failure.label}: ${failure.reason}`);
    }
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

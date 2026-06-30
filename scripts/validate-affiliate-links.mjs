import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const rootDir = process.cwd();
const trackerPath = path.join(rootDir, 'src', 'lib', 'trackers.ts');

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

function assertUrlShape(link) {
  const url = new URL(link.href);

  if (!['https:'].includes(url.protocol)) {
    throw new Error(`${link.tracker} ${link.label} must use https`);
  }

  if (link.merchant === 'ebay') {
    if (!url.hostname.endsWith('ebay.com')) {
      throw new Error(`${link.tracker} ${link.label} must point to ebay.com`);
    }
    if (url.searchParams.get('campid') !== '5339113954') {
      throw new Error(`${link.tracker} ${link.label} is missing eBay campaign id`);
    }
    if (!url.searchParams.get('customid')) {
      throw new Error(`${link.tracker} ${link.label} is missing eBay customid`);
    }
    if (!url.searchParams.get('_nkw')) {
      throw new Error(`${link.tracker} ${link.label} is missing eBay search query`);
    }
  }

  if (link.merchant === 'amazon') {
    if (!url.hostname.endsWith('amazon.com')) {
      throw new Error(`${link.tracker} ${link.label} must point to amazon.com`);
    }
    if (url.searchParams.get('tag') !== 'meleeitonme0a-20') {
      throw new Error(`${link.tracker} ${link.label} is missing Amazon associate tag`);
    }
  }

  if (link.merchant === 'tcgplayer') {
    if (url.hostname !== 'partner.tcgplayer.com') {
      throw new Error(`${link.tracker} ${link.label} must use the TCGplayer partner redirect`);
    }
    if (!url.pathname.includes('DyJ25G')) {
      throw new Error(`${link.tracker} ${link.label} is missing the TCGplayer partner link id`);
    }
  }
}

async function fetchStatus(link) {
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
      ok: response.ok || (link.merchant === 'ebay' && response.status === 403),
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

async function main() {
  const { trackers, defaultAffiliateLinks } = loadTrackerModule();
  const links = collectLinks(trackers, defaultAffiliateLinks);

  for (const link of links) {
    assertUrlShape(link);
  }

  const results = [];
  for (const link of links) {
    const result = await fetchStatus(link);
    results.push({
      tracker: link.tracker,
      merchant: link.merchant,
      label: link.label,
      status: result.status,
      ok: result.ok && (
        link.merchant !== 'tcgplayer' ||
        (
          result.finalUrl.includes('irclickid=') &&
          result.finalUrl.includes('irpid=6334129') &&
          result.finalUrl.includes('irgwc=1') &&
          result.finalUrl.includes('utm_source=impact')
        )
      ),
      finalUrl: result.finalUrl,
      error: result.error,
    });
  }

  console.table(results.map(({ tracker, merchant, label, status, ok }) => ({ tracker, merchant, label, status, ok })));

  const failures = results.filter((result) => !result.ok);
  if (failures.length > 0) {
    console.error('Affiliate link validation failures:');
    for (const failure of failures) {
      console.error(`${failure.tracker} ${failure.merchant} ${failure.label}: ${failure.status} ${failure.error || failure.finalUrl}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

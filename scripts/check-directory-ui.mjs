import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { loadProjectModule } from './lib/load-project-module.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const base = process.env.COLLECTOR_UI_BASE_URL || 'http://127.0.0.1:3106';
assert.equal(new URL(base).hostname, '127.0.0.1', 'Directory UI checks must stay local');
const { trackers } = loadProjectModule(path.resolve('src/lib/trackers.ts'));
const live = trackers.filter((tracker) => tracker.status === 'live');
await mkdir('node_modules/.cache', { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route(`${base}/api/**`, (route) => route.fulfill({ status: 204, body: '' }));
    const noOverflow = async () => {
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Page overflow at ${width}: ${page.url()}`);
      assert.ok(await page.locator('h1, h2, h3, main a').evaluateAll((elements) => elements.every((element) => element.scrollWidth <= element.clientWidth + 1 || getComputedStyle(element).display === 'inline')), `Text overflow at ${width}: ${page.url()}`);
    };

    await page.goto(`${base}/`);
    const featured = page.getByRole('region', { name: 'Featured Trackers', exact: true });
    const recent = page.getByRole('region', { name: 'Recent Discoveries', exact: true });
    assert.equal(await featured.locator('article').count(), live.length);
    assert.equal(await page.locator('a[rel~="sponsored"]').count(), 0, 'Homepage has no affiliate placements');
    assert.ok((await featured.boundingBox()).y < (await recent.boundingBox()).y, 'Browsing comes before recent activity');
    assert.ok((await featured.boundingBox()).y < 700, 'Featured trackers should be visible near the top');
    assert.equal(await page.getByRole('navigation', { name: 'Browse MTG Trackers' }).getByRole('link', { name: 'Browse All Sets' }).getAttribute('href'), '/sets');
    for (const tracker of live) {
      const card = featured.locator('article').filter({ has: page.getByRole('heading', { name: tracker.displayTitle || tracker.title, exact: true }) });
      assert.equal(await card.getByRole('link', { name: 'Open Tracker', exact: true }).getAttribute('href'), tracker.href);
      assert.equal(await card.getByRole('link', { name: 'Report a Find', exact: true }).getAttribute('href'), `${tracker.href}/submit`);
      const artwork = card.getByRole('img');
      await artwork.scrollIntoViewIfNeeded();
      await artwork.evaluate((image) => image.decode());
      assert.ok(await artwork.evaluate((image) => image.naturalWidth > 0));
    }
    const planned = page.getByRole('region', { name: 'Planned', exact: true });
    assert.equal(await planned.getByRole('link', { name: /Open Tracker|Report a Find/ }).count(), 0);
    await noOverflow();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `node_modules/.cache/directory-home-${width}.png` });
    await featured.locator('article').first().screenshot({ path: `node_modules/.cache/directory-home-card-${width}.png` });
    await featured.getByRole('link', { name: 'Open Tracker', exact: true }).first().click();
    await page.waitForURL(`${base}${live[0].href}`);

    await page.goto(`${base}/trackers`);
    const notices = page.getByRole('note');
    assert.equal(await notices.count(), 1, 'Directory has exactly one page-wide disclosure');
    const notice = notices.first();
    assert.equal(await notice.isVisible(), true);
    const text = await notice.innerText();
    assert.match(text, /Marketplace links are affiliate links/);
    assert.match(text, /As an eBay Partner Network Affiliate, I earn from qualifying purchases/);
    assert.match(text, /As an Amazon Associate I earn from qualifying purchases/);
    assert.equal(await page.locator('article [role="note"]').count(), 0, 'No repeated per-card disclosures');
    const expectedLinks = Array.from(trackers).flatMap((tracker) => (tracker.affiliateLinks || []).slice(0, 3).map((link) => link.href));
    const affiliateLinks = page.locator('main a[rel~="sponsored"]');
    assert.deepEqual(await affiliateLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href'))), expectedLinks, 'Affiliate destinations and ordering remain unchanged');
    assert.ok(await notice.evaluate((element) => Boolean(element.compareDocumentPosition(document.querySelector('a[rel~="sponsored"]')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'Notice precedes affiliate links in reading order');
    const noticeBox = await notice.boundingBox();
    assert.ok(noticeBox.y < 350, 'Disclosure is at the top of the directory');
    for (const link of await affiliateLinks.all()) {
      assert.ok(noticeBox.y + noticeBox.height <= (await link.boundingBox()).y, 'Disclosure is above every affiliate link');
      assert.match(await link.getAttribute('rel'), /noopener/);
      assert.equal(await link.getAttribute('target'), '_blank');
    }
    await noOverflow();
    await page.screenshot({ path: `node_modules/.cache/directory-top-${width}.png` });
    await page.getByRole('heading', { name: 'All Serialized Treatments', exact: true }).scrollIntoViewIfNeeded();
    await noOverflow();
    assert.deepEqual(errors, []);
    console.log(`Homepage navigation/artwork, single top disclosure, unchanged affiliate URLs and layout passed at ${width}px`);
    await context.close();
  }
} finally {
  await browser.close();
}

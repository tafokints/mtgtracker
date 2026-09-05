import path from 'node:path';
import { loadProjectModule } from './lib/load-project-module.mjs';

const base = new URL(process.argv[2] || 'http://127.0.0.1:3101');
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('Full-page sweep is local-only to avoid production load.');
const { serializedPrintings, serializedSets, printingPath } = loadProjectModule(path.resolve('src/lib/serialized-printings.ts'));
const { generatedTrackers } = loadProjectModule(path.resolve('src/lib/trackers.ts'));
const paths = [
  '/sets', ...serializedSets.map((set) => `/sets/${set.slug}`),
  ...serializedPrintings.map(printingPath),
  ...generatedTrackers.flatMap((tracker) => [tracker.href, `${tracker.href}/submit`, `${tracker.href}/stats`]),
];
const failures = [];
let next = 0;
// Bound local render pressure while checking every generated route, not just samples.
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < paths.length) {
    const pathname = paths[next++];
    try {
      const response = await fetch(new URL(pathname, base), { signal: AbortSignal.timeout(30000) });
      const html = await response.text();
      if (response.status !== 200 || !response.headers.get('content-type')?.includes('text/html') || !html.includes('<h1')) {
        failures.push(`${pathname}: status ${response.status}, missing page content or invalid content type`);
      }
    } catch (error) { failures.push(`${pathname}: ${error.message}`); }
  }
}));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS: ${paths.length} local set, printing, tracker, report, and stats pages return HTML with page headings. No data mutations performed.`);
}

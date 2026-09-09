import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Redis } from '@upstash/redis';
import { loadProjectModule } from './lib/load-project-module.mjs';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const defaultSourceUrl = 'https://goldenchocobotracker.vercel.app/api/cards';
const deterministicPrefix = 'legacy-golden-chocobo';

function usage() {
  console.log(`Usage:
  node scripts/import-golden-chocobo-legacy.mjs [options]

Options:
  --source <url>       Legacy cards API URL. Defaults to ${defaultSourceUrl}
  --out <path>         Write the dry-run payload to a JSON file.
  --write              Write queue records to Redis. Dry-run is the default.
  --replace-legacy     Replace existing legacy-golden-chocobo-* records.
  --include-missing    Include not-found serials in the dry-run output.
  --limit <number>     Limit imported found records while testing.
  --help               Show this help.
`);
}

function parseArgs(argv) {
  const options = {
    source: defaultSourceUrl,
    write: false,
    replaceLegacy: false,
    includeMissing: false,
    limit: undefined,
    out: undefined,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      options.help = true;
      continue;
    }
    if (token === '--write') {
      options.write = true;
      continue;
    }
    if (token === '--replace-legacy') {
      options.replaceLegacy = true;
      continue;
    }
    if (token === '--include-missing') {
      options.includeMissing = true;
      continue;
    }

    const [rawKey, inlineValue] = token.startsWith('--') ? token.slice(2).split('=', 2) : [];
    if (!rawKey) throw new Error(`Unknown argument: ${token}`);
    const value = inlineValue ?? argv[index + 1];
    if (inlineValue === undefined) index += 1;
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${rawKey}`);

    if (rawKey === 'source') options.source = value;
    else if (rawKey === 'out') options.out = value;
    else if (rawKey === 'limit') {
      const limit = Number(value);
      if (!Number.isInteger(limit) || limit < 1) throw new Error('--limit must be a positive integer.');
      options.limit = limit;
    } else {
      throw new Error(`Unknown option: --${rawKey}`);
    }
  }

  return options;
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function serialForId(id) {
  return String(id).padStart(2, '0');
}

function inferSourceType(url) {
  if (!url) return 'other';
  let hostname = '';
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'other';
  }
  if (hostname === 'ebay.com' || hostname === 'tcgplayer.com') return 'marketplace';
  if (hostname === 'psacard.com' || hostname === 'cgccards.com') return 'grading-pop';
  if (['instagram.com', 'reddit.com', 'x.com', 'twitter.com'].includes(hostname)) return 'social';
  if (hostname === 'magic.wizards.com') return 'article';
  return 'other';
}

function normalizeLegacyCard(rawCard) {
  const id = Number(rawCard?.id);
  if (!Number.isInteger(id) || id < 1 || id > 77) {
    throw new Error(`Invalid Golden Chocobo id: ${rawCard?.id}`);
  }

  return {
    id,
    name: cleanString(rawCard.name) || `Golden Chocobo #${serialForId(id)}`,
    found: Boolean(rawCard.found),
    foundBy: cleanString(rawCard.foundBy) || undefined,
    dateFound: cleanString(rawCard.dateFound) || undefined,
    link: cleanString(rawCard.link) || undefined,
    image: cleanString(rawCard.image) || undefined,
    price: Number.isFinite(Number(rawCard.price)) ? Number(rawCard.price) : undefined,
    priceDate: cleanString(rawCard.priceDate) || undefined,
    priceHistory: Array.isArray(rawCard.priceHistory) ? rawCard.priceHistory : [],
    grading: rawCard.grading && typeof rawCard.grading === 'object' ? rawCard.grading : undefined,
  };
}

export function buildLegacySummary(cards) {
  const normalized = cards.map(normalizeLegacyCard);
  const found = normalized.filter((card) => card.found);
  return {
    total: normalized.length,
    found: found.length,
    missing: normalized.length - found.length,
    foundSerials: found.map((card) => serialForId(card.id)),
  };
}

export function buildQueueSubmissions(cards, options = {}) {
  const tracker = options.tracker || {
    slug: 'golden-chocobo',
    title: 'Golden Chocobo',
    total: 77,
  };
  const normalizeSourceUrl = options.normalizeSourceUrl || ((url) => url);
  const submittedAt = options.submittedAt || new Date().toISOString();
  const normalized = cards.map(normalizeLegacyCard);
  const foundCards = normalized.filter((card) => card.found).slice(0, options.limit);

  return foundCards.map((card) => {
    const serialNumber = serialForId(card.id);
    const normalizedLink = normalizeSourceUrl(card.link);
    const definition = tracker.cardDefinitions?.[0];
    const notes = [
      'Prepared from the legacy Golden Chocobo tracker API for migration review.',
      card.link && !normalizedLink ? `Legacy source link needs manual review: ${card.link}` : undefined,
      card.image ? `Legacy image path: ${card.image}` : undefined,
      card.priceDate && card.price !== undefined ? `Legacy price date: ${card.priceDate}` : undefined,
    ].filter(Boolean).join('\n');

    return {
      id: `${deterministicPrefix}-${serialNumber}`,
      kind: 'discovery',
      cardId: card.id,
      cardSlug: definition?.slug || tracker.slug,
      cardTitle: definition?.title || tracker.title,
      serialTotal: tracker.total,
      serialNumber,
      foundBy: card.foundBy,
      dateFound: card.dateFound,
      link: normalizedLink,
      sourceType: inferSourceType(normalizedLink || card.link),
      requestedVerificationStatus: normalizedLink ? 'source-linked' : 'unverified',
      price: card.price,
      priceKind: card.price !== undefined ? 'unknown' : undefined,
      currency: card.price !== undefined ? 'USD' : undefined,
      priceDate: card.priceDate,
      grading: card.grading,
      evidenceImages: [],
      notes,
      status: 'pending',
      submittedAt,
    };
  });
}

async function fetchLegacyCards(sourceUrl) {
  const response = await fetch(sourceUrl, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'MTGTrackers/0.1 GoldenChocoboMigration contact mtgtrackers.com',
    },
  });
  if (!response.ok) throw new Error(`Legacy API returned ${response.status} ${response.statusText}`);
  const cards = await response.json();
  if (!Array.isArray(cards)) throw new Error('Legacy API did not return a card array.');
  return cards;
}

function loadEnv() {
  dotenv.config({ path: path.join(rootDir, '.env.local'), quiet: true });
  dotenv.config({ path: path.join(rootDir, '.env'), quiet: true });
}

function redisFromEnv() {
  const url = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').trim().replace(/^['"]+|['"]+$/g, '');
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '').trim().replace(/^['"]+|['"]+$/g, '');
  if (!url || !token) throw new Error('Missing Redis REST environment variables. Dry-run without --write, or set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
  return new Redis({ url, token });
}

async function writeQueue({ tracker, submissions, replaceLegacy }) {
  loadEnv();
  const redis = redisFromEnv();
  const { createInitialTrackerCards } = loadProjectModule(path.join(rootDir, 'src', 'lib', 'tracker-data.ts'));
  const existingCards = await redis.get(tracker.storage.cardsKey);
  if (existingCards !== null && (!Array.isArray(existingCards) || existingCards.length === 0)) {
    throw new Error(`Refusing to write because ${tracker.storage.cardsKey} does not contain a valid card array.`);
  }

  const existingSubmissions = await redis.get(tracker.storage.submissionsKey);
  if (existingSubmissions !== null && !Array.isArray(existingSubmissions)) {
    throw new Error(`Refusing to write because ${tracker.storage.submissionsKey} does not contain a submission array.`);
  }

  const existing = existingSubmissions || [];
  const legacyIds = new Set(submissions.map((submission) => submission.id));
  const retained = replaceLegacy
    ? existing.filter((submission) => !legacyIds.has(submission.id))
    : existing;
  const retainedIds = new Set(retained.map((submission) => submission.id));
  const insertions = submissions.filter((submission) => !retainedIds.has(submission.id));
  const nextSubmissions = [...insertions, ...retained];
  const updates = {
    [tracker.storage.submissionsKey]: nextSubmissions,
  };

  if (existingCards === null) {
    updates[tracker.storage.cardsKey] = createInitialTrackerCards(tracker);
  }

  await redis.mset(updates);
  return {
    inserted: insertions.length,
    retained: retained.length,
    total: nextSubmissions.length,
    initializedCards: existingCards === null,
  };
}

function countEvidenceStatus(submissions) {
  return submissions.reduce((counts, submission) => {
    const key = submission.link ? 'supportedSource' : 'needsManualEvidence';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  const { getTracker } = loadProjectModule(path.join(rootDir, 'src', 'lib', 'trackers.ts'));
  const { normalizeSourceUrl } = loadProjectModule(path.join(rootDir, 'src', 'lib', 'evidence-policy.ts'));
  const tracker = getTracker('golden-chocobo');
  if (!tracker) throw new Error('golden-chocobo tracker config was not found.');

  const cards = await fetchLegacyCards(options.source);
  const summary = buildLegacySummary(cards);
  const submissions = buildQueueSubmissions(cards, {
    tracker,
    normalizeSourceUrl,
    limit: options.limit,
  });
  const output = {
    mode: options.write ? 'write' : 'dry-run',
    source: options.source,
    tracker: tracker.slug,
    trackerStatus: tracker.status,
    cardsKey: tracker.storage.cardsKey,
    submissionsKey: tracker.storage.submissionsKey,
    legacy: summary,
    queue: {
      prepared: submissions.length,
      ...countEvidenceStatus(submissions),
      sample: submissions.slice(0, 5),
    },
  };

  if (options.includeMissing) {
    output.missingSerials = cards.map(normalizeLegacyCard).filter((card) => !card.found).map((card) => serialForId(card.id));
  }

  if (options.out) {
    const outPath = path.resolve(rootDir, options.out);
    fs.writeFileSync(outPath, `${JSON.stringify({ ...output, submissions }, null, 2)}\n`);
    output.wroteFile = outPath;
  }

  if (options.write) {
    output.write = await writeQueue({ tracker, submissions, replaceLegacy: options.replaceLegacy });
  }

  console.log(JSON.stringify(output, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

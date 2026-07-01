import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const rootDir = process.cwd();
const catalogPath = path.join(rootDir, 'src', 'lib', 'serialized-catalog.ts');
const userAgent = 'MTGTrackers/0.1 scaffold contact mtgtrackers.com';

function usage() {
  console.log(`Usage:
  node scripts/scaffold-tracker.mjs list
  node scripts/scaffold-tracker.mjs generate <catalog-slug> [--tracker-slug <slug>] [--status planned|live] [--image <url>]

Examples:
  npm run catalog:list
  npm run tracker:scaffold -- innistrad-remastered-edgar-markov --tracker-slug edgar-markov
`);
}

function toKebab(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\/\/.*/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toStorageKey(slug, suffix) {
  return `${slug.replace(/-/g, '_')}_${suffix}`;
}

function parseArgs(argv) {
  const [command, slug, ...rest] = argv;
  const options = {};
  const positional = [];

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split('=', 2);
    const key = rawKey;
    if (inlineValue !== undefined) {
      options[key] = inlineValue;
      continue;
    }

    const value = rest[index + 1];
    if (!value || value.startsWith('--')) {
      options[key] = true;
    } else {
      options[key] = value;
      index += 1;
    }
  }

  if (!options['tracker-slug'] && positional[0]) {
    options['tracker-slug'] = positional[0];
  }

  return { command, slug, options };
}

function literalToValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }

  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }

  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((element) => literalToValue(element));
  }

  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(
      node.properties
        .filter((property) => ts.isPropertyAssignment(property))
        .map((property) => {
          const key = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
            ? property.name.text
            : property.name.getText();
          return [key, literalToValue(property.initializer)];
        })
    );
  }

  if (ts.isIdentifier(node)) {
    return `__identifier:${node.text}`;
  }

  throw new Error(`Unsupported catalog expression: ${node.getText()}`);
}

function readCatalog() {
  const sourceText = fs.readFileSync(catalogPath, 'utf8');
  const source = ts.createSourceFile(catalogPath, sourceText, ts.ScriptTarget.Latest, true);
  let catalogNode;

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'serializedCatalog' &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      catalogNode = node.initializer;
    }

    ts.forEachChild(node, visit);
  }

  visit(source);

  if (!catalogNode) {
    throw new Error('Could not find serializedCatalog array.');
  }

  return literalToValue(catalogNode);
}

async function fetchScryfallImage(entry) {
  const cardUrl = (entry.sourceUrls || []).find((sourceUrl) => sourceUrl.includes('scryfall.com/card/'));
  if (!cardUrl) {
    return undefined;
  }

  const match = cardUrl.match(/scryfall\.com\/card\/([^/]+)\/([^/]+)/);
  if (!match) {
    return undefined;
  }

  const [, setCode, collectorNumber] = match;
  const response = await fetch(`https://api.scryfall.com/cards/${setCode}/${collectorNumber}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': userAgent,
    },
  });

  if (!response.ok) {
    return undefined;
  }

  const card = await response.json();
  return card.image_uris?.large;
}

function listCatalog(catalog) {
  const rows = catalog.map((entry) => ({
    slug: entry.slug,
    status: entry.status,
    mode: entry.trackingMode,
    cards: entry.cardCount,
    numbered: entry.numbered || entry.defaultSerialTotal || 'verify',
    title: entry.title,
  }));

  console.table(rows);
}

function assertCanScaffold(entry) {
  if (entry.trackingMode !== 'single-card') {
    throw new Error(
      `${entry.slug} is ${entry.trackingMode}; add card-plus-serial support before scaffolding it as a tracker.`
    );
  }

  if (!entry.defaultSerialTotal) {
    throw new Error(`${entry.slug} is missing defaultSerialTotal.`);
  }
}

function inferReferenceType(sourceUrl) {
  if (sourceUrl.includes('magic.wizards.com') || sourceUrl.includes('wpn.wizards.com')) {
    return 'official';
  }

  if (sourceUrl.includes('scryfall.com')) {
    return 'scryfall';
  }

  return 'source';
}

function formatReferenceLinks(entry) {
  const sourceUrls = entry.sourceUrls || [];
  if (sourceUrls.length === 0) {
    return '  referenceLinks: [],';
  }

  const links = sourceUrls.map((sourceUrl) => {
    const type = inferReferenceType(sourceUrl);
    const label = type === 'scryfall'
      ? 'Scryfall source'
      : type === 'official'
        ? 'Official source'
        : 'Source';

    return `    {
      label: '${label}',
      href: '${sourceUrl.replace(/'/g, "\\'")}',
      type: '${type}',
    },`;
  }).join('\n');

  return `  referenceLinks: [
${links}
  ],`;
}

async function generateTrackerSnippet(entry, options) {
  assertCanScaffold(entry);

  const trackerSlug = options['tracker-slug'] || toKebab(entry.title);
  const status = options.status || 'planned';
  const referenceImage = options.image || await fetchScryfallImage(entry) || 'TODO_REFERENCE_IMAGE_URL';
  const storageKeyBase = toStorageKey(trackerSlug, '');

  console.log(`// Generated from serialized catalog entry: ${entry.slug}`);
  console.log(`// Review affiliate URLs, theme, and reference image before committing.`);
  if (entry.foundIn) {
    console.log(`// Found in: ${entry.foundIn}`);
  }
  if (entry.sourceUrls?.length) {
    console.log(`// Sources: ${entry.sourceUrls.join(', ')}`);
  }
  console.log(`{
  slug: '${trackerSlug}',
  catalogSlug: '${entry.slug}',
  title: '${entry.title.replace(/'/g, "\\'")}',
  subtitle: '${entry.treatment.replace(/'/g, "\\'")}',
  description: 'Track the ${entry.defaultSerialTotal} serialized ${entry.title.replace(/'/g, "\\'")} cards from Magic: The Gathering ${entry.setName.replace(/'/g, "\\'")}.',
  setName: '${entry.setName.replace(/'/g, "\\'")}',
  releaseName: '${(entry.foundIn || entry.releaseMonth || '').replace(/'/g, "\\'")}',
  cardType: '${entry.treatment.replace(/'/g, "\\'")}',
  total: ${entry.defaultSerialTotal},
  serialPadding: ${entry.defaultSerialTotal >= 100 ? 3 : 2},
  storage: {
    cardsKey: '${storageKeyBase}cards',
    submissionsKey: '${storageKeyBase}submissions',
  },
  href: '/trackers/${trackerSlug}',
  status: '${status}',
  theme: defaultTrackerTheme,
  affiliateLinks: [
    {
      label: '${entry.setName.replace(/'/g, "\\'")} Singles on TCGplayer',
      href: buildTcgplayerSearchUrl('${entry.title.replace(/'/g, "\\'")} serialized', '${trackerSlug}'),
      merchant: 'tcgplayer',
    },
    {
      label: 'Serialized ${entry.title.replace(/'/g, "\\'")} on eBay',
      href: buildEbaySearchUrl('serialized ${entry.title.replace(/'/g, "\\'")} mtg', '${trackerSlug}'),
      merchant: 'ebay',
    },
    {
      label: '${entry.setName.replace(/'/g, "\\'")} on Amazon',
      href: buildAmazonSearchUrl('${entry.setName.replace(/'/g, "\\'")} collector booster'),
      merchant: 'amazon',
    },
  ],
${formatReferenceLinks(entry)}
  referenceImage: '${referenceImage}',
},`);
}

async function main() {
  const { command, slug, options } = parseArgs(process.argv.slice(2));

  if (!command || command === 'help' || command === '--help') {
    usage();
    return;
  }

  const catalog = readCatalog();

  if (command === 'list') {
    listCatalog(catalog);
    return;
  }

  if (command === 'generate') {
    const entry = catalog.find((candidate) => candidate.slug === slug);
    if (!entry) {
      throw new Error(`Unknown catalog slug: ${slug}`);
    }

    await generateTrackerSnippet(entry, options);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { Redis } from '@upstash/redis';

// Intentionally not configurable: these mutations must never target cloud data.
const url = 'http://127.0.0.1:8079';
assert.equal((await (await fetch(url)).json()).fixture, 'mtgtrackers-isolated-redis');
const redis = new Redis({ url, token: 'fixture-only', enableAutoPipelining: false, responseEncoding: false });
const source = ts.createSourceFile('tracker-store.ts', readFileSync(new URL('../src/lib/tracker-store.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
const scripts = {};
for (const statement of source.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    if (ts.isIdentifier(declaration.name) && declaration.initializer && ts.isNoSubstitutionTemplateLiteral(declaration.initializer)) {
      scripts[declaration.name.text] = declaration.initializer.text;
    }
  }
}
const prefix = `fixture:${randomUUID()}`;
const keys = [`${prefix}:cards`, `${prefix}:submissions`, `${prefix}:active`];
const slug = 'card-brr-98z';
const oldCards = JSON.stringify([{ id: 1, found: false }]);
const newCards = JSON.stringify([{ id: 1, found: true }]);
const reports = JSON.stringify([{ id: 'fixture-report', cardId: 1 }]);

try {
  assert.deepEqual(await redis.eval(scripts.READ_TRACKER_STATE, keys.slice(0, 2), []), { cards: '', submissions: '' });
  await redis.set(keys[0], oldCards);
  const raw = await redis.eval(scripts.READ_TRACKER_STATE, keys.slice(0, 2), []);
  assert.equal(raw.cards, oldCards);
  const commit = () => redis.eval(scripts.COMMIT_TRACKER_STATE, keys, [oldCards, '', newCards, reports, slug]);
  assert.deepEqual((await Promise.all([commit(), commit()])).sort(), [0, 1]);
  assert.deepEqual(await redis.smembers(keys[2]), [slug]);
  assert.deepEqual(await redis.get(keys[0]), JSON.parse(newCards));
  assert.deepEqual(await redis.get(keys[1]), JSON.parse(reports));

  await redis.eval(scripts.RESTORE_PRINTING_STATE, keys, [oldCards, '[]', slug]);
  assert.deepEqual(await redis.get(keys[0]), JSON.parse(oldCards));
  assert.deepEqual(await redis.get(keys[1]), []);

  await redis.del(keys[2]);
  await redis.set(keys[2], 'wrong-type');
  await assert.rejects(redis.eval(scripts.COMMIT_TRACKER_STATE, keys, [oldCards, '[]', newCards, reports, slug]), /Invalid tracker activity index/);
  await assert.rejects(redis.eval(scripts.RESTORE_PRINTING_STATE, keys, [newCards, reports, slug]), /Invalid tracker activity index/);
  assert.deepEqual(await redis.get(keys[0]), JSON.parse(oldCards));
  assert.deepEqual(await redis.get(keys[1]), []);

  // Featured trackers have two keys and must retain the same CAS behavior.
  assert.equal(await redis.eval(scripts.COMMIT_TRACKER_STATE, keys.slice(0, 2), [oldCards, '[]', newCards, reports]), 1);
  console.log('PASS: actual Upstash SDK + Lua read/CAS conflict/restore/activity index/type-error atomicity; isolated local data only.');
} finally {
  await redis.del(...keys);
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { Redis } from '@upstash/redis';
import { SNAPSHOT_KEYS } from './recovery.mjs';

// Intentionally not configurable: these mutations must never target cloud data.
const url = 'http://127.0.0.1:8079';
assert.equal((await (await fetch(url)).json()).fixture, 'mtgtrackers-isolated-redis');
const redis = new Redis({ url, token: 'fixture-only', enableAutoPipelining: false, responseEncoding: false });
const productionDefaults = new Redis({ url, token: 'fixture-only' });
const scripts = {};
for (const file of ['tracker-store.ts', 'copy-reconciliation.ts', 'evidence-store.ts', 'rate-limit.ts', 'admin-auth.ts', 'telemetry-policy.ts', 'storage-inventory.ts']) {
const source = ts.createSourceFile(file, readFileSync(new URL(`../src/lib/${file}`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
for (const statement of source.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    if (ts.isIdentifier(declaration.name) && declaration.initializer && ts.isNoSubstitutionTemplateLiteral(declaration.initializer)) {
      scripts[declaration.name.text] = declaration.initializer.text;
    }
  }
}
}
const prefix = `fixture:${randomUUID()}`;
const keys = [`${prefix}:cards`, `${prefix}:submissions`, `${prefix}:active`];
const evidenceKey = `${prefix}:evidence`;
const rateKey = `${prefix}:rate`;
const sessionKey = `${prefix}:session`;
const dailyKey = `${prefix}:daily`;
const relatedKeys = ['owner-cards', 'owner-reports', 'alias-cards', 'alias-reports'].map((key) => `${prefix}:${key}`);
const archiveKey = `${prefix}:archive`;
const slug = 'card-brr-98z';
const oldCards = JSON.stringify([{ id: 1, found: false }]);
const newCards = JSON.stringify([{ id: 1, found: true }]);
const reports = JSON.stringify([{ id: 'fixture-report', cardId: 1 }]);

try {
  const now = Math.floor(Date.now() / 1000);
  const session = { principal: { id: 'fixture-owner', role: 'owner' }, fingerprint: 'fixture', lastSeenAt: now, expiresAt: now + 3600 };
  await redis.set(sessionKey, session, { ex: 1800 });
  assert.deepEqual(await productionDefaults.eval(scripts.CHECK_ADMIN_SESSION, [sessionKey], [String(now), 'fixture', '1800']), session.principal);
  assert.ok(await redis.ttl(sessionKey) > 0);
  assert.equal(await productionDefaults.eval(scripts.CHECK_ADMIN_SESSION, [sessionKey], [String(now), 'rotated', '1800']), '');
  assert.equal(await redis.get(sessionKey), null);
  await redis.set(sessionKey, { ...session, lastSeenAt: now - 1800 });
  assert.equal(await productionDefaults.eval(scripts.CHECK_ADMIN_SESSION, [sessionKey], [String(now), 'fixture', '1800']), '');
  await redis.set(sessionKey, session);
  await redis.del(sessionKey);
  assert.equal(await productionDefaults.eval(scripts.CHECK_ADMIN_SESSION, [sessionKey], [String(now), 'fixture', '1800']), '');
  await redis.eval(scripts.INCREMENT_TELEMETRY, [dailyKey], ['7776000']);
  assert.ok(await redis.ttl(dailyKey) > 0);
  assert.deepEqual(await productionDefaults.eval(SNAPSHOT_KEYS, [sessionKey, dailyKey], []), [false, '1']);
  assert.deepEqual(await productionDefaults.eval(scripts.READ_INVENTORY_RECORDS, [sessionKey, dailyKey], [1024]), [{ state: 'missing' }, { state: 'present', raw: '1' }]);
  assert.deepEqual(await productionDefaults.eval(scripts.READ_INVENTORY_RECORDS, [dailyKey], [0]), [{ state: 'unavailable' }]);
  assert.deepEqual(await redis.eval(scripts.READ_RELATED_STATE, relatedKeys, []), ['', '', '', '']);
  const oldRelated = [oldCards, '[]', oldCards, '[]'];
  const newRelated = [newCards, reports, oldCards, '[]'];
  await redis.mset(Object.fromEntries(relatedKeys.map((key, index) => [key, oldRelated[index]])));
  const relatedCommit = () => redis.eval(scripts.COMMIT_RELATED_STATE, relatedKeys, [...oldRelated, ...newRelated]);
  assert.deepEqual((await Promise.all([relatedCommit(), relatedCommit()])).sort(), [0, 1]);
  assert.deepEqual(await redis.eval(scripts.READ_RELATED_STATE, relatedKeys, []), newRelated);
  assert.deepEqual(await productionDefaults.eval(scripts.READ_RELATED_STATE, relatedKeys, []), newRelated);
  assert.deepEqual(await Promise.all([productionDefaults.get(relatedKeys[0]), productionDefaults.get(relatedKeys[1])]), [JSON.parse(newCards), JSON.parse(reports)]);
  const archive = JSON.stringify({ originals: newRelated });
  assert.equal(await redis.eval(scripts.COMMIT_COPY_RECONCILIATION, [...relatedKeys, archiveKey], [...oldRelated, ...oldRelated, archive]), 0);
  assert.equal(await redis.get(archiveKey), null);
  assert.equal(await redis.eval(scripts.COMMIT_COPY_RECONCILIATION, [...relatedKeys, archiveKey], [...newRelated, ...oldRelated, archive]), 1);
  assert.deepEqual(await redis.get(archiveKey), { originals: newRelated });
  assert.deepEqual(await redis.eval(scripts.READ_TRACKER_STATE, keys.slice(0, 2), []), { cards: '', submissions: '' });
  await redis.set(keys[0], oldCards);
  const raw = await redis.eval(scripts.READ_TRACKER_STATE, keys.slice(0, 2), []);
  assert.equal(raw.cards, oldCards);
  const commit = () => redis.eval(scripts.COMMIT_TRACKER_STATE, keys, [oldCards, '', newCards, reports, slug]);
  assert.deepEqual((await Promise.all([commit(), commit()])).sort(), [0, 1]);
  assert.deepEqual(await redis.smembers(keys[2]), [slug]);
  assert.deepEqual(await productionDefaults.eval(scripts.READ_INVENTORY_RECORDS, [keys[2]], [1024]), [{ state: 'unavailable' }]);
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
  await redis.set(evidenceKey, { id: 'fixture', scan: { status: 'pending' }, sha256: 'immutable-hash' });
  assert.equal(await redis.eval(scripts.COMMIT_EVIDENCE_SCAN, [evidenceKey], [JSON.stringify({ status: 'error' })]), 1);
  assert.equal(await redis.eval(scripts.COMMIT_EVIDENCE_SCAN, [evidenceKey], [JSON.stringify({ status: 'clean' })]), 1);
  assert.equal(await redis.eval(scripts.COMMIT_EVIDENCE_SCAN, [evidenceKey], [JSON.stringify({ status: 'flagged' })]), 0);
  assert.deepEqual(await redis.get(evidenceKey), { id: 'fixture', scan: { status: 'clean' }, sha256: 'immutable-hash' });
  await redis.set(evidenceKey, { scan: { status: 'flagged' } });
  assert.equal(await redis.eval(scripts.COMMIT_EVIDENCE_SCAN, [evidenceKey], [JSON.stringify({ status: 'clean' })]), 0);
  const counts = await Promise.all([0, 1, 2].map(() => redis.eval(scripts.BOUNDED_RATE_LIMIT, [rateKey], [3600])));
  assert.deepEqual(counts.sort(), [1, 2, 3]);
  assert.ok(await redis.ttl(rateKey) > 0);
  await redis.persist(rateKey);
  assert.equal(await redis.eval(scripts.BOUNDED_RATE_LIMIT, [rateKey], [3600]), 4);
  assert.ok(await redis.ttl(rateKey) > 0);
  console.log('PASS: actual Upstash SDK + Lua owner session revocation/expiry, bounded telemetry, recovery snapshots, shared-copy CAS, archived reconciliation, immutable scans and rate limits; isolated local data only.');
} finally {
  await redis.del(...keys, ...relatedKeys, archiveKey, evidenceKey, rateKey, sessionKey, dailyKey);
}

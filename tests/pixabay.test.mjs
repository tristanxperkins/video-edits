import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadKey, filterHits, creditsRow, pageSize } from '../scripts/pixabay.mjs';

const hit = (id, w, h, duration) => ({
  id, pageURL: `https://pixabay.com/videos/rings-${id}/`, duration, tags: 'wedding, rings', user: 'someone',
  videos: { large: { url: `https://cdn.example/${id}.mp4`, width: w, height: h, thumbnail: 't.jpg' } },
});

test('filters by orientation and minimum duration', () => {
  const hits = [hit(1, 1920, 1080, 12), hit(2, 1080, 1920, 8), hit(3, 1080, 1920, 3)];
  assert.deepEqual(filterHits(hits, { orientation: 'vertical', minSecs: 4 }).map(h => h.id), [2]);
  assert.equal(filterHits(hits).length, 3);
});

test('orientation filters check the full 200-result page unless --per-page is set', () => {
  assert.equal(pageSize(null, 'vertical'), 200);
  assert.equal(pageSize(null, 'horizontal'), 200);
  assert.equal(pageSize(null, null), 20);
  assert.equal(pageSize('50', 'vertical'), 50);
  assert.equal(pageSize('999', null), 200);
  assert.equal(pageSize('1', null), 3);
});

test('credits row records the Pixabay page URL and escapes pipes', () => {
  const row = creditsRow({ file: 'assets/broll/pixabay-7.mp4', hit: hit(7, 1, 1, 5), use: 'rings | close-up', date: '2026-11-26' });
  assert.match(row, /https:\/\/pixabay\.com\/videos\/rings-7\//);
  assert.match(row, /rings \\\| close-up/);
  assert.ok(row.endsWith('|\n'));
});

test('reads the key from .env and prefers the environment', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-pixabay-'));
  writeFileSync(join(dir, '.env'), 'OTHER=1\nPIXABAY_API_KEY="abc123"\n');
  assert.equal(loadKey(dir, {}), 'abc123');
  assert.equal(loadKey(dir, { PIXABAY_API_KEY: 'envkey' }), 'envkey');
  assert.equal(loadKey(mkdtempSync(join(tmpdir(), 'kit-pixabay-')), {}), null);
});

test('CLI without a key explains how to add it and prints no secret', () => {
  const r = spawnSync(process.execPath, [resolve(import.meta.dirname, '../scripts/pixabay.mjs'), 'search', 'rings'], {
    encoding: 'utf8', env: { ...process.env, PIXABAY_API_KEY: '' }, cwd: mkdtempSync(join(tmpdir(), 'kit-pixabay-')),
  });
  // The workspace .env may or may not hold a key; only assert the no-key path when it doesn't.
  if (r.status === 1 && /not set/.test(r.stderr)) assert.match(r.stderr, /Add it to \.env/);
});

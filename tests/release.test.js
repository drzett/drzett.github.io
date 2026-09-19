import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('release metadata, service worker, and database schema stay consistent', async () => {
  delete globalThis.PRO_RUNNER_RELEASE;
  await import(`../pro-runner/release.js?test=${Date.now()}`);
  const release = globalThis.PRO_RUNNER_RELEASE;
  const manifest = JSON.parse(await readFile(new URL('../pro-runner/version.json', import.meta.url), 'utf8'));
  const storage = await readFile(new URL('../pro-runner/core/storage.js', import.meta.url), 'utf8');
  const worker = await readFile(new URL('../pro-runner/sw-runtime.js', import.meta.url), 'utf8');
  const entry = await readFile(new URL('../pro-runner/sw.js', import.meta.url), 'utf8');

  assert.deepEqual(
    { version: manifest.version, build: manifest.build, channel: manifest.channel, released: manifest.released },
    release,
  );
  assert.match(entry, /importScripts\('\.\/release\.js', '\.\/sw-runtime\.js'\)/);
  assert.doesNotMatch(entry, /sw-core-v\d+/);
  assert.match(worker, /'\.\/core\/glass\.js'/);
  assert.match(worker, /'\.\/core\/frame\.js'/);
  assert.match(worker, /'\.\/core\/website-scan\.js'/);
  assert.equal(Number(storage.match(/DB_VERSION = (\d+)/)?.[1]), Number(worker.match(/DB_VERSION = (\d+)/)?.[1]));
});

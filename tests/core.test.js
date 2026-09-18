import assert from 'node:assert/strict';
import test from 'node:test';
import { firstFree, itemCells, moveDockItem, validPosition } from '../pro-runner/core/home-state.js';
import { normalizeProject, defaultHomeState } from '../pro-runner/core/storage.js';
import { websiteIconCandidates } from '../pro-runner/core/projects.js';
import { normalizeIconConfig, renderIconSvg } from '../pro-runner/ui/icon-designer.js';

test('normalizes legacy local and website records without losing website URLs', () => {
  assert.equal(normalizeProject({ id: 'local', kind: 'folder' }).type, 'local');
  const website = normalizeProject({ id: 'web', kind: 'web', externalUrl: 'https://example.test/path' });
  assert.equal(website.type, 'website'); assert.equal(website.externalUrl, 'https://example.test/path');
});

test('home placement chooses visible free cells and keeps dock order bounded', () => {
  const occupied = new Map(itemCells({ col: 1, row: 1 }, { w: 2, h: 2 }).map((cell) => [cell, 'widget']));
  assert.deepEqual(firstFree(occupied, { w: 1, h: 1 }, 4), { col: 3, row: 1 });
  assert.equal(validPosition({ col: 4, row: 4 }, { w: 1, h: 1 }, 4), true);
  assert.equal(validPosition({ col: 4, row: 4 }, { w: 2, h: 2 }, 4), false);
  assert.deepEqual(moveDockItem(['runner', 'project:a', 'project:b', 'project:c'], 'project:a', 3), ['runner', 'project:b', 'project:c', 'project:a']);
  assert.deepEqual(defaultHomeState().dock, []);
});

test('icon designer migrates single-layer designs into two independent layers', () => {
  const config = normalizeIconConfig({ color: '#343a40', text: 'Long icon label', size: 72, x: 4, y: -3, rotate: 8 });
  assert.equal(config.layers.length, 2);
  assert.equal(config.layers[0].text, 'Long icon label');
  assert.equal(config.layers[0].rotation, 8);
  assert.equal(config.layers[1].text, '');
  assert.match(renderIconSvg({ background: 'violet', layers: [{ text: 'A', scale: 80, x: 0, y: 0, rotation: 0 }, { text: 'B', scale: 40, x: 20, y: 20, rotation: 12 }] }), />A<.*>B</);
});

test('website icon discovery includes high-resolution and favicon fallbacks', () => {
  const candidates = websiteIconCandidates('https://example.test/path');
  assert.equal(candidates[0], 'https://example.test/apple-touch-icon.png');
  assert.ok(candidates.includes('https://example.test/android-chrome-512x512.png'));
  assert.ok(candidates.includes('https://example.test/favicon.ico'));
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { firstFree, itemCells, moveDockItem, validPosition } from '../pro-runner/core/home-state.js';
import { normalizeProject, defaultHomeState } from '../pro-runner/core/storage.js';

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

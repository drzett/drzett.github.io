import { expect, test } from '@playwright/test';

async function seedLegacy(page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('pro-runner-test-seeded')) return;
    sessionStorage.setItem('pro-runner-test-seeded', '1');
    localStorage.setItem('pro-runner-settings', JSON.stringify({ startView: 'home', iconLabels: true }));
    localStorage.setItem('pro-runner-home-layout-v2', JSON.stringify({ version: 2, positions: { 'project:local-1': { col: 2, row: 1 }, 'project:web-1': { col: 3, row: 1 } } }));
    indexedDB.deleteDatabase('pro-runner-v1');
    const request = indexedDB.open('pro-runner-v1', 1);
    request.onupgradeneeded = () => { const db = request.result; db.createObjectStore('projects', { keyPath: 'id' }); const files = db.createObjectStore('files', { keyPath: 'key' }); files.createIndex('byProject', 'projectId'); db.createObjectStore('meta', { keyPath: 'key' }); db.createObjectStore('assets', { keyPath: 'key' }); };
    request.onsuccess = () => { const db = request.result; const tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').put({ id: 'local-1', name: 'Local fixture', kind: 'file', entryPath: 'index.html', sourceName: 'fixture.html', fileCount: 1, totalBytes: 16, dock: true, importedAt: 1 }); tx.objectStore('projects').put({ id: 'web-1', name: 'Website fixture', kind: 'web', externalUrl: 'https://example.test/app', sourceName: 'https://example.test/app', entryPath: 'example.test', fileCount: 0, totalBytes: 0, importedAt: 2 }); tx.oncomplete = () => db.close(); };
  });
}

test('boots without exceptions and migrates legacy project data', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await seedLegacy(page); await page.goto('./');
  await expect(page.locator('#homeScreen')).toBeVisible();
  await expect(page.locator('.home-app[data-id="local-1"]')).toBeVisible();
  await expect(page.locator('.home-app[data-id="web-1"]')).toBeVisible();
  const data = await page.evaluate(async () => new Promise((resolve) => { const req = indexedDB.open('pro-runner-v1'); req.onsuccess = () => { const db = req.result; const tx = db.transaction(['projects', 'meta']); const projects = tx.objectStore('projects').getAll(); const home = tx.objectStore('meta').get('home-state-v3'); tx.oncomplete = () => resolve({ projects: projects.result, home: home.result }); } }));
  expect(data.projects.find((project) => project.id === 'local-1').type).toBe('local');
  expect(data.projects.find((project) => project.id === 'web-1').type).toBe('website');
  expect(data.projects.find((project) => project.id === 'web-1').externalUrl).toBe('https://example.test/app');
  expect(data.home.value.positions['project:local-1']).toEqual({ col: 2, row: 1 });
  expect(errors).toEqual([]);
});

test('home edit mode and dock changes survive reload', async ({ page }) => {
  await seedLegacy(page); await page.goto('./');
  const local = page.locator('.home-app[data-id="local-1"]');
  await local.dispatchEvent('pointerdown', { pointerId: 5, clientX: 90, clientY: 210, button: 0 });
  await page.waitForTimeout(650);
  await expect(page.locator('#homeEditDone')).toBeVisible();
  await page.locator('#homeEditDone').click();
  await page.reload();
  await expect(page.locator('.home-app[data-id="local-1"]')).toBeVisible();
});

test('website entries open in the external viewer without changing their type or URL', async ({ page }) => {
  await seedLegacy(page); await page.goto('./');
  await page.locator('.home-app[data-id="web-1"]').click();
  await expect(page.locator('#viewer')).toBeVisible();
  await expect(page.locator('#projectFrame')).toHaveAttribute('src', /external-frame\.html\?url=https%3A%2F%2Fexample\.test%2Fapp/);
  const project = await page.evaluate(async () => new Promise((resolve) => { const request = indexedDB.open('pro-runner-v1'); request.onsuccess = () => { const db = request.result; const get = db.transaction('projects').objectStore('projects').get('web-1'); get.onsuccess = () => resolve(get.result); }; }));
  expect(project.type).toBe('website'); expect(project.externalUrl).toBe('https://example.test/app');
});

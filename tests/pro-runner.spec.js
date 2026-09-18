import { expect, test } from '@playwright/test';

async function seedLegacy(page) {
  await page.goto('./external-frame.html');
  await page.evaluate(async () => new Promise((resolve, reject) => {
    localStorage.setItem('pro-runner-settings', JSON.stringify({ startView: 'home', iconLabels: true }));
    localStorage.setItem('pro-runner-home-layout-v2', JSON.stringify({ version: 2, positions: { 'project:local-1': { col: 2, row: 1 }, 'project:web-1': { col: 3, row: 1 } } }));
    const deletion = indexedDB.deleteDatabase('pro-runner-v1');
    deletion.onerror = () => reject(deletion.error);
    deletion.onblocked = () => reject(new Error('Test database deletion was blocked.'));
    deletion.onsuccess = () => {
      const request = indexedDB.open('pro-runner-v1', 1);
    request.onupgradeneeded = () => { const db = request.result; db.createObjectStore('projects', { keyPath: 'id' }); const files = db.createObjectStore('files', { keyPath: 'key' }); files.createIndex('byProject', 'projectId'); db.createObjectStore('meta', { keyPath: 'key' }); db.createObjectStore('assets', { keyPath: 'key' }); };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { const db = request.result; const tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').put({ id: 'local-1', name: 'Local fixture', kind: 'file', entryPath: 'index.html', sourceName: 'fixture.html', fileCount: 1, totalBytes: 16, dock: true, importedAt: 1 }); tx.objectStore('projects').put({ id: 'web-1', name: 'Website fixture', kind: 'web', externalUrl: 'https://example.test/app', sourceName: 'https://example.test/app', entryPath: 'example.test', fileCount: 0, totalBytes: 0, importedAt: 2 }); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
    };
  }));
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
  await expect(page.locator('#projectFrame')).toHaveAttribute('src', 'https://example.test/app');
  await expect(page.locator('#viewerExternalFallback')).toHaveCount(0);
  await page.locator('#viewerControl').click();
  await expect(page.locator('#viewerBrowser')).toBeVisible();
  const project = await page.evaluate(async () => new Promise((resolve) => { const request = indexedDB.open('pro-runner-v1'); request.onsuccess = () => { const db = request.result; const get = db.transaction('projects').objectStore('projects').get('web-1'); get.onsuccess = () => resolve(get.result); }; }));
  expect(project.type).toBe('website'); expect(project.externalUrl).toBe('https://example.test/app');
});

test('a dock item can return to a visible grid slot during edit mode', async ({ page }) => {
  await seedLegacy(page); await page.goto('./');
  const item = page.locator('#homeDock .home-app[data-id="local-1"]');
  await expect(item).toBeVisible();
  const before = await item.boundingBox(); const grid = await page.locator('.home-content').boundingBox();
  await item.dispatchEvent('pointerdown', { pointerId: 7, clientX: before.x + 20, clientY: before.y + 20, button: 0 });
  await page.waitForTimeout(650);
  await item.dispatchEvent('pointerup', { pointerId: 7, clientX: before.x + 20, clientY: before.y + 20, button: 0 });
  await page.waitForTimeout(750);
  await page.mouse.move(before.x + 20, before.y + 20); await page.mouse.down();
  await page.mouse.move(grid.x + grid.width * .75, grid.y + grid.height * .7, { steps: 4 }); await page.mouse.up();
  await expect(page.locator('#homeAppGrid .home-app[data-id="local-1"]')).toBeVisible();
  const home = await page.evaluate(async () => new Promise((resolve) => { const request = indexedDB.open('pro-runner-v1'); request.onsuccess = () => { const db = request.result; const get = db.transaction('meta').objectStore('meta').get('home-state-v3'); get.onsuccess = () => resolve(get.result.value); }; }));
  expect(home.dock).not.toContain('project:local-1');
});

test('an icon can occupy an explicitly chosen empty dock slot', async ({ page }) => {
  await seedLegacy(page); await page.goto('./');
  const item = page.locator('#homeAppGrid .home-app[data-id="web-1"]'); await expect(item).toBeVisible(); const before = await item.boundingBox(); const dock = await page.locator('#homeDock').boundingBox();
  await item.dispatchEvent('pointerdown', { pointerId: 8, clientX: before.x + 20, clientY: before.y + 20, button: 0 }); await page.waitForTimeout(650);
  await item.dispatchEvent('pointerup', { pointerId: 8, clientX: before.x + 20, clientY: before.y + 20, button: 0 }); await page.waitForTimeout(750);
  await page.mouse.move(before.x + 20, before.y + 20); await page.mouse.down(); await page.mouse.move(dock.x + dock.width * .65, dock.y + dock.height / 2, { steps: 4 }); await page.mouse.up();
  await expect(page.locator('#homeDock .home-app[data-id="web-1"]')).toHaveCSS('grid-column-start', '3');
  const home = await page.evaluate(async () => new Promise((resolve) => { const request = indexedDB.open('pro-runner-v1'); request.onsuccess = () => { const db = request.result; const get = db.transaction('meta').objectStore('meta').get('home-state-v3'); get.onsuccess = () => resolve(get.result.value); }; }));
  expect(home.dockSlots[2]).toBe('project:web-1');
});

test('dragging an icon keeps a live icon ghost and shows four dock targets', async ({ page }) => {
  await seedLegacy(page); await page.goto('./');
  const item = page.locator('#homeAppGrid .home-app[data-id="web-1"]');
  await expect(item).toBeVisible();
  let box = await item.boundingBox();
  await item.dispatchEvent('pointerdown', { pointerId: 18, clientX: box.x + 20, clientY: box.y + 20, button: 0 });
  await page.waitForTimeout(650);
  await item.dispatchEvent('pointerup', { pointerId: 18, clientX: box.x + 20, clientY: box.y + 20, button: 0 });
  await page.waitForTimeout(100);

  box = await item.boundingBox();
  const dock = await page.locator('#homeDock').boundingBox();
  await item.dispatchEvent('pointerdown', { pointerId: 19, clientX: box.x + 20, clientY: box.y + 20, button: 0 });
  await item.dispatchEvent('pointermove', { pointerId: 19, clientX: dock.x + dock.width * .75, clientY: dock.y + dock.height / 2, buttons: 1 });

  await expect(page.locator('#homeDock .pro-dock-slot-marker')).toHaveCount(4);
  await expect(page.locator('#homeDock .pro-dock-slot-marker.active')).toHaveCount(1);
  await expect(page.locator('.pro-drag-ghost')).toBeVisible();
  await expect(page.locator('.pro-drag-ghost > .home-app-icon')).toHaveCSS('animation-name', 'springboard-icon-jiggle');
  expect(await page.locator('.pro-drag-ghost > .home-app-icon').evaluate((node) => parseFloat(getComputedStyle(node).borderTopLeftRadius))).toBeGreaterThan(0);
  await item.dispatchEvent('pointercancel', { pointerId: 19, clientX: dock.x + dock.width * .75, clientY: dock.y + dock.height / 2 });
  await expect(page.locator('.pro-drag-ghost')).toHaveCount(0);
});

test('glass settings control all glass surfaces and persist without changing the calendar material', async ({ page }) => {
  await seedLegacy(page); await page.goto('./');
  await expect(page.locator('.clock-widget')).toHaveClass(/glass-surface-panel/);
  await expect(page.locator('#homeDock')).toHaveClass(/glass-surface-dock/);
  await expect(page.locator('.calendar-widget')).not.toHaveClass(/glass-surface/);
  expect(await page.evaluate(() => ({
    panel: getComputedStyle(document.documentElement).getPropertyValue('--glass-panel-alpha').trim(),
    dock: getComputedStyle(document.documentElement).getPropertyValue('--glass-dock-alpha').trim(),
  }))).toEqual({ panel: '0.54', dock: '0.16' });

  await page.locator('.home-app[data-runner="true"]').click();
  await page.locator('#settingsButton').click();
  await expect(page.locator('#glassStyleSelect')).toHaveValue('standard');
  await expect(page.locator('#glassIntensityRange')).toHaveValue('50');
  await page.locator('#glassStyleSelect').selectOption('frosted');
  await page.locator('#glassIntensityRange').fill('100');
  await expect(page.locator('#glassIntensityValue')).toHaveText('100%');
  await expect.poll(() => page.evaluate(async () => new Promise((resolve) => {
    const request = indexedDB.open('pro-runner-v1');
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('meta').objectStore('meta').get('app-settings-v2');
      get.onsuccess = () => { db.close(); resolve(get.result?.value); };
    };
  }))).toMatchObject({ glassStyle: 'frosted', glassIntensity: 100 });

  await page.reload();
  await expect(page.locator('#homeScreen')).toBeVisible();
  expect(await page.evaluate(() => ({
    style: document.documentElement.dataset.glassStyle,
    panel: getComputedStyle(document.documentElement).getPropertyValue('--glass-panel-alpha').trim(),
    dock: getComputedStyle(document.documentElement).getPropertyValue('--glass-dock-alpha').trim(),
  }))).toEqual({ style: 'frosted', panel: '1', dock: '1' });
});

test('the calendar widget renders its current month grid', async ({ page }) => {
  await seedLegacy(page); await page.goto('./');
  await expect(page.locator('.calendar-month')).not.toBeEmpty();
  await expect(page.locator('.mini-weekdays span')).toHaveCount(7);
  expect(await page.locator('.mini-month span').count()).toBeGreaterThan(28);
  await expect(page.locator('.mini-month .today')).toHaveCount(1);
});

test('project settings provide the icon designer during Home editing', async ({ page }) => {
  await seedLegacy(page); await page.goto('./');
  const item = page.locator('#homeAppGrid .home-app[data-id="web-1"]'); await expect(item).toBeVisible(); const box = await item.boundingBox();
  await item.dispatchEvent('pointerdown', { pointerId: 9, clientX: box.x + 20, clientY: box.y + 20, button: 0 }); await page.waitForTimeout(650);
  await item.dispatchEvent('pointerup', { pointerId: 9, clientX: box.x + 20, clientY: box.y + 20, button: 0 }); await page.waitForTimeout(750);
  await item.click(); await expect(page.locator('#projectDialog')).toBeVisible(); await page.locator('#designIconButton').click();
  await expect(page.locator('#iconDesignerDialog')).toBeVisible();
  await expect(page.locator('#iconDesignerDialog .designer-text')).toHaveCount(2);
  await expect(page.locator('#iconDesignerDialog .designer-text').first()).not.toHaveAttribute('maxlength');
});

test('the Pro Runner return icon has its own Home edit configuration', async ({ page }) => {
  await seedLegacy(page); await page.goto('./');
  const item = page.locator('.home-app[data-runner="true"]'); await expect(item).toBeVisible(); const box = await item.boundingBox();
  await item.dispatchEvent('pointerdown', { pointerId: 10, clientX: box.x + 20, clientY: box.y + 20, button: 0 }); await page.waitForTimeout(650);
  await item.dispatchEvent('pointerup', { pointerId: 10, clientX: box.x + 20, clientY: box.y + 20, button: 0 }); await page.waitForTimeout(750);
  await item.click(); await expect(page.locator('#runnerSettingsDialog')).toBeVisible();
  await expect(page.locator('#runnerSettingsDialog .runner-design')).toBeVisible();
});

test('delete badges stay hidden until Home edit mode starts', async ({ page }) => {
  await seedLegacy(page); await page.goto('./');
  await expect(page.locator('.home-app[data-id="local-1"] .app-delete-badge')).toBeHidden();
  const item = page.locator('.home-app[data-id="local-1"]'); await expect(item).toBeVisible(); const box = await item.boundingBox();
  await item.dispatchEvent('pointerdown', { pointerId: 11, clientX: box.x + 20, clientY: box.y + 20, button: 0 }); await page.waitForTimeout(650);
  await expect(page.locator('.home-app[data-id="local-1"] .app-delete-badge')).toBeVisible();
});

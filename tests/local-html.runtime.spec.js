import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

test('imports and executes a standalone HTML file through the service worker', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('./');
  await expect(page.locator('#runtimeStatus')).toHaveText('Runtime ready');
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await page.locator('#filePicker').setInputFiles({
    name: 'runtime-check.html',
    mimeType: 'text/html',
    buffer: Buffer.from(`<!doctype html>
      <html><body>
        <h1 id="rendered">Imported HTML rendered</h1>
        <output id="executed">script pending</output>
        <script>document.querySelector('#executed').textContent = 'JavaScript executed';</script>
      </body></html>`),
  });

  const project = page.locator('.project-card', { hasText: 'runtime-check' });
  await expect(project).toBeVisible();
  await project.getByRole('button', { name: 'Open' }).click();

  const frame = page.frameLocator('#projectFrame');
  await expect(frame.locator('#rendered')).toHaveText('Imported HTML rendered');
  await expect(frame.locator('#executed')).toHaveText('JavaScript executed');
  await expect(page.locator('#projectFrame')).toHaveAttribute('src', /\/pro-runner\/__site\/.+\/runtime-check\.html$/);
  expect(pageErrors).toEqual([]);
});

test('genuinely fresh installation creates the runtime without pre-existing browser data', async ({ page }) => {
  await page.goto('./external-frame.html');
  const before = await page.evaluate(async () => ({
    registrations: (await navigator.serviceWorker.getRegistrations()).length,
    databases: typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).length : 0,
    caches: (await caches.keys()).length,
  }));
  expect(before).toEqual({ registrations: 0, databases: 0, caches: 0 });

  await page.goto('./');
  await expect(page.locator('#runtimeStatus')).toHaveText('Runtime ready');
  await page.locator('#filePicker').setInputFiles({
    name: 'first-install.html',
    mimeType: 'text/html',
    buffer: Buffer.from('<h1 id="fresh">Fresh install executed</h1><script>document.body.dataset.executed="yes"</script>'),
  });
  await page.locator('.project-card', { hasText: 'first-install' }).getByRole('button', { name: 'Open' }).click();
  await expect(page.frameLocator('#projectFrame').locator('#fresh')).toHaveText('Fresh install executed');
  await expect(page.frameLocator('#projectFrame').locator('body')).toHaveAttribute('data-executed', 'yes');
});

test('serves a multi-file project after reload and while offline', async ({ context, page }) => {
  await page.goto('./');
  await expect(page.locator('#runtimeStatus')).toHaveText('Runtime ready');

  await page.locator('#folderPicker').setInputFiles(resolve('tests/fixtures/multi-file-project'));
  const project = page.locator('.project-card', { hasText: 'multi-file-project' });
  await expect(project).toBeVisible();
  await project.getByRole('button', { name: 'Open' }).click();

  const assertProject = async () => {
    const frame = page.frameLocator('#projectFrame');
    await expect(frame.locator('#fixture-title')).toHaveCSS('color', 'rgb(18, 52, 86)');
    await expect(frame.locator('#script-result')).toHaveText('External JavaScript executed');
    await expect(frame.locator('#fetch-result')).toHaveText('Relative asset fetched');
    await expect.poll(() => frame.locator('#fixture-image').evaluate((image) => image.naturalWidth)).toBe(32);
    await expect(frame.locator('#css-asset')).toHaveCSS('background-image', /background\.svg/);
  };
  await assertProject();

  const virtualRoot = await page.locator('#projectFrame').getAttribute('src');
  const missing = await page.evaluate(async (url) => {
    const response = await fetch(new URL('missing.html', new URL(url, location.href)));
    return { status: response.status, type: response.headers.get('content-type'), body: await response.text() };
  }, virtualRoot);
  expect(missing).toEqual({ status: 404, type: 'text/plain; charset=utf-8', body: 'Pro Runner: file not found: missing.html' });

  await page.reload();
  await expect(page.locator('.project-card', { hasText: 'multi-file-project' })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#runtimeStatus')).toHaveText('Runtime ready');
  await page.locator('.project-card', { hasText: 'multi-file-project' }).getByRole('button', { name: 'Open' }).click();
  await assertProject();
  await context.setOffline(false);
});

test('activation cleans legacy shell caches and reports consistent runtime metadata', async ({ page }) => {
  await page.goto('./external-frame.html');
  await page.evaluate(async () => {
    await caches.open('pro-runner-patch-2.0.1-2026-09-18.3');
    await caches.open('pro-runner-shell-2.0.1');
  });

  await page.goto('./');
  await expect(page.locator('#runtimeStatus')).toHaveText('Runtime ready');

  const state = await page.evaluate(async () => {
    const version = await new Promise((resolveVersion) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => resolveVersion(event.data);
      navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    });
    const databaseVersion = await new Promise((resolveVersion, reject) => {
      const request = indexedDB.open('pro-runner-v1');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { resolveVersion(request.result.version); request.result.close(); };
    });
    return { version, databaseVersion, caches: await caches.keys() };
  });

  expect(state.version).toMatchObject({ version: '2.1.0-dev.1', build: '2026-09-18.6', releaseId: '2.1.0-dev.1-2026-09-18.6' });
  expect(state.databaseVersion).toBe(2);
  expect(state.caches).toContain('pro-runner-app-shell-2.1.0-dev.1-2026-09-18.6');
  expect(state.caches.some((name) => name.startsWith('pro-runner-patch-') || name.startsWith('pro-runner-shell-'))).toBe(false);
});

test('upgrades from the previously deployed worker without losing browser data', async ({ page, request }) => {
  await page.addInitScript(() => localStorage.setItem('pro-runner-update-auto-check', 'false'));
  try {
    expect((await request.post('/__test__/deployment?mode=legacy')).ok()).toBe(true);
    await page.goto('./');
    await expect(page.locator('#runtimeStatus')).toHaveText('Runtime ready');
    await expect(page.locator('#installedVersionValue')).toHaveText('2.0.1');
    await page.locator('#filePicker').setInputFiles({
      name: 'upgrade-data.html',
      mimeType: 'text/html',
      buffer: Buffer.from('<h1 id="upgrade-data">Upgrade data survived</h1>'),
    });
    await expect(page.locator('.project-card', { hasText: 'upgrade-data' })).toBeVisible();

    expect((await request.post('/__test__/deployment?mode=current')).ok()).toBe(true);
    await page.locator('#settingsButton').click();
    await page.locator('#checkUpdateButton').click();
    await expect(page.locator('#updateCheckStatus')).toHaveText('Version 2.1.0-dev.1 is ready to install.');
    const loaded = page.waitForEvent('load');
    await page.locator('#installUpdateButton').click();
    await loaded;

    await expect(page.locator('#installedVersionValue')).toHaveText('2.1.0-dev.1');
    await expect(page.locator('.project-card', { hasText: 'upgrade-data' })).toBeVisible();
    const cachesAfter = await page.evaluate(() => caches.keys());
    expect(cachesAfter).toContain('pro-runner-app-shell-2.1.0-dev.1-2026-09-18.6');
    expect(cachesAfter.some((name) => name.startsWith('pro-runner-patch-') || name.startsWith('pro-runner-shell-'))).toBe(false);
  } finally {
    await request.post('/__test__/deployment?mode=current');
  }
});

test('manual update failures are visible without replacing the current page', async ({ context, page }) => {
  await page.addInitScript(() => localStorage.setItem('pro-runner-update-auto-check', 'false'));
  await page.goto('./');
  await expect(page.locator('#runtimeStatus')).toHaveText('Runtime ready');
  await page.locator('#settingsButton').click();
  await context.setOffline(true);
  await page.locator('#checkUpdateButton').click();
  await expect(page.locator('#updateCheckStatus')).toHaveText('Unable to check while offline.');
  await expect(page.locator('#settingsDialog')).toBeVisible();
  await context.setOffline(false);
});

test('stages and installs an update without losing imported projects', async ({ page, request }) => {
  await page.addInitScript(() => localStorage.setItem('pro-runner-update-auto-check', 'false'));
  await page.goto('./');
  await expect(page.locator('#runtimeStatus')).toHaveText('Runtime ready');
  await page.locator('#filePicker').setInputFiles({
    name: 'survives-update.html',
    mimeType: 'text/html',
    buffer: Buffer.from('<h1 id="survivor">Stored before update</h1>'),
  });
  await expect(page.locator('.project-card', { hasText: 'survives-update' })).toBeVisible();

  try {
    const staged = await request.post('/__test__/release?version=2.0.3&build=playwright-update');
    expect(staged.ok()).toBe(true);
    await page.locator('#settingsButton').click();
    await page.locator('#checkUpdateButton').click();
    await expect(page.locator('#updateCheckStatus')).toHaveText('Version 2.0.3 is ready to install.');
    await expect(page.locator('#installUpdateButton')).toBeVisible();

    await page.locator('#skipUpdateButton').click();
    await expect(page.locator('#updateCheckStatus')).toContainText('Version 2.0.3 is skipped.');

    const loaded = page.waitForEvent('load');
    await page.locator('#installUpdateButton').click();
    await loaded;
    await expect(page.locator('#installedVersionValue')).toHaveText('2.0.3');
    await expect(page.locator('.project-card', { hasText: 'survives-update' })).toBeVisible();
    await page.locator('.project-card', { hasText: 'survives-update' }).getByRole('button', { name: 'Open' }).click();
    await expect(page.frameLocator('#projectFrame').locator('#survivor')).toHaveText('Stored before update');
  } finally {
    await request.delete('/__test__/release');
  }
});

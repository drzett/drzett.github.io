const APP_VERSION = '1.2.0';
const DB_NAME = 'local-html-runner-v1';
const DB_VERSION = 1;
const FILE_STORE = 'files';
const META_STORE = 'meta';
const VIRTUAL_PREFIX = '__local__/';

const $ = (selector) => document.querySelector(selector);

const els = {
  homeView: $('#homeView'),
  viewerView: $('#viewerView'),
  viewer: $('#viewer'),
  installCard: $('#installCard'),
  statusDot: $('#statusDot'),
  statusTitle: $('#statusTitle'),
  statusText: $('#statusText'),
  resumeCard: $('#resumeCard'),
  resumeName: $('#resumeName'),
  resumeMeta: $('#resumeMeta'),
  resumeButton: $('#resumeButton'),
  openFileButton: $('#openFileButton'),
  openFolderButton: $('#openFolderButton'),
  filePicker: $('#filePicker'),
  folderPicker: $('#folderPicker'),
  autoOpenToggle: $('#autoOpenToggle'),
  wakeLockToggle: $('#wakeLockToggle'),
  spaFallbackToggle: $('#spaFallbackToggle'),
  storageButton: $('#storageButton'),
  forgetButton: $('#forgetButton'),
  versionLabel: $('#versionLabel'),
  menuButton: $('#menuButton'),
  viewerMenu: $('#viewerMenu'),
  viewerTitle: $('#viewerTitle'),
  viewerSubtitle: $('#viewerSubtitle'),
  reloadButton: $('#reloadButton'),
  changeFileButton: $('#changeFileButton'),
  changeFolderButton: $('#changeFolderButton'),
  directOpenButton: $('#directOpenButton'),
  backButton: $('#backButton'),
  entryDialog: $('#entryDialog'),
  entryList: $('#entryList'),
  infoDialog: $('#infoDialog'),
  infoTitle: $('#infoTitle'),
  infoBody: $('#infoBody'),
};

let currentProject = null;
let wakeLock = null;
let swReady = false;

function setStatus(kind, title, text) {
  els.statusDot.className = `status-dot ${kind === 'ready' ? '' : kind}`.trim();
  els.statusTitle.textContent = title;
  els.statusText.textContent = text;
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function loadSettings() {
  const getBool = (key, fallback) => {
    const value = localStorage.getItem(key);
    return value == null ? fallback : value === 'true';
  };
  els.autoOpenToggle.checked = getBool('autoOpen', true);
  els.wakeLockToggle.checked = getBool('wakeLock', false);
  els.spaFallbackToggle.checked = getBool('spaFallback', false);
}

function saveSetting(key, value) {
  localStorage.setItem(key, String(Boolean(value)));
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE, { keyPath: 'path' });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open local storage.'));
    request.onblocked = () => reject(new Error('Local storage is blocked by another open version of this app.'));
  });
}

async function idbGet(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result?.value ?? request.result ?? null);
    request.onerror = () => reject(request.error || new Error('Unable to read from local storage.'));
    tx.oncomplete = () => db.close();
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Local storage read was aborted.')); };
  });
}

async function idbPutMeta(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).put({ key, value });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Unable to update local storage.')); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Local storage update was aborted.')); };
  });
}

async function clearProjectData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([FILE_STORE, META_STORE], 'readwrite');
    tx.objectStore(FILE_STORE).clear();
    tx.objectStore(META_STORE).delete('project');
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Unable to clear local storage.')); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Clearing local storage was aborted.')); };
  });
}

function sanitizePath(input) {
  const normalized = String(input || '').replaceAll('\\', '/').replace(/^\/+/, '');
  const output = [];
  for (const raw of normalized.split('/')) {
    const part = raw.trim();
    if (!part || part === '.') continue;
    if (part === '..') throw new Error(`Unsafe relative path: ${input}`);
    output.push(part);
  }
  return output.join('/');
}

function stripCommonTopDirectory(fileEntries) {
  const paths = fileEntries.map(({ relativePath }) => relativePath.split('/'));
  if (!paths.length || paths.some((parts) => parts.length < 2)) return fileEntries;
  const first = paths[0][0];
  if (!paths.every((parts) => parts[0] === first)) return fileEntries;
  return fileEntries.map((entry) => ({
    ...entry,
    relativePath: entry.relativePath.split('/').slice(1).join('/'),
  }));
}

function guessMime(path, supplied = '') {
  if (supplied && supplied !== 'application/octet-stream') return supplied;
  const ext = path.toLowerCase().split('.').pop();
  const map = {
    html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', xhtml: 'application/xhtml+xml',
    css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8', webmanifest: 'application/manifest+json; charset=utf-8', map: 'application/json; charset=utf-8',
    txt: 'text/plain; charset=utf-8', md: 'text/markdown; charset=utf-8', csv: 'text/csv; charset=utf-8', xml: 'application/xml',
    svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon', heic: 'image/heic',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
    mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', wasm: 'application/wasm', pdf: 'application/pdf',
  };
  return map[ext] || 'application/octet-stream';
}

async function readFileBytes(file) {
  if (!file) throw new Error('No file was selected.');
  try {
    const bytes = await file.arrayBuffer();
    if (file.size > 0 && bytes.byteLength === 0) throw new Error('The browser returned an empty file buffer.');
    return bytes;
  } catch (error) {
    const detail = error?.message ? ` ${error.message}` : '';
    throw new Error(`Unable to read "${file.name || 'selected file'}".${detail}`);
  }
}

async function storeFiles(records, project) {
  const db = await openDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction([FILE_STORE, META_STORE], 'readwrite');
      const files = tx.objectStore(FILE_STORE);
      files.clear();
      for (const record of records) files.put(record);
      tx.objectStore(META_STORE).put({ key: 'project', value: project });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('The browser could not store the imported files.'));
      tx.onabort = () => reject(tx.error || new Error('The browser aborted the local file import.'));
    });
  } finally {
    db.close();
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: index ? 1 : 0 })} ${units[index]}`;
}

function virtualURL(path) {
  const encoded = sanitizePath(path).split('/').map(encodeURIComponent).join('/');
  return new URL(`./${VIRTUAL_PREFIX}${encoded}`, location.href).href;
}

async function ensureServiceWorker() {
  if (!('serviceWorker' in navigator)) throw new Error('Service workers are not supported by this browser.');
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'RUNNER_SW_READY') swReady = true;
  });
  await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) {
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 2500);
      navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(timer); resolve(); }, { once: true });
    });
  }
  swReady = Boolean(navigator.serviceWorker.controller);
  return swReady;
}

async function askForPersistentStorage() {
  try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch { /* best effort */ }
}

async function updateWorkerSettings() {
  await idbPutMeta('settings', { spaFallback: els.spaFallbackToggle.checked });
  navigator.serviceWorker.controller?.postMessage({ type: 'RUNNER_SETTINGS_CHANGED' });
}

async function chooseEntry(htmlPaths) {
  if (!htmlPaths.length) throw new Error('No HTML document was found in this folder.');
  const rootIndex = htmlPaths.find((path) => /^index\.html?$/i.test(path));
  if (rootIndex) return rootIndex;
  const shallowIndex = [...htmlPaths]
    .filter((path) => /(^|\/)index\.html?$/i.test(path))
    .sort((a, b) => a.split('/').length - b.split('/').length)[0];
  if (shallowIndex) return shallowIndex;
  if (htmlPaths.length === 1) return htmlPaths[0];

  els.entryList.replaceChildren();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => { if (!settled) { settled = true; resolve(value); } };
    for (const path of [...htmlPaths].sort((a, b) => a.localeCompare(b))) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'entry-option';
      button.textContent = path;
      button.addEventListener('click', () => { finish(path); els.entryDialog.close('selected'); });
      els.entryList.append(button);
    }
    els.entryDialog.addEventListener('close', () => {
      if (els.entryDialog.returnValue !== 'selected') finish(null);
    }, { once: true });
    els.entryDialog.showModal();
  });
}

async function importSingleFile(file) {
  if (!file) return;
  if (!/\.(html?|xhtml)$/i.test(file.name || '') && !/html|xhtml/i.test(file.type || '')) {
    throw new Error('Select an HTML, HTM, or XHTML document.');
  }

  setStatus('busy', 'Importing HTML…', file.name);

  // Materialize picker-backed data immediately. Recent WebKit releases can lose access
  // to disk-backed File objects after asynchronous/storage boundaries.
  const bytes = await readFileBytes(file);
  await askForPersistentStorage();

  const path = sanitizePath(file.name || 'index.html');
  const record = {
    path,
    bytes,
    type: guessMime(path, file.type),
    size: bytes.byteLength,
    lastModified: file.lastModified || Date.now(),
  };
  const project = {
    kind: 'file', name: file.name || path, entryPath: path,
    fileCount: 1, totalBytes: bytes.byteLength, importedAt: Date.now(),
  };

  await storeFiles([record], project);
  currentProject = project;
  await updateWorkerSettings();
  refreshProjectUI();
  setStatus('ready', 'Ready', 'The file is stored locally in this browser profile.');
  await openProject();
}

async function importFolder(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;

  setStatus('busy', 'Importing project folder…', `Reading ${files.length.toLocaleString()} files.`);
  let entries = files.map((file) => ({ file, relativePath: sanitizePath(file.webkitRelativePath || file.name) }));
  entries = stripCommonTopDirectory(entries);

  const records = [];
  let totalBytes = 0;
  for (let index = 0; index < entries.length; index += 1) {
    const { file, relativePath } = entries[index];
    const bytes = await readFileBytes(file);
    totalBytes += bytes.byteLength;
    records.push({
      path: sanitizePath(relativePath), bytes, type: guessMime(relativePath, file.type),
      size: bytes.byteLength, lastModified: file.lastModified || Date.now(),
    });
    if (entries.length > 20 && (index % 10 === 0 || index === entries.length - 1)) {
      setStatus('busy', 'Importing project folder…', `Read ${(index + 1).toLocaleString()} of ${entries.length.toLocaleString()} files.`);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }

  await askForPersistentStorage();
  const htmlPaths = records.map((record) => record.path).filter((path) => /\.(html?|xhtml)$/i.test(path));
  const entryPath = await chooseEntry(htmlPaths);
  if (!entryPath) { setStatus('ready', 'Ready', 'Import cancelled.'); return; }

  const project = {
    kind: 'folder',
    name: files[0]?.webkitRelativePath?.split('/')[0] || 'Web project',
    entryPath, fileCount: records.length, totalBytes, importedAt: Date.now(),
  };

  setStatus('busy', 'Importing project folder…', 'Saving files to local browser storage.');
  await storeFiles(records, project);
  currentProject = project;
  await updateWorkerSettings();
  refreshProjectUI();
  setStatus('ready', 'Ready', `${records.length.toLocaleString()} files imported locally.`);
  await openProject();
}

async function openProject() {
  if (!currentProject) return;
  if (!swReady) throw new Error('The virtual local file layer is not active yet. Reload the runner and try again.');
  els.viewerTitle.textContent = currentProject.name;
  els.viewerSubtitle.textContent = currentProject.entryPath;
  els.viewer.src = virtualURL(currentProject.entryPath);
  els.homeView.classList.add('hidden');
  els.viewerView.classList.remove('hidden');
  closeViewerMenu();
  if (els.wakeLockToggle.checked) await acquireWakeLock();
}

function closeViewer() {
  els.viewer.src = 'about:blank';
  els.viewerView.classList.add('hidden');
  els.homeView.classList.remove('hidden');
  closeViewerMenu();
  releaseWakeLock();
}

function openDirectMode() {
  if (currentProject) location.href = virtualURL(currentProject.entryPath);
}

function refreshProjectUI() {
  if (!currentProject) {
    els.resumeCard.classList.add('hidden');
    els.forgetButton.classList.add('hidden');
    return;
  }
  const fileLabel = currentProject.fileCount === 1 ? 'file' : 'files';
  els.resumeName.textContent = currentProject.name;
  els.resumeMeta.textContent = `${currentProject.fileCount.toLocaleString()} ${fileLabel} · ${formatBytes(currentProject.totalBytes)} · ${currentProject.entryPath}`;
  els.resumeCard.classList.remove('hidden');
  els.forgetButton.classList.remove('hidden');
}

function toggleViewerMenu() {
  const open = !els.viewerMenu.classList.toggle('hidden');
  els.menuButton.setAttribute('aria-expanded', String(open));
}

function closeViewerMenu() {
  els.viewerMenu.classList.add('hidden');
  els.menuButton.setAttribute('aria-expanded', 'false');
}

async function acquireWakeLock() {
  if (!els.wakeLockToggle.checked || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; }, { once: true });
  } catch { /* optional browser capability */ }
}

function releaseWakeLock() {
  try { wakeLock?.release(); } catch { /* no-op */ }
  wakeLock = null;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));
}

function showInfo(title, html) {
  els.infoTitle.textContent = title;
  els.infoBody.innerHTML = html;
  els.infoDialog.showModal();
}

async function showStorageInfo() {
  let content = `<p><strong>Current import:</strong> ${currentProject ? `${escapeHTML(currentProject.name)} (${formatBytes(currentProject.totalBytes)})` : 'None'}</p>`;
  try {
    if (navigator.storage?.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      content += `<p><strong>Origin storage:</strong> ${formatBytes(usage)} of approximately ${formatBytes(quota)}</p>`;
    }
    if (navigator.storage?.persisted) {
      const persisted = await navigator.storage.persisted();
      content += `<p><strong>Persistent storage:</strong> ${persisted ? 'Granted' : 'Not guaranteed'}</p>`;
    }
  } catch { /* optional browser capability */ }
  content += '<p>Imported files are kept in IndexedDB on this device. The runner does not upload them. Imported HTML or JavaScript may still make its own network requests.</p>';
  showInfo('Storage', content);
}

async function forgetProject() {
  if (!currentProject) return;
  if (!confirm('Remove the locally imported copy? The original files on your device will not be changed.')) return;
  closeViewer();
  await clearProjectData();
  currentProject = null;
  refreshProjectUI();
  setStatus('ready', 'Ready', 'No local import is currently stored.');
}

function handleError(error) {
  console.error(error);
  const message = error?.message || (error == null ? 'An unknown browser storage error occurred.' : String(error));
  setStatus('error', 'Error', message);
  showInfo('Error', `<p>${escapeHTML(message)}</p>`);
}

function wireEvents() {
  els.openFileButton.addEventListener('click', () => els.filePicker.click());
  els.openFolderButton.addEventListener('click', () => els.folderPicker.click());

  els.filePicker.addEventListener('change', async () => {
    const file = els.filePicker.files?.[0];
    try { await importSingleFile(file); }
    catch (error) { handleError(error); }
    finally { els.filePicker.value = ''; }
  });

  els.folderPicker.addEventListener('change', async () => {
    const files = els.folderPicker.files;
    try { await importFolder(files); }
    catch (error) { handleError(error); }
    finally { els.folderPicker.value = ''; }
  });

  els.resumeButton.addEventListener('click', () => openProject().catch(handleError));
  els.menuButton.addEventListener('click', toggleViewerMenu);
  els.reloadButton.addEventListener('click', () => {
    if (currentProject) els.viewer.src = `${virtualURL(currentProject.entryPath)}?reload=${Date.now()}`;
    closeViewerMenu();
  });
  els.changeFileButton.addEventListener('click', () => { closeViewerMenu(); els.filePicker.click(); });
  els.changeFolderButton.addEventListener('click', () => { closeViewerMenu(); els.folderPicker.click(); });
  els.directOpenButton.addEventListener('click', openDirectMode);
  els.backButton.addEventListener('click', closeViewer);
  els.storageButton.addEventListener('click', () => showStorageInfo().catch(handleError));
  els.forgetButton.addEventListener('click', () => forgetProject().catch(handleError));

  els.autoOpenToggle.addEventListener('change', () => saveSetting('autoOpen', els.autoOpenToggle.checked));
  els.wakeLockToggle.addEventListener('change', async () => {
    saveSetting('wakeLock', els.wakeLockToggle.checked);
    if (els.wakeLockToggle.checked && !els.viewerView.classList.contains('hidden')) await acquireWakeLock();
    else releaseWakeLock();
  });
  els.spaFallbackToggle.addEventListener('change', () => {
    saveSetting('spaFallback', els.spaFallbackToggle.checked);
    updateWorkerSettings().catch(handleError);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !els.viewerView.classList.contains('hidden')) acquireWakeLock();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!els.viewerMenu.classList.contains('hidden') && !els.viewerMenu.contains(event.target) && event.target !== els.menuButton) closeViewerMenu();
  });
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', async (event) => {
    event.preventDefault();
    if (event.dataTransfer?.files?.length === 1) {
      try { await importSingleFile(event.dataTransfer.files[0]); }
      catch (error) { handleError(error); }
    }
  });
}

async function init() {
  els.versionLabel.textContent = `v${APP_VERSION}`;
  loadSettings();
  els.installCard.classList.toggle('hidden', isStandalone());
  wireEvents();

  try {
    await ensureServiceWorker();
    currentProject = await idbGet(META_STORE, 'project');
    await updateWorkerSettings();
    refreshProjectUI();

    els.openFileButton.disabled = false;
    const folderImportSupported = 'webkitdirectory' in els.folderPicker;
    els.openFolderButton.disabled = !folderImportSupported;
    if (!folderImportSupported) els.openFolderButton.title = 'Folder import is not supported by this browser.';

    setStatus('ready', 'Ready', swReady ? 'The virtual local file layer is active.' : 'The runner is ready.');
    if (currentProject && els.autoOpenToggle.checked && isStandalone()) {
      requestAnimationFrame(() => setTimeout(() => openProject().catch(handleError), 80));
    }
  } catch (error) {
    handleError(error);
  }
}

init();
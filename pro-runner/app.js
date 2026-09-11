import { parseZip } from './zip.js';

const APP_VERSION = '1.0.0';
const DB_NAME = 'pro-runner-v1';
const DB_VERSION = 1;
const PROJECT_STORE = 'projects';
const FILE_STORE = 'files';
const META_STORE = 'meta';
const ASSET_STORE = 'assets';
const VIRTUAL_PREFIX = '__site/';
const MAX_LOGS = 400;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  workspace: $('#workspace'), homeScreen: $('#homeScreen'), wallpaper: $('#wallpaper'), statusTime: $('#statusTime'),
  widgetArea: $('#widgetArea'), homeAppGrid: $('#homeAppGrid'), homeDock: $('#homeDock'), homeEditDone: $('#homeEditDone'),
  workspaceViewButton: $('#workspaceViewButton'), homeViewButton: $('#homeViewButton'), settingsButton: $('#settingsButton'),
  runtimeOrb: $('#runtimeOrb'), runtimeStatus: $('#runtimeStatus'), runtimeDetail: $('#runtimeDetail'),
  importFileButton: $('#importFileButton'), importFolderButton: $('#importFolderButton'), importZipButton: $('#importZipButton'),
  projectSearch: $('#projectSearch'), projectCount: $('#projectCount'), projectGrid: $('#projectGrid'), emptyLibrary: $('#emptyLibrary'),
  capabilityGrid: $('#capabilityGrid'), activityButton: $('#activityButton'), versionLabel: $('#versionLabel'),
  viewer: $('#viewer'), projectFrame: $('#projectFrame'), viewerControl: $('#viewerControl'), viewerMenu: $('#viewerMenu'),
  viewerProjectName: $('#viewerProjectName'), viewerProjectPath: $('#viewerProjectPath'), viewerReload: $('#viewerReload'),
  viewerDebug: $('#viewerDebug'), viewerHome: $('#viewerHome'), viewerWorkspace: $('#viewerWorkspace'), perfHud: $('#perfHud'),
  perfFps: $('#perfFps'), perfFrame: $('#perfFrame'),
  filePicker: $('#filePicker'), folderPicker: $('#folderPicker'), zipPicker: $('#zipPicker'), wallpaperPicker: $('#wallpaperPicker'), iconPicker: $('#iconPicker'),
  entryDialog: $('#entryDialog'), entryList: $('#entryList'),
  projectDialog: $('#projectDialog'), projectDialogTitle: $('#projectDialogTitle'), projectNameInput: $('#projectNameInput'),
  projectTrustSelect: $('#projectTrustSelect'), projectSpaSelect: $('#projectSpaSelect'), projectCompatToggle: $('#projectCompatToggle'),
  projectDebugToggle: $('#projectDebugToggle'), projectDockToggle: $('#projectDockToggle'), projectIconPreview: $('#projectIconPreview'),
  chooseIconButton: $('#chooseIconButton'), clearIconButton: $('#clearIconButton'), updateProjectButton: $('#updateProjectButton'),
  deleteProjectButton: $('#deleteProjectButton'), saveProjectButton: $('#saveProjectButton'),
  settingsDialog: $('#settingsDialog'), startViewSelect: $('#startViewSelect'), iconLabelsToggle: $('#iconLabelsToggle'),
  wallpaperPresets: $('#wallpaperPresets'), customWallpaperButton: $('#customWallpaperButton'), wallpaperDimRange: $('#wallpaperDimRange'),
  clockWidgetToggle: $('#clockWidgetToggle'), calendarWidgetToggle: $('#calendarWidgetToggle'), defaultCompatToggle: $('#defaultCompatToggle'),
  defaultDebugToggle: $('#defaultDebugToggle'), storageSummary: $('#storageSummary'), clearAllButton: $('#clearAllButton'),
  diagnosticsDialog: $('#diagnosticsDialog'), closeDiagnostics: $('#closeDiagnostics'), consolePanel: $('#consolePanel'),
  networkPanel: $('#networkPanel'), performancePanel: $('#performancePanel'), consoleLog: $('#consoleLog'), networkLog: $('#networkLog'),
  clearConsole: $('#clearConsole'), clearNetwork: $('#clearNetwork'), diagFps: $('#diagFps'), diagMedian: $('#diagMedian'),
  diagP95: $('#diagP95'), diagLongFrames: $('#diagLongFrames'), toastHost: $('#toastHost'),
};

const WALLPAPERS = [
  { id:'graphite', label:'Graphite', css:'radial-gradient(circle at 24% 16%, #737987 0%, #343942 26%, #15181e 62%, #08090b 100%)' },
  { id:'ocean', label:'Ocean', css:'radial-gradient(circle at 22% 8%, #6aa7bf 0%, #376a81 22%, #19384a 48%, #0b1722 100%)' },
  { id:'ember', label:'Ember', css:'radial-gradient(circle at 70% 4%, #c48869 0%, #754c4a 24%, #2c2730 57%, #111116 100%)' },
  { id:'forest', label:'Forest', css:'radial-gradient(circle at 18% 4%, #7da58b 0%, #466751 25%, #20342c 52%, #0b1410 100%)' },
  { id:'violet', label:'Violet', css:'radial-gradient(circle at 72% 10%, #9d8ec2 0%, #5d547f 24%, #302c4d 52%, #11111c 100%)' },
];

const DEFAULT_SETTINGS = {
  startView: 'workspace', iconLabels: true, wallpaper: 'graphite', wallpaperDim: 18,
  clockWidget: true, calendarWidget: true, defaultCompat: true, defaultDebug: false,
};

const state = {
  projects: [], settings: { ...DEFAULT_SETTINGS }, currentProjectId: null, editingProjectId: null,
  pendingUpdateId: null, pendingUpdateKind: null, homeEditMode: false, swReady: false,
  consoleLogs: [], networkLogs: [], perf: null, objectURLs: new Map(), longPressTimer: null,
};

function setRuntime(kind, title, detail) {
  els.runtimeOrb.className = `status-orb ${kind || ''}`.trim();
  els.runtimeStatus.textContent = title;
  els.runtimeDetail.textContent = detail;
}

function toast(message, duration = 2400) {
  const item = document.createElement('div');
  item.className = 'toast';
  item.textContent = message;
  els.toastHost.append(item);
  setTimeout(() => item.remove(), duration);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  const units = ['B','KB','MB','GB','TB'];
  let value = bytes, i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i += 1; }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: i ? 1 : 0 })} ${units[i]}`;
}

function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizePath(input) {
  const normalized = String(input || '').replaceAll('\\','/').replace(/^\/+/, '');
  const output = [];
  for (const raw of normalized.split('/')) {
    const part = raw.trim();
    if (!part || part === '.') continue;
    if (part === '..') throw new Error(`Unsafe relative path: ${input}`);
    output.push(part);
  }
  return output.join('/');
}

function stripCommonTopDirectory(entries) {
  const parts = entries.map((entry) => entry.path.split('/'));
  if (!parts.length || parts.some((row) => row.length < 2)) return entries;
  const first = parts[0][0];
  if (!parts.every((row) => row[0] === first)) return entries;
  return entries.map((entry) => ({ ...entry, path: entry.path.split('/').slice(1).join('/') }));
}

function guessMime(path, supplied = '') {
  if (supplied && supplied !== 'application/octet-stream') return supplied;
  const ext = path.toLowerCase().split('.').pop();
  const map = {
    html:'text/html; charset=utf-8', htm:'text/html; charset=utf-8', xhtml:'application/xhtml+xml', css:'text/css; charset=utf-8',
    js:'text/javascript; charset=utf-8', mjs:'text/javascript; charset=utf-8', cjs:'text/javascript; charset=utf-8', json:'application/json; charset=utf-8',
    webmanifest:'application/manifest+json; charset=utf-8', map:'application/json; charset=utf-8', txt:'text/plain; charset=utf-8', md:'text/markdown; charset=utf-8',
    csv:'text/csv; charset=utf-8', xml:'application/xml', svg:'image/svg+xml', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif',
    webp:'image/webp', avif:'image/avif', ico:'image/x-icon', heic:'image/heic', woff:'font/woff', woff2:'font/woff2', ttf:'font/ttf', otf:'font/otf',
    mp3:'audio/mpeg', m4a:'audio/mp4', wav:'audio/wav', ogg:'audio/ogg', flac:'audio/flac', mp4:'video/mp4', webm:'video/webm', mov:'video/quicktime',
    wasm:'application/wasm', pdf:'application/pdf', zip:'application/zip',
  };
  return map[ext] || 'application/octet-stream';
}

async function sha256(buffer) {
  if (!crypto.subtle?.digest) return null;
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2,'0')).join('');
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PROJECT_STORE)) db.createObjectStore(PROJECT_STORE, { keyPath:'id' });
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        const store = db.createObjectStore(FILE_STORE, { keyPath:'key' });
        store.createIndex('byProject','projectId',{ unique:false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE,{ keyPath:'key' });
      if (!db.objectStoreNames.contains(ASSET_STORE)) db.createObjectStore(ASSET_STORE,{ keyPath:'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Unable to open local storage.'));
    req.onblocked = () => reject(new Error('Local storage is blocked by another open app instance.'));
  });
}

async function idbGet(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store,'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error('Storage read failed.'));
    tx.oncomplete = () => db.close();
    tx.onabort = () => db.close();
  });
}

async function idbGetAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store,'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error || new Error('Storage read failed.'));
    tx.oncomplete = () => db.close();
    tx.onabort = () => db.close();
  });
}

async function idbPut(store, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store,'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Storage write failed.')); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Storage write was aborted.')); };
  });
}

async function idbDelete(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store,'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Storage delete failed.')); };
  });
}

async function getProjectFiles(projectId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE,'readonly');
    const index = tx.objectStore(FILE_STORE).index('byProject');
    const req = index.getAll(IDBKeyRange.only(projectId));
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error || new Error('Unable to read project files.'));
    tx.oncomplete = () => db.close();
    tx.onabort = () => db.close();
  });
}

async function deleteProjectData(projectId) {
  const files = await getProjectFiles(projectId);
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([PROJECT_STORE,FILE_STORE,ASSET_STORE],'readwrite');
    tx.objectStore(PROJECT_STORE).delete(projectId);
    const fileStore = tx.objectStore(FILE_STORE);
    for (const file of files) fileStore.delete(file.key);
    tx.objectStore(ASSET_STORE).delete(`icon:${projectId}`);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Unable to delete project.'));
    tx.onabort = () => reject(tx.error || new Error('Project deletion was aborted.'));
  });
  db.close();
}

async function clearEverything() {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([PROJECT_STORE,FILE_STORE,META_STORE,ASSET_STORE],'readwrite');
    tx.objectStore(PROJECT_STORE).clear(); tx.objectStore(FILE_STORE).clear(); tx.objectStore(META_STORE).clear(); tx.objectStore(ASSET_STORE).clear();
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error || new Error('Unable to clear local data.'));
  });
  db.close();
  localStorage.clear();
}

function fileKey(projectId, path) { return `${projectId}:${path}`; }

async function saveProjectRecords(project, records, isUpdate = false) {
  const existing = isUpdate ? await getProjectFiles(project.id) : [];
  const oldMap = new Map(existing.map((file) => [file.path,file]));
  const newMap = new Map(records.map((file) => [file.path,file]));
  const changed = records.filter((file) => !oldMap.has(file.path) || oldMap.get(file.path).hash !== file.hash);
  const removed = existing.filter((file) => !newMap.has(file.path));
  const unchanged = records.length - changed.length;
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([PROJECT_STORE,FILE_STORE],'readwrite');
    const fileStore = tx.objectStore(FILE_STORE);
    for (const file of removed) fileStore.delete(file.key);
    for (const file of changed) fileStore.put(file);
    tx.objectStore(PROJECT_STORE).put(project);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Unable to save imported project.'));
    tx.onabort = () => reject(tx.error || new Error('Project import was aborted.'));
  });
  db.close();
  return { changed: changed.length, removed: removed.length, unchanged };
}

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem('pro-runner-settings') || '{}');
    state.settings = { ...DEFAULT_SETTINGS, ...parsed };
  } catch { state.settings = { ...DEFAULT_SETTINGS }; }
}
function saveSettings() { localStorage.setItem('pro-runner-settings', JSON.stringify(state.settings)); }

function virtualURL(projectId, path = '') {
  const project = encodeURIComponent(projectId);
  const encoded = sanitizePath(path).split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return new URL(`./${VIRTUAL_PREFIX}${project}/${encoded}`, location.href).href;
}

async function ensureServiceWorker() {
  if (!('serviceWorker' in navigator)) throw new Error('Service workers are not supported by this browser.');
  navigator.serviceWorker.addEventListener('message', onServiceWorkerMessage);
  await navigator.serviceWorker.register('./sw.js', { scope:'./', updateViaCache:'none' });
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) {
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 2500);
      navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(timer); resolve(); }, { once:true });
    });
  }
  state.swReady = Boolean(navigator.serviceWorker.controller);
  return state.swReady;
}

function onServiceWorkerMessage(event) {
  const data = event.data;
  if (data?.type === 'PRO_RUNNER_SW_READY') state.swReady = true;
  if (data?.type === 'PRO_RUNNER_NETWORK' && data.entry) {
    state.networkLogs.unshift(data.entry);
    if (state.networkLogs.length > MAX_LOGS) state.networkLogs.length = MAX_LOGS;
    if (els.diagnosticsDialog.open && els.networkPanel.classList.contains('active')) renderNetworkLog();
  }
}

async function materializeBrowserFiles(files, projectId, sourcePrefix = '') {
  const records = [];
  const list = Array.from(files || []);
  for (let i = 0; i < list.length; i += 1) {
    const file = list[i];
    const rawPath = file.webkitRelativePath || file.name;
    let path = sanitizePath(rawPath);
    if (sourcePrefix && path.startsWith(`${sourcePrefix}/`)) path = path.slice(sourcePrefix.length + 1);
    setRuntime('', 'Importing project…', `${i + 1} of ${list.length}: ${path}`);
    let bytes;
    try { bytes = await file.arrayBuffer(); }
    catch (error) { throw new Error(`Unable to read "${file.name}". ${error?.message || ''}`.trim()); }
    const hash = await sha256(bytes);
    records.push({ key:fileKey(projectId,path), projectId, path, bytes, type:guessMime(path,file.type), size:bytes.byteLength, hash, lastModified:file.lastModified || Date.now() });
  }
  return records;
}

async function materializeZipEntries(entries, projectId) {
  let normalized = entries.map((entry) => ({ ...entry, path:sanitizePath(entry.name) }));
  normalized = stripCommonTopDirectory(normalized);
  const records = [];
  for (let i = 0; i < normalized.length; i += 1) {
    const entry = normalized[i];
    setRuntime('', 'Importing archive…', `${i + 1} of ${normalized.length}: ${entry.path}`);
    const hash = await sha256(entry.bytes);
    records.push({ key:fileKey(projectId,entry.path), projectId, path:entry.path, bytes:entry.bytes, type:guessMime(entry.path), size:entry.bytes.byteLength, hash, lastModified:Date.now() });
  }
  return records;
}

async function chooseEntry(paths) {
  const htmlPaths = paths.filter((path) => /\.(html?|xhtml)$/i.test(path));
  if (!htmlPaths.length) throw new Error('No HTML document was found in this project.');
  const rootIndex = htmlPaths.find((path) => /^index\.html?$/i.test(path));
  if (rootIndex) return rootIndex;
  const shallowIndex = [...htmlPaths].filter((path) => /(^|\/)index\.html?$/i.test(path)).sort((a,b) => a.split('/').length - b.split('/').length)[0];
  if (shallowIndex) return shallowIndex;
  if (htmlPaths.length === 1) return htmlPaths[0];
  els.entryList.replaceChildren();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => { if (!settled) { settled = true; resolve(value); } };
    for (const path of htmlPaths.sort((a,b) => a.localeCompare(b))) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = path;
      button.addEventListener('click', () => { finish(path); els.entryDialog.close('selected'); });
      els.entryList.append(button);
    }
    els.entryDialog.addEventListener('close', () => { if (els.entryDialog.returnValue !== 'selected') finish(null); }, { once:true });
    els.entryDialog.showModal();
  });
}

function resolveProjectPath(baseFile, reference) {
  if (!reference || /^(?:[a-z]+:|\/\/|#)/i.test(reference)) return null;
  const clean = reference.split('#')[0].split('?')[0];
  if (!clean) return null;
  if (clean.startsWith('/')) return sanitizePath(clean);
  const baseParts = sanitizePath(baseFile).split('/'); baseParts.pop();
  for (const part of clean.replaceAll('\\','/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') baseParts.pop(); else baseParts.push(part);
  }
  return sanitizePath(baseParts.join('/'));
}

async function analyzeProject(records, entryPath, fallbackName) {
  const map = new Map(records.map((record) => [record.path,record]));
  const entry = map.get(entryPath);
  let name = fallbackName.replace(/\.(?:html?|zip)$/i,'') || 'Local project';
  let iconPath = null, themeColor = null;
  if (!entry) return { name, iconPath, themeColor };
  try {
    const html = new TextDecoder().decode(entry.bytes);
    const doc = new DOMParser().parseFromString(html,'text/html');
    const title = doc.querySelector('title')?.textContent?.trim();
    if (title) name = title.slice(0,80);
    themeColor = doc.querySelector('meta[name="theme-color"]')?.getAttribute('content')?.trim() || null;
    const manifestRef = doc.querySelector('link[rel~="manifest"]')?.getAttribute('href');
    const manifestPath = resolveProjectPath(entryPath, manifestRef);
    if (manifestPath && map.has(manifestPath)) {
      try {
        const manifest = JSON.parse(new TextDecoder().decode(map.get(manifestPath).bytes));
        if (manifest.name || manifest.short_name) name = String(manifest.name || manifest.short_name).slice(0,80);
        if (manifest.theme_color) themeColor = manifest.theme_color;
        const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
        const candidates = icons.map((icon) => ({ ...icon, local:resolveProjectPath(manifestPath, icon.src) })).filter((icon) => icon.local && map.has(icon.local));
        candidates.sort((a,b) => parseInt(b.sizes,10) - parseInt(a.sizes,10));
        if (candidates[0]) iconPath = candidates[0].local;
      } catch {}
    }
    if (!iconPath) {
      const iconLinks = [...doc.querySelectorAll('link[rel*="icon"]')];
      for (const link of iconLinks) {
        const candidate = resolveProjectPath(entryPath, link.getAttribute('href'));
        if (candidate && map.has(candidate)) { iconPath = candidate; break; }
      }
    }
  } catch {}
  return { name, iconPath, themeColor };
}

async function finalizeImport({ records, entryPath, sourceName, kind, existingProject = null }) {
  if (!entryPath) return;
  const id = existingProject?.id || records[0]?.projectId || newId();
  const analyzed = await analyzeProject(records, entryPath, sourceName);
  const now = Date.now();
  const maxOrder = state.projects.reduce((max,p) => Math.max(max, Number(p.homeOrder) || 0), 0);
  const project = {
    id, name: existingProject?.customName ? existingProject.name : analyzed.name, customName: existingProject?.customName || false,
    sourceName, kind, entryPath, iconPath: analyzed.iconPath, themeColor: analyzed.themeColor,
    fileCount: records.length, totalBytes: records.reduce((sum,r) => sum + r.size,0), importedAt: existingProject?.importedAt || now,
    updatedAt: now, trust: existingProject?.trust || 'trusted', compatibility: existingProject?.compatibility ?? state.settings.defaultCompat,
    debug: existingProject?.debug ?? state.settings.defaultDebug, spaFallback: existingProject?.spaFallback || false,
    dock: existingProject?.dock || false, homeOrder: existingProject?.homeOrder || maxOrder + 1,
  };
  const diff = await saveProjectRecords(project, records, Boolean(existingProject));
  await reloadProjects();
  setRuntime('ready','Runtime ready',`${state.projects.length} local ${state.projects.length === 1 ? 'project' : 'projects'} available.`);
  if (existingProject) toast(`Updated: ${diff.changed} changed, ${diff.removed} removed, ${diff.unchanged} unchanged.`);
  else toast(`Imported ${project.name}.`);
  await openProject(project.id);
}

async function importSingleFile(file, updateId = null) {
  if (!file) return;
  if (!/\.(html?|xhtml)$/i.test(file.name || '') && !/html|xhtml/i.test(file.type || '')) throw new Error('Select an HTML, HTM, or XHTML document.');
  const existingProject = updateId ? state.projects.find((p) => p.id === updateId) : null;
  const id = existingProject?.id || newId();
  const records = await materializeBrowserFiles([file], id);
  await finalizeImport({ records, entryPath:records[0].path, sourceName:file.name, kind:'file', existingProject });
}

async function importFolder(fileList, updateId = null) {
  const files = Array.from(fileList || []); if (!files.length) return;
  const existingProject = updateId ? state.projects.find((p) => p.id === updateId) : null;
  const id = existingProject?.id || newId();
  const root = files[0]?.webkitRelativePath?.split('/')[0] || 'Web project';
  const records = await materializeBrowserFiles(files, id, root);
  const entryPath = await chooseEntry(records.map((r) => r.path));
  if (!entryPath) return;
  await finalizeImport({ records, entryPath, sourceName:root, kind:'folder', existingProject });
}

async function importZip(file, updateId = null) {
  if (!file) return;
  const existingProject = updateId ? state.projects.find((p) => p.id === updateId) : null;
  const id = existingProject?.id || newId();
  setRuntime('', 'Reading ZIP archive…', file.name);
  const buffer = await file.arrayBuffer();
  const entries = await parseZip(buffer, (done,total,name) => setRuntime('', 'Extracting ZIP archive…', `${done} of ${total}: ${name}`));
  const records = await materializeZipEntries(entries,id);
  const entryPath = await chooseEntry(records.map((r) => r.path));
  if (!entryPath) return;
  await finalizeImport({ records, entryPath, sourceName:file.name, kind:'zip', existingProject });
}

async function reloadProjects() {
  state.projects = (await idbGetAll(PROJECT_STORE)).sort((a,b) => (a.homeOrder || a.importedAt) - (b.homeOrder || b.importedAt));
  renderProjects(); renderHome(); updateStorageSummary();
}

function projectSubtitle(project) { return `${project.fileCount.toLocaleString()} ${project.fileCount === 1 ? 'file' : 'files'} · ${formatBytes(project.totalBytes)} · ${project.entryPath}`; }
function fallbackGradient(project) { let hash=0;for(const c of project.name)hash=((hash<<5)-hash+c.charCodeAt(0))|0;const hue=Math.abs(hash)%360;return `linear-gradient(145deg,hsl(${hue} 28% 42%),hsl(${(hue+28)%360} 28% 18%))`; }
function initials(name) { return name.split(/\s+/).filter(Boolean).slice(0,2).map((part) => part[0]).join('').toUpperCase() || '<>'; }

async function setProjectIcon(container, project) {
  container.replaceChildren(); container.style.background = fallbackGradient(project);
  const custom = await idbGet(ASSET_STORE,`icon:${project.id}`).catch(() => null);
  let src = null;
  if (custom?.bytes) src = objectURLFor(`icon:${project.id}`, custom.bytes, custom.type || 'image/png');
  else if (project.iconPath) src = virtualURL(project.id,project.iconPath);
  if (src) {
    const img = document.createElement('img'); img.alt = ''; img.src = src;
    img.addEventListener('error', () => { img.remove(); const fallback=document.createElement('span');fallback.className='icon-fallback';fallback.textContent=initials(project.name);container.append(fallback); }, { once:true });
    container.append(img);
  } else { const fallback=document.createElement('span');fallback.className='icon-fallback';fallback.textContent=initials(project.name);container.append(fallback); }
}

function objectURLFor(key, bytes, type) { if(state.objectURLs.has(key))return state.objectURLs.get(key);const url=URL.createObjectURL(new Blob([bytes],{type}));state.objectURLs.set(key,url);return url; }

function renderProjects() {
  const query=els.projectSearch.value.trim().toLowerCase();
  const projects=state.projects.filter((p)=>!query||`${p.name} ${p.sourceName} ${p.entryPath}`.toLowerCase().includes(query));
  els.projectGrid.replaceChildren();els.projectCount.textContent=state.projects.length;els.emptyLibrary.classList.toggle('hidden',state.projects.length>0);
  for(const project of projects){
    const card=document.createElement('article');card.className='project-card';card.dataset.id=project.id;
    const head=document.createElement('div');head.className='project-card-head';const icon=document.createElement('div');icon.className='app-icon';setProjectIcon(icon,project);
    const copy=document.createElement('div');copy.className='project-card-copy';const title=document.createElement('strong');title.textContent=project.name;const sub=document.createElement('small');sub.textContent=projectSubtitle(project);copy.append(title,sub);head.append(icon,copy);
    const meta=document.createElement('div');meta.className='project-meta';for(const label of [project.kind.toUpperCase(),project.trust==='isolated'?'ISOLATED':'TRUSTED',project.compatibility?'COMPAT':'RAW',project.debug?'DEBUG':null].filter(Boolean)){const chip=document.createElement('span');chip.className='meta-chip';chip.textContent=label;meta.append(chip);}
    const actions=document.createElement('div');actions.className='project-actions';const open=document.createElement('button');open.className='primary-mini';open.textContent='Open';open.addEventListener('click',()=>openProject(project.id));const edit=document.createElement('button');edit.textContent='Settings';edit.addEventListener('click',()=>openProjectDialog(project.id));actions.append(open,edit);card.append(head,meta,actions);els.projectGrid.append(card);
  }
}

function renderHome() {
  applyWallpaper();renderWidgets();els.homeAppGrid.replaceChildren();els.homeDock.replaceChildren();
  const docked=state.projects.filter((p)=>p.dock).slice(0,4);const normal=state.projects.filter((p)=>!docked.some((d)=>d.id===p.id));
  for(const project of normal)els.homeAppGrid.append(createHomeApp(project));els.homeAppGrid.prepend(createRunnerApp());for(const project of docked)els.homeDock.append(createHomeApp(project,true));
  els.homeDock.style.opacity=docked.length?'1':'.45';els.homeEditDone.classList.toggle('hidden',!state.homeEditMode);
}

function createRunnerApp() {
  const item=document.createElement('div');item.className=`home-app${state.settings.iconLabels?'':' no-label'}`;const icon=document.createElement('div');icon.className='home-app-icon';icon.style.background='linear-gradient(145deg,#f4f5f7,#aeb3bc)';icon.style.color='#111';icon.innerHTML='<span class="icon-fallback">&lt;/&gt;</span>';const label=document.createElement('span');label.className='home-app-label';label.textContent='Pro Runner';item.append(icon,label);item.addEventListener('click',()=>showWorkspace());return item;
}

function createHomeApp(project,dock=false) {
  const item=document.createElement('div');item.className=`home-app${state.settings.iconLabels?'':' no-label'}${state.homeEditMode?' wiggle':''}`;item.dataset.id=project.id;const icon=document.createElement('div');icon.className='home-app-icon';setProjectIcon(icon,project);const label=document.createElement('span');label.className='home-app-label';label.textContent=project.name;item.append(icon,label);
  if(state.homeEditMode){const badge=document.createElement('button');badge.className='app-delete-badge';badge.type='button';badge.textContent='−';badge.addEventListener('click',(event)=>{event.stopPropagation();deleteProject(project.id);});item.append(badge);}
  let longPress=false;const start=()=>{longPress=false;clearTimeout(state.longPressTimer);state.longPressTimer=setTimeout(()=>{longPress=true;enterHomeEditMode();},520);};const cancel=()=>clearTimeout(state.longPressTimer);item.addEventListener('pointerdown',start);item.addEventListener('pointerup',cancel);item.addEventListener('pointercancel',cancel);item.addEventListener('pointermove',cancel);item.addEventListener('click',()=>{if(longPress)return;if(state.homeEditMode)openProjectDialog(project.id);else openProject(project.id);});return item;
}
function enterHomeEditMode(){if(state.homeEditMode)return;state.homeEditMode=true;renderHome();}function exitHomeEditMode(){state.homeEditMode=false;renderHome();}

function renderWidgets(){
  els.widgetArea.replaceChildren();if(state.settings.clockWidget){const widget=document.createElement('div');widget.className='home-widget clock-widget';widget.innerHTML='<div class="clock-time" id="widgetClock">--:--</div><div class="clock-date" id="widgetDate">—</div>';els.widgetArea.append(widget);}if(state.settings.calendarWidget){const widget=document.createElement('div');widget.className='home-widget calendar-widget';widget.innerHTML='<div class="calendar-head"><strong id="calendarMonth">—</strong><span id="calendarToday">—</span></div><div class="mini-month" id="miniMonth"></div>';els.widgetArea.append(widget);}updateClockAndCalendar();
}

function updateClockAndCalendar(){
  const now=new Date();const time=now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false});els.statusTime.textContent=time;const clock=$('#widgetClock');if(clock)clock.textContent=time;const date=$('#widgetDate');if(date)date.textContent=now.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'});const month=$('#calendarMonth'),today=$('#calendarToday'),grid=$('#miniMonth');if(month&&today&&grid){month.textContent=now.toLocaleDateString([],{month:'long'});today.textContent=String(now.getDate());grid.replaceChildren();const first=new Date(now.getFullYear(),now.getMonth(),1);const days=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();const offset=(first.getDay()+6)%7;for(let i=0;i<offset;i++){const s=document.createElement('span');s.className='blank';grid.append(s);}for(let day=1;day<=days;day++){const s=document.createElement('span');s.textContent=day;if(day===now.getDate())s.className='today';grid.append(s);}}
}

function applyWallpaper(){const preset=WALLPAPERS.find((item)=>item.id===state.settings.wallpaper)||WALLPAPERS[0];els.wallpaper.style.backgroundImage=preset.css;document.documentElement.style.setProperty('--wallpaper-dim',String((state.settings.wallpaperDim||0)/100));idbGet(ASSET_STORE,'wallpaper').then((asset)=>{if(state.settings.wallpaper==='custom'&&asset?.bytes)els.wallpaper.style.backgroundImage=`url("${objectURLFor('wallpaper',asset.bytes,asset.type||'image/jpeg')}")`;}).catch(()=>{});}
function showHome(){els.workspace.classList.add('hidden');els.homeScreen.classList.remove('hidden');exitViewer();renderHome();}function showWorkspace(){els.homeScreen.classList.add('hidden');els.workspace.classList.remove('hidden');exitViewer();exitHomeEditMode();}

async function openProject(projectId){const project=state.projects.find((p)=>p.id===projectId);if(!project||!state.swReady)return;state.currentProjectId=projectId;els.viewerProjectName.textContent=project.name;els.viewerProjectPath.textContent=project.entryPath;if(project.trust==='isolated')els.projectFrame.setAttribute('sandbox','allow-scripts allow-forms allow-modals allow-popups allow-downloads allow-pointer-lock allow-presentation');else els.projectFrame.removeAttribute('sandbox');els.projectFrame.src=virtualURL(project.id,project.entryPath);els.workspace.classList.add('hidden');els.homeScreen.classList.add('hidden');els.viewer.classList.remove('hidden');closeViewerMenu();}
function exitViewer(){if(!els.viewer.classList.contains('hidden')){els.projectFrame.src='about:blank';els.viewer.classList.add('hidden');state.currentProjectId=null;closeViewerMenu();}}function closeViewerMenu(){els.viewerMenu.classList.add('hidden');els.viewerControl.classList.remove('menu-open');}function toggleViewerMenu(){const open=els.viewerMenu.classList.toggle('hidden')===false;els.viewerControl.classList.toggle('menu-open',open);}

function openDiagnostics(){renderConsoleLog();renderNetworkLog();renderPerformance();els.diagnosticsDialog.showModal();}
function addConsoleLog(entry){state.consoleLogs.unshift(entry);if(state.consoleLogs.length>MAX_LOGS)state.consoleLogs.length=MAX_LOGS;if(els.diagnosticsDialog.open&&els.consolePanel.classList.contains('active'))renderConsoleLog();}
function renderConsoleLog(){els.consoleLog.replaceChildren();for(const entry of state.consoleLogs){const row=document.createElement('div');row.className='log-row';row.innerHTML=`<span class="log-time">${new Date(entry.time).toLocaleTimeString()}</span><span class="log-level ${escapeHTML(entry.level)}">${escapeHTML(entry.level)}</span><span class="log-message">${escapeHTML(entry.message)}</span>`;els.consoleLog.append(row);}}
function renderNetworkLog(){els.networkLog.replaceChildren();for(const entry of state.networkLogs){const row=document.createElement('div');row.className='network-row';const ok=entry.status<400;row.innerHTML=`<span class="network-time">${new Date(entry.time).toLocaleTimeString()}</span><span>${escapeHTML(entry.method)}</span><span class="network-url">${escapeHTML(entry.path||entry.url)}</span><span class="network-status ${ok?'ok':'bad'}">${entry.status}</span><span>${Number(entry.duration||0).toFixed(1)} ms</span>`;els.networkLog.append(row);}}
function renderPerformance(){const p=state.perf;els.diagFps.textContent=p?`${p.fps.toFixed(1)} FPS`:'—';els.diagMedian.textContent=p?`${p.median.toFixed(1)} ms`:'—';els.diagP95.textContent=p?`${p.p95.toFixed(1)} ms`:'—';els.diagLongFrames.textContent=p?String(p.longFrames):'—';if(p){els.perfFps.textContent=`${p.fps.toFixed(0)} FPS`;els.perfFrame.textContent=`p95 ${p.p95.toFixed(1)} ms`;}}
function onBridgeMessage(event){const data=event.data;if(data?.channel!=='PRO_RUNNER_BRIDGE')return;if(data.type==='console')addConsoleLog({time:data.time||Date.now(),projectId:data.projectId,level:data.payload?.level||'log',message:data.payload?.message||''});if(data.type==='performance'){state.perf=data.payload;renderPerformance();}}

async function openProjectDialog(projectId){const project=state.projects.find((p)=>p.id===projectId);if(!project)return;state.editingProjectId=projectId;els.projectDialogTitle.textContent=project.name;els.projectNameInput.value=project.name;els.projectTrustSelect.value=project.trust||'trusted';els.projectSpaSelect.value=String(Boolean(project.spaFallback));els.projectCompatToggle.checked=Boolean(project.compatibility);els.projectDebugToggle.checked=Boolean(project.debug);els.projectDockToggle.checked=Boolean(project.dock);await setProjectIcon(els.projectIconPreview,project);els.projectDialog.showModal();}

async function saveProjectSettings(){const project=state.projects.find((p)=>p.id===state.editingProjectId);if(!project)return;const wantsDock=els.projectDockToggle.checked;const otherDocked=state.projects.filter((p)=>p.id!==project.id&&p.dock).length;if(wantsDock&&otherDocked>=4){toast('The dock can contain up to four projects.');return;}const name=els.projectNameInput.value.trim()||project.name;Object.assign(project,{name,customName:name!==project.name||project.customName,trust:els.projectTrustSelect.value,spaFallback:els.projectSpaSelect.value==='true',compatibility:els.projectCompatToggle.checked,debug:els.projectDebugToggle.checked,dock:wantsDock,updatedAt:Date.now()});await idbPut(PROJECT_STORE,project);els.projectDialog.close();await reloadProjects();toast('Project settings saved.');}
async function deleteProject(projectId=state.editingProjectId){const project=state.projects.find((p)=>p.id===projectId);if(!project)return;if(!confirm(`Delete the local copy of “${project.name}”?\n\nOriginal source files are not changed.`))return;await deleteProjectData(projectId);if(els.projectDialog.open)els.projectDialog.close();if(state.currentProjectId===projectId)showWorkspace();await reloadProjects();toast('Local project removed.');}
function beginUpdateProject(){const project=state.projects.find((p)=>p.id===state.editingProjectId);if(!project)return;state.pendingUpdateId=project.id;state.pendingUpdateKind=project.kind;els.projectDialog.close();if(project.kind==='folder')els.folderPicker.click();else if(project.kind==='zip')els.zipPicker.click();else els.filePicker.click();}
async function chooseCustomIcon(){if(!state.editingProjectId)return;els.iconPicker.click();}
async function applyCustomIcon(file){if(!file||!state.editingProjectId)return;const bytes=await file.arrayBuffer();await idbPut(ASSET_STORE,{key:`icon:${state.editingProjectId}`,bytes,type:file.type||'image/png'});const project=state.projects.find((p)=>p.id===state.editingProjectId);if(project)await setProjectIcon(els.projectIconPreview,project);renderProjects();renderHome();toast('Custom icon saved locally.');}
async function clearCustomIcon(){if(!state.editingProjectId)return;await idbDelete(ASSET_STORE,`icon:${state.editingProjectId}`);const project=state.projects.find((p)=>p.id===state.editingProjectId);if(project)await setProjectIcon(els.projectIconPreview,project);renderProjects();renderHome();}

function renderWallpaperPresets(){els.wallpaperPresets.replaceChildren();for(const item of WALLPAPERS){const b=document.createElement('button');b.type='button';b.className=`wallpaper-swatch${state.settings.wallpaper===item.id?' active':''}`;b.title=item.label;b.style.background=item.css;b.addEventListener('click',()=>{state.settings.wallpaper=item.id;saveSettings();renderWallpaperPresets();applyWallpaper();});els.wallpaperPresets.append(b);}}
function syncSettingsUI(){els.startViewSelect.value=state.settings.startView;els.iconLabelsToggle.checked=state.settings.iconLabels;els.wallpaperDimRange.value=state.settings.wallpaperDim;els.clockWidgetToggle.checked=state.settings.clockWidget;els.calendarWidgetToggle.checked=state.settings.calendarWidget;els.defaultCompatToggle.checked=state.settings.defaultCompat;els.defaultDebugToggle.checked=state.settings.defaultDebug;renderWallpaperPresets();}
async function openSettings(){syncSettingsUI();await updateStorageSummary();els.settingsDialog.showModal();}
async function updateStorageSummary(){let text=`${state.projects.length} ${state.projects.length===1?'project':'projects'} · ${formatBytes(state.projects.reduce((s,p)=>s+p.totalBytes,0))} imported content.`;try{if(navigator.storage?.estimate){const {usage,quota}=await navigator.storage.estimate();text+=` Browser origin: ${formatBytes(usage)} used of approximately ${formatBytes(quota)}.`;}}catch{}els.storageSummary.textContent=text;}

function renderCapabilities(){const caps=[['Service worker','serviceWorker' in navigator],['IndexedDB','indexedDB' in window],['Folder import','webkitdirectory' in els.folderPicker],['ZIP / DEFLATE','DecompressionStream' in window],['WebCrypto',Boolean(crypto.subtle)],['OPFS',Boolean(navigator.storage?.getDirectory)],['Wake Lock','wakeLock' in navigator],['Native file handles','showOpenFilePicker' in window]];els.capabilityGrid.replaceChildren();for(const [name,supported] of caps){const item=document.createElement('div');item.className='capability';item.innerHTML=`<span>${escapeHTML(name)}</span><strong class="${supported?'yes':'partial'}">${supported?'Available':'Unavailable'}</strong>`;els.capabilityGrid.append(item);}}
function setDiagnosticTab(name){$$('.diag-tabs button').forEach((b)=>b.classList.toggle('active',b.dataset.tab===name));for(const panel of [els.consolePanel,els.networkPanel,els.performancePanel])panel.classList.remove('active');$(`#${name}Panel`)?.classList.add('active');if(name==='console')renderConsoleLog();if(name==='network')renderNetworkLog();if(name==='performance')renderPerformance();}

function wireEvents(){
  els.workspaceViewButton.addEventListener('click',showWorkspace);els.homeViewButton.addEventListener('click',showHome);els.settingsButton.addEventListener('click',openSettings);els.homeEditDone.addEventListener('click',exitHomeEditMode);
  els.importFileButton.addEventListener('click',()=>els.filePicker.click());els.importFolderButton.addEventListener('click',()=>els.folderPicker.click());els.importZipButton.addEventListener('click',()=>els.zipPicker.click());
  els.filePicker.addEventListener('change',async()=>{const file=els.filePicker.files?.[0];const update=state.pendingUpdateId;state.pendingUpdateId=null;try{await importSingleFile(file,update);}catch(e){handleError(e);}finally{els.filePicker.value='';}});
  els.folderPicker.addEventListener('change',async()=>{const files=els.folderPicker.files;const update=state.pendingUpdateId;state.pendingUpdateId=null;try{await importFolder(files,update);}catch(e){handleError(e);}finally{els.folderPicker.value='';}});
  els.zipPicker.addEventListener('change',async()=>{const file=els.zipPicker.files?.[0];const update=state.pendingUpdateId;state.pendingUpdateId=null;try{await importZip(file,update);}catch(e){handleError(e);}finally{els.zipPicker.value='';}});
  els.projectSearch.addEventListener('input',renderProjects);els.activityButton.addEventListener('click',openDiagnostics);
  els.viewerControl.addEventListener('click',toggleViewerMenu);els.viewerReload.addEventListener('click',()=>{const p=state.projects.find((x)=>x.id===state.currentProjectId);if(p)els.projectFrame.src=`${virtualURL(p.id,p.entryPath)}?reload=${Date.now()}`;closeViewerMenu();});els.viewerDebug.addEventListener('click',()=>{closeViewerMenu();openDiagnostics();});els.viewerHome.addEventListener('click',()=>{closeViewerMenu();showHome();});els.viewerWorkspace.addEventListener('click',()=>{closeViewerMenu();showWorkspace();});
  document.addEventListener('pointerdown',(e)=>{if(!els.viewerMenu.classList.contains('hidden')&&!els.viewerMenu.contains(e.target)&&e.target!==els.viewerControl)closeViewerMenu();});
  els.saveProjectButton.addEventListener('click',saveProjectSettings);els.deleteProjectButton.addEventListener('click',()=>deleteProject());els.updateProjectButton.addEventListener('click',beginUpdateProject);els.chooseIconButton.addEventListener('click',chooseCustomIcon);els.clearIconButton.addEventListener('click',clearCustomIcon);
  els.iconPicker.addEventListener('change',async()=>{try{await applyCustomIcon(els.iconPicker.files?.[0]);}catch(e){handleError(e);}finally{els.iconPicker.value='';}});
  els.customWallpaperButton.addEventListener('click',()=>els.wallpaperPicker.click());els.wallpaperPicker.addEventListener('change',async()=>{const file=els.wallpaperPicker.files?.[0];if(!file)return;try{const bytes=await file.arrayBuffer();await idbPut(ASSET_STORE,{key:'wallpaper',bytes,type:file.type||'image/jpeg'});if(state.objectURLs.has('wallpaper')){URL.revokeObjectURL(state.objectURLs.get('wallpaper'));state.objectURLs.delete('wallpaper');}state.settings.wallpaper='custom';saveSettings();applyWallpaper();renderWallpaperPresets();toast('Wallpaper stored locally.');}catch(e){handleError(e);}finally{els.wallpaperPicker.value='';}});
  els.startViewSelect.addEventListener('change',()=>{state.settings.startView=els.startViewSelect.value;saveSettings();});els.iconLabelsToggle.addEventListener('change',()=>{state.settings.iconLabels=els.iconLabelsToggle.checked;saveSettings();renderHome();});els.wallpaperDimRange.addEventListener('input',()=>{state.settings.wallpaperDim=Number(els.wallpaperDimRange.value);saveSettings();applyWallpaper();});els.clockWidgetToggle.addEventListener('change',()=>{state.settings.clockWidget=els.clockWidgetToggle.checked;saveSettings();renderWidgets();});els.calendarWidgetToggle.addEventListener('change',()=>{state.settings.calendarWidget=els.calendarWidgetToggle.checked;saveSettings();renderWidgets();});els.defaultCompatToggle.addEventListener('change',()=>{state.settings.defaultCompat=els.defaultCompatToggle.checked;saveSettings();});els.defaultDebugToggle.addEventListener('change',()=>{state.settings.defaultDebug=els.defaultDebugToggle.checked;saveSettings();});
  els.clearAllButton.addEventListener('click',async()=>{if(!confirm('Remove all locally imported projects, custom icons, wallpaper, and Pro Runner settings?'))return;try{await clearEverything();for(const url of state.objectURLs.values())URL.revokeObjectURL(url);state.objectURLs.clear();state.settings={...DEFAULT_SETTINGS};await reloadProjects();syncSettingsUI();applyWallpaper();toast('Local Pro Runner data cleared.');}catch(e){handleError(e);}});
  els.closeDiagnostics.addEventListener('click',()=>els.diagnosticsDialog.close());$$('.diag-tabs button').forEach((b)=>b.addEventListener('click',()=>setDiagnosticTab(b.dataset.tab)));els.clearConsole.addEventListener('click',()=>{state.consoleLogs=[];renderConsoleLog();});els.clearNetwork.addEventListener('click',()=>{state.networkLogs=[];renderNetworkLog();});
  window.addEventListener('message',onBridgeMessage);window.addEventListener('dragover',(e)=>e.preventDefault());window.addEventListener('drop',async(e)=>{e.preventDefault();const files=e.dataTransfer?.files;if(!files?.length)return;try{if(files.length===1&&/\.zip$/i.test(files[0].name))await importZip(files[0]);else if(files.length===1&&/\.x?html?$/i.test(files[0].name))await importSingleFile(files[0]);}catch(err){handleError(err);}});
}

function handleError(error){console.error(error);const message=error?.message||String(error)||'Unknown error';setRuntime('error','Runtime error',message);toast(message,4200);}

async function init(){
  els.versionLabel.textContent=`v${APP_VERSION}`;loadSettings();wireEvents();renderCapabilities();syncSettingsUI();setRuntime('','Starting runtime…','Preparing storage and service worker.');
  try{
    await openDB().then((db)=>db.close());await ensureServiceWorker();await reloadProjects();
    els.importFileButton.disabled=false;els.importZipButton.disabled=false;els.importFolderButton.disabled=!("webkitdirectory" in els.folderPicker);
    setRuntime('ready','Runtime ready',state.swReady?'Virtual project hosting is active.':'Local storage is ready.');
    if(state.settings.startView==='home')showHome();else showWorkspace();
  }catch(error){handleError(error);}
  updateClockAndCalendar();setInterval(updateClockAndCalendar,1000);
}

init();

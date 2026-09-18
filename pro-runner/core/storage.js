export const DB_NAME = 'pro-runner-v1';
export const DB_VERSION = 2;
export const STORES = Object.freeze({ projects: 'projects', files: 'files', meta: 'meta', assets: 'assets' });
export const META = Object.freeze({ settings: 'app-settings-v2', home: 'home-state-v3', migrated: 'architecture-migration-v2' });

const LEGACY_SETTINGS = 'pro-runner-settings';
const LEGACY_LAYOUT = 'pro-runner-home-layout-v2';
const LEGACY_RUNNER = 'pro-runner-runner-app-v15';

export const defaultSettings = Object.freeze({
  startView: 'workspace', iconLabels: true, wallpaper: 'graphite', wallpaperDim: 18,
  glassStyle: 'standard', glassIntensity: 50, frameStyle: 'standard',
  clockWidget: true, calendarWidget: true, defaultCompat: true, defaultDebug: false,
});

export const defaultHomeState = () => ({ version: 3, positions: {}, dock: [], dockSlots: [null, null, null, null] });

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Storage request failed.'));
  });
}

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.projects)) db.createObjectStore(STORES.projects, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.files)) {
        const files = db.createObjectStore(STORES.files, { keyPath: 'key' });
        files.createIndex('byProject', 'projectId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.meta)) db.createObjectStore(STORES.meta, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(STORES.assets)) db.createObjectStore(STORES.assets, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open local storage.'));
    request.onblocked = () => reject(new Error('Local storage is blocked by another open app instance.'));
  });
}

export async function read(store, key) {
  const db = await openDatabase();
  try { return await requestValue(db.transaction(store, 'readonly').objectStore(store).get(key)) || null; }
  finally { db.close(); }
}

export async function readAll(store) {
  const db = await openDatabase();
  try { return await requestValue(db.transaction(store, 'readonly').objectStore(store).getAll()) || []; }
  finally { db.close(); }
}

export async function write(store, value) {
  const db = await openDatabase();
  try {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    await transactionDone(tx);
  } finally { db.close(); }
}

export async function remove(store, key) {
  const db = await openDatabase();
  try { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key); await transactionDone(tx); }
  finally { db.close(); }
}

export function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Storage transaction failed.'));
    tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted.'));
  });
}

export function normalizeProject(project) {
  const website = project?.type === 'website' || project?.kind === 'web' || Boolean(project?.externalUrl);
  if (website) {
    return { ...project, type: 'website', kind: 'web', externalUrl: String(project.externalUrl || project.sourceName || ''), fileCount: 0, totalBytes: 0 };
  }
  return { ...project, type: 'local', kind: project?.kind || 'file' };
}

function legacyJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch { return fallback; }
}

function normalizeHome(legacyLayout, legacyRunner, projects) {
  const positions = legacyLayout?.positions && typeof legacyLayout.positions === 'object' ? legacyLayout.positions : {};
  const docked = projects.filter((project) => project.dock).sort((a, b) => (a.dockOrder ?? a.homeOrder ?? 0) - (b.dockOrder ?? b.homeOrder ?? 0)).map((project) => `project:${project.id}`);
  if (legacyRunner?.dock) docked.push('runner');
  return { version: 3, positions, dock: docked.slice(0, 4) };
}

export async function migrateLegacyData() {
  const marker = await read(STORES.meta, META.migrated);
  if (marker?.value === true) return;
  const db = await openDatabase();
  try {
    const tx = db.transaction([STORES.projects, STORES.meta], 'readwrite');
    const projects = await requestValue(tx.objectStore(STORES.projects).getAll()) || [];
    const normalized = projects.map(normalizeProject);
    for (const project of normalized) tx.objectStore(STORES.projects).put(project);
    const meta = tx.objectStore(STORES.meta);
    const existingSettings = await requestValue(meta.get(META.settings));
    const existingHome = await requestValue(meta.get(META.home));
    if (!existingSettings) meta.put({ key: META.settings, value: { ...defaultSettings, ...legacyJSON(LEGACY_SETTINGS, {}) } });
    if (!existingHome) meta.put({ key: META.home, value: normalizeHome(legacyJSON(LEGACY_LAYOUT, {}), legacyJSON(LEGACY_RUNNER, {}), normalized) });
    meta.put({ key: META.migrated, value: true, migratedAt: Date.now() });
    await transactionDone(tx);
  } finally { db.close(); }
}

export async function loadSettings() { return { ...defaultSettings, ...((await read(STORES.meta, META.settings))?.value || {}) }; }
export async function saveSettings(value) { await write(STORES.meta, { key: META.settings, value: { ...defaultSettings, ...value } }); }
function normalizeHomeState(value = {}) {
  const state = { ...defaultHomeState(), ...value };
  state.dockSlots = Array.isArray(value.dockSlots) ? value.dockSlots.slice(0, 4).map((key) => key || null) : [...state.dock.slice(0, 4), null, null, null, null].slice(0, 4);
  state.dock = state.dockSlots.filter(Boolean);
  return state;
}

export async function loadHomeState() { return normalizeHomeState((await read(STORES.meta, META.home))?.value || {}); }
export async function saveHomeState(value) { await write(STORES.meta, { key: META.home, value: normalizeHomeState(value) }); }

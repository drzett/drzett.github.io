import { read, readAll, remove, STORES, transactionDone, openDatabase, write, normalizeProject } from './storage.js';

export const VIRTUAL_PREFIX = '__site/';
export const projectKey = (id) => `project:${id}`;
export const projectURL = (id, path = '') => `${new URL('./', location.href).pathname}${VIRTUAL_PREFIX}${encodeURIComponent(id)}/${path.split('/').map(encodeURIComponent).join('/')}`;
export const newId = () => crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function normalizeURL(raw) {
  let value = String(raw || '').trim();
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http and https URLs are supported.');
  return url.href;
}

export function websiteIconCandidates(pageURL) {
  const url = new URL(pageURL);
  const direct = ['/apple-touch-icon.png', '/apple-touch-icon-precomposed.png', '/apple-touch-icon-180x180.png', '/apple-touch-icon-152x152.png', '/android-chrome-512x512.png', '/android-chrome-256x256.png', '/android-chrome-192x192.png', '/logo-512x512.png', '/logo-256x256.png', '/logo-180x180.png', '/icon-512.png', '/icon-256.png', '/icon-192.png', '/icon-180.png', '/icons/icon-512.png', '/icons/icon-256.png', '/icons/icon-192.png', '/favicon-512x512.png', '/favicon-256x256.png', '/favicon-192x192.png', '/favicon-128x128.png', '/favicon-96x96.png', '/favicon-64x64.png', '/favicon-48x48.png', '/favicon-32x32.png', '/favicon-16x16.png', '/favicon.svg', '/favicon.png', '/favicon.ico'].map((path) => new URL(path, url.origin).href);
  const domain = encodeURIComponent(url.hostname);
  const page = encodeURIComponent(url.href);
  return [...direct, `https://www.google.com/s2/favicons?domain_url=${page}&sz=256`, `https://www.google.com/s2/favicons?domain=${domain}&sz=128`, `https://icons.duckduckgo.com/ip3/${domain}.ico`];
}

function probeImage(url, timeout = 1800) {
  return new Promise((resolve) => { const image = new Image(); const timer = setTimeout(() => finish(null), timeout); let settled = false; const finish = (result) => { if (settled) return; settled = true; clearTimeout(timer); image.onload = image.onerror = null; resolve(result); }; image.decoding = 'async'; image.referrerPolicy = 'no-referrer'; image.onload = () => finish({ url, area: image.naturalWidth * image.naturalHeight }); image.onerror = () => finish(null); image.src = url; });
}

export async function discoverWebsiteIcon(pageURL) {
  const icons = await Promise.all(websiteIconCandidates(pageURL).map((url) => probeImage(url)));
  return icons.filter(Boolean).sort((a, b) => b.area - a.area)[0]?.url || null;
}

async function cacheWebsiteIcon(project, remoteURL) {
  if (!remoteURL) return false;
  try {
    const response = await fetch(remoteURL, { mode: 'cors', credentials: 'omit', cache: 'no-cache', referrerPolicy: 'no-referrer' });
    if (!response.ok) return false;
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength) return false;
    const header = response.headers.get('content-type') || '';
    const type = /^image\//i.test(header) ? header : remoteURL.includes('.svg') ? 'image/svg+xml' : remoteURL.includes('.ico') ? 'image/x-icon' : 'image/png';
    await write(STORES.assets, { key: `icon:${project.id}`, bytes, type, source: 'website-auto-v3', remoteURL, updatedAt: Date.now() });
    return true;
  } catch { return false; }
}

export async function refreshWebsiteIcon(project) {
  if (project.type !== 'website') return project;
  await remove(STORES.assets, `icon:${project.id}`);
  const remoteIconUrl = await discoverWebsiteIcon(project.externalUrl).catch(() => null);
  const updated = { ...project, remoteIconUrl, updatedAt: Date.now() };
  await saveProject(updated);
  await cacheWebsiteIcon(updated, remoteIconUrl);
  return updated;
}

export async function listProjects() { return (await readAll(STORES.projects)).map(normalizeProject).sort((a, b) => (a.homeOrder || a.importedAt || a.createdAt || 0) - (b.homeOrder || b.importedAt || b.createdAt || 0)); }
export async function getProject(id) { const value = await read(STORES.projects, id); return value ? normalizeProject(value) : null; }
export async function saveProject(project) { await write(STORES.projects, normalizeProject({ ...project, updatedAt: Date.now() })); }

export async function deleteProject(id) {
  const db = await openDatabase();
  try {
    const tx = db.transaction([STORES.projects, STORES.files, STORES.assets], 'readwrite');
    tx.objectStore(STORES.projects).delete(id);
    tx.objectStore(STORES.assets).delete(`icon:${id}`);
    const cursor = tx.objectStore(STORES.files).index('byProject').openCursor(IDBKeyRange.only(id));
    cursor.onsuccess = () => { const row = cursor.result; if (row) { row.delete(); row.continue(); } };
    await transactionDone(tx);
  } finally { db.close(); }
}

export async function createWebsite({ name, url, homeOrder }) {
  const externalUrl = normalizeURL(url); const parsed = new URL(externalUrl);
  const remoteIconUrl = await discoverWebsiteIcon(externalUrl).catch(() => null);
  const project = { id: newId(), type: 'website', kind: 'web', name: name?.trim() || parsed.hostname.replace(/^www\./, ''), sourceName: externalUrl, externalUrl, remoteIconUrl, entryPath: parsed.hostname, fileCount: 0, totalBytes: 0, trust: 'external', compatibility: false, debug: false, spaFallback: false, createdAt: Date.now(), importedAt: Date.now(), homeOrder };
  await saveProject(project); await cacheWebsiteIcon(project, remoteIconUrl); return project;
}

export async function saveProjectFiles(project, files) {
  const db = await openDatabase();
  try {
    const tx = db.transaction([STORES.projects, STORES.files], 'readwrite');
    const fileStore = tx.objectStore(STORES.files);
    const index = fileStore.index('byProject');
    const cursor = index.openCursor(IDBKeyRange.only(project.id));
    cursor.onsuccess = () => { const row = cursor.result; if (row) { row.delete(); row.continue(); } };
    for (const file of files) fileStore.put({ ...file, key: `${project.id}:${file.path}`, projectId: project.id });
    tx.objectStore(STORES.projects).put(normalizeProject(project));
    await transactionDone(tx);
  } finally { db.close(); }
}

export function mimeFor(path, supplied = '') {
  if (supplied && supplied !== 'application/octet-stream') return supplied;
  const ext = path.toLowerCase().split('.').pop();
  return ({ html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', json: 'application/json; charset=utf-8', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', ico: 'image/x-icon', woff2: 'font/woff2', mp3: 'audio/mpeg', mp4: 'video/mp4', wasm: 'application/wasm' })[ext] || 'application/octet-stream';
}

export function sanitizePath(value) {
  const output = [];
  for (const part of String(value || '').replaceAll('\\', '/').replace(/^\/+/, '').split('/')) { if (!part || part === '.') continue; if (part === '..') throw new Error('Unsafe relative path.'); output.push(part); }
  return output.join('/');
}

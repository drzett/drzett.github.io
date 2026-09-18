const RELEASE = globalThis.PRO_RUNNER_RELEASE;
if (!RELEASE?.version || !RELEASE?.build) throw new Error('Pro Runner release metadata is unavailable.');
const RELEASE_ID = `${RELEASE.version}-${RELEASE.build}`;
const CACHE_PREFIX = 'pro-runner-app-shell-';
const CACHE_NAME = `${CACHE_PREFIX}${RELEASE_ID}`;
const DB_NAME = 'pro-runner-v1';
const DB_VERSION = 2;
const PROJECT_STORE = 'projects';
const FILE_STORE = 'files';
const META_STORE = 'meta';
const ASSET_STORE = 'assets';
const VIRTUAL_PREFIX = '__site/';

const SHELL_ASSETS = [
  './', './index.html', './release.js', './styles.css', './home-fidelity.css', './main.js', './bridge.js', './update-ui.js', './update-ui-core.js',
  './core/storage.js', './core/projects.js', './core/home-state.js', './ui/home.js', './ui/icons.js', './ui/icon-designer.js', './external-frame.html', './manifest.webmanifest', './zip.js', './icon-192.png', './icon-512.png', './apple-touch-icon.png',
];
const SHELL_PATHS = new Set(SHELL_ASSETS.map((asset) => new URL(asset, self.registration.scope).pathname));

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_ASSETS);
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(isManagedCache).filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
    broadcast({ type: 'PRO_RUNNER_SW_READY', version: RELEASE.version });
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION' && event.ports?.[0]) event.ports[0].postMessage({ ...RELEASE, releaseId:RELEASE_ID });
});

function isManagedCache(key) {
  return key.startsWith(CACHE_PREFIX) || key.startsWith('pro-runner-shell-') || key.startsWith('pro-runner-patch-');
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECT_STORE)) db.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        const store = db.createObjectStore(FILE_STORE, { keyPath: 'key' });
        store.createIndex('byProject', 'projectId', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(ASSET_STORE)) db.createObjectStore(ASSET_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open runtime storage.'));
  });
}

async function dbGet(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error('Storage read failed.'));
    tx.oncomplete = () => db.close();
    tx.onabort = () => db.close();
  });
}

function fileKey(projectId, path) { return `${projectId}:${path}`; }

function normalizePath(path) {
  const output = [];
  for (const raw of String(path || '').replaceAll('\\', '/').split('/')) {
    const part = raw.trim();
    if (!part || part === '.') continue;
    if (part === '..') { if (output.length) output.pop(); continue; }
    output.push(part);
  }
  return output.join('/');
}

function mimeFromPath(path) {
  const ext = path.toLowerCase().split('.').pop();
  const map = {
    html:'text/html; charset=utf-8', htm:'text/html; charset=utf-8', xhtml:'application/xhtml+xml',
    css:'text/css; charset=utf-8', js:'text/javascript; charset=utf-8', mjs:'text/javascript; charset=utf-8', cjs:'text/javascript; charset=utf-8',
    json:'application/json; charset=utf-8', webmanifest:'application/manifest+json; charset=utf-8', map:'application/json; charset=utf-8',
    txt:'text/plain; charset=utf-8', md:'text/markdown; charset=utf-8', csv:'text/csv; charset=utf-8', xml:'application/xml',
    svg:'image/svg+xml', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp', avif:'image/avif', ico:'image/x-icon', heic:'image/heic',
    woff:'font/woff', woff2:'font/woff2', ttf:'font/ttf', otf:'font/otf',
    mp3:'audio/mpeg', m4a:'audio/mp4', wav:'audio/wav', ogg:'audio/ogg', flac:'audio/flac', aac:'audio/aac',
    mp4:'video/mp4', webm:'video/webm', mov:'video/quicktime', m4v:'video/x-m4v',
    wasm:'application/wasm', pdf:'application/pdf', webbundle:'application/webbundle',
  };
  return map[ext] || 'application/octet-stream';
}

function recordBody(record) {
  if (record?.bytes instanceof ArrayBuffer) return record.bytes;
  if (ArrayBuffer.isView(record?.bytes)) return record.bytes;
  if (record?.blob) return record.blob;
  return null;
}
function recordSize(record) {
  if (record?.bytes instanceof ArrayBuffer) return record.bytes.byteLength;
  if (ArrayBuffer.isView(record?.bytes)) return record.bytes.byteLength;
  if (typeof record?.blob?.size === 'number') return record.blob.size;
  return Number(record?.size) || 0;
}
function sliceRecord(record, start, endExclusive) {
  if (record?.bytes instanceof ArrayBuffer) return record.bytes.slice(start, endExclusive);
  if (ArrayBuffer.isView(record?.bytes)) return record.bytes.buffer.slice(record.bytes.byteOffset + start, record.bytes.byteOffset + endExclusive);
  if (record?.blob?.slice) return record.blob.slice(start, endExclusive);
  return null;
}

function baseHeaders(record, path, project) {
  const headers = new Headers({
    'Content-Type': record.type || mimeFromPath(path),
    'Cache-Control': 'no-store',
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
    'X-Pro-Runner': '1',
    'Access-Control-Allow-Origin': '*',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  if (record.hash) headers.set('ETag', `"${record.hash}"`);
  if (record.lastModified) headers.set('Last-Modified', new Date(record.lastModified).toUTCString());
  if (project?.id) headers.set('X-Pro-Runner-Project', project.id);
  return headers;
}

function matchConditional(request, record) {
  const tag = request.headers.get('If-None-Match');
  if (tag && record.hash && tag.replace(/^W\//, '') === `"${record.hash}"`) return true;
  const modified = request.headers.get('If-Modified-Since');
  if (modified && record.lastModified) {
    const since = Date.parse(modified);
    if (Number.isFinite(since) && Math.floor(record.lastModified / 1000) <= Math.floor(since / 1000)) return true;
  }
  return false;
}

function rangeResponse(request, record, path, project) {
  const range = request.headers.get('Range');
  if (!range) return null;
  const size = recordSize(record);
  if (!size) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
  if (!match) return null;
  let start, end;
  if (!match[1] && match[2]) {
    const suffix = Number(match[2]);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(match[1]); end = !match[2] ? size - 1 : Number(match[2]);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= size || end < start) {
    return new Response(null, { status:416, headers:{'Content-Range':`bytes */${size}`} });
  }
  end = Math.min(end, size - 1);
  const chunk = sliceRecord(record, start, end + 1);
  if (chunk == null) return null;
  const headers = baseHeaders(record, path, project);
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(request.method === 'HEAD' ? null : chunk, { status:206, headers });
}

function projectBase(projectId) {
  const scopePath = new URL(self.registration.scope).pathname;
  return `${scopePath}${VIRTUAL_PREFIX}${encodeURIComponent(projectId)}/`;
}

function transformHTML(text, project) {
  const base = projectBase(project.id);
  let out = text;
  if (project.compatibility) {
    out = out.replace(/\b(src|href|action|poster|data)\s*=\s*(["'])\/(?!\/)([^"']*)\2/gi,
      (_, attr, quote, value) => `${attr}=${quote}${base}${value}${quote}`);
    out = out.replace(/\bsrcset\s*=\s*(["'])(.*?)\1/gi, (_, quote, value) => {
      const rewritten = value.split(',').map((candidate) => {
        const parts = candidate.trim().split(/\s+/);
        if (parts[0]?.startsWith('/') && !parts[0].startsWith('//')) parts[0] = `${base}${parts[0].replace(/^\/+/, '')}`;
        return parts.join(' ');
      }).join(', ');
      return `srcset=${quote}${rewritten}${quote}`;
    });
  }
  if (project.compatibility || project.debug) {
    const scriptTag = `<script src="${new URL('./bridge.js', self.registration.scope).href}" data-project="${escapeAttr(project.id)}" data-base="${escapeAttr(base)}" data-compat="${project.compatibility ? '1' : '0'}" data-debug="${project.debug ? '1' : '0'}"></script>`;
    if (/<head\b[^>]*>/i.test(out)) out = out.replace(/<head\b[^>]*>/i, (match) => `${match}${scriptTag}`);
    else if (/<html\b[^>]*>/i.test(out)) out = out.replace(/<html\b[^>]*>/i, (match) => `${match}<head>${scriptTag}</head>`);
    else out = `${scriptTag}${out}`;
  }
  return out;
}

function transformCSS(text, project) {
  if (!project.compatibility) return text;
  const base = projectBase(project.id);
  let out = text.replace(/url\(\s*(["']?)\/(?!\/)([^)"']+)\1\s*\)/gi, (_, quote, value) => `url(${quote}${base}${value}${quote})`);
  out = out.replace(/@import\s+(["'])\/(?!\/)([^"']+)\1/gi, (_, quote, value) => `@import ${quote}${base}${value}${quote}`);
  return out;
}

function transformJS(text, project) {
  if (!project.compatibility) return text;
  const base = projectBase(project.id);
  let out = text;
  out = out.replace(/(\bfrom\s*|\bimport\s*)(["'])\/(?!\/)([^"']+)\2/g, (_, prefix, quote, value) => `${prefix}${quote}${base}${value}${quote}`);
  out = out.replace(/(\bimport\s*\(\s*)(["'])\/(?!\/)([^"']+)\2/g, (_, prefix, quote, value) => `${prefix}${quote}${base}${value}${quote}`);
  return out;
}

function escapeAttr(value) {
  return String(value).replace(/[&"'<>]/g, (c) => ({'&':'&amp;','"':'&quot;',"'":'&#39;','<':'&lt;','>':'&gt;'}[c]));
}

async function resolveRecord(request, project, rawPath) {
  let path = normalizePath(rawPath);
  const requestedDirectory = String(rawPath || '').endsWith('/');
  if (!path) path = project.entryPath;
  let record = await dbGet(FILE_STORE, fileKey(project.id, path));
  if (record) return { record, path };
  if (requestedDirectory || (path && !/\.[^/]+$/.test(path))) {
    const indexPath = `${path.replace(/\/$/, '')}/index.html`;
    record = await dbGet(FILE_STORE, fileKey(project.id, indexPath));
    if (record) return { record, path:indexPath };
  }
  if ((request.mode === 'navigate' || request.destination === 'document') && project.spaFallback) {
    record = await dbGet(FILE_STORE, fileKey(project.id, project.entryPath));
    if (record) return { record, path:project.entryPath };
  }
  return null;
}

async function serveVirtual(request, projectId, rawPath) {
  const started = performance.now();
  const project = await dbGet(PROJECT_STORE, projectId);
  if (!project) return new Response('Pro Runner: project not found.', { status:404, headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Pro-Runner':'1'} });
  const resolved = await resolveRecord(request, project, rawPath);
  if (!resolved) {
    const path = normalizePath(rawPath);
    const response = new Response(`Pro Runner: file not found: ${path || '/'}`, { status:404, headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'} });
    logNetwork(projectId, request, response.status, 0, performance.now() - started, path);
    return response;
  }
  const { record, path } = resolved;
  if (matchConditional(request, record)) {
    const response = new Response(null, { status:304, headers:baseHeaders(record, path, project) });
    logNetwork(projectId, request, 304, 0, performance.now() - started, path);
    return response;
  }
  const partial = rangeResponse(request, record, path, project);
  if (partial) {
    logNetwork(projectId, request, partial.status, Number(partial.headers.get('Content-Length')) || 0, performance.now() - started, path);
    return partial;
  }
  let body = recordBody(record);
  if (body == null) return new Response('Pro Runner: stored file data is unavailable.', { status:500 });
  const contentType = record.type || mimeFromPath(path);
  const lower = contentType.toLowerCase();
  let transformed = false;
  if (request.method !== 'HEAD' && (project.compatibility || project.debug) && (lower.includes('text/html') || lower.includes('application/xhtml'))) {
    const text = new TextDecoder().decode(body instanceof ArrayBuffer ? body : await new Response(body).arrayBuffer());
    body = transformHTML(text, project); transformed = true;
  } else if (request.method !== 'HEAD' && project.compatibility && lower.includes('text/css')) {
    const text = new TextDecoder().decode(body instanceof ArrayBuffer ? body : await new Response(body).arrayBuffer());
    body = transformCSS(text, project); transformed = true;
  } else if (request.method !== 'HEAD' && project.compatibility && (lower.includes('javascript') || /\.(m?js)$/i.test(path))) {
    const text = new TextDecoder().decode(body instanceof ArrayBuffer ? body : await new Response(body).arrayBuffer());
    body = transformJS(text, project); transformed = true;
  }
  const headers = baseHeaders(record, path, project);
  const finalSize = transformed ? new TextEncoder().encode(String(body)).byteLength : recordSize(record);
  headers.set('Content-Length', String(finalSize));
  if (transformed) { headers.delete('ETag'); headers.delete('Last-Modified'); }
  const response = new Response(request.method === 'HEAD' ? null : body, { status:200, headers });
  logNetwork(projectId, request, 200, finalSize, performance.now() - started, path);
  return response;
}

async function logNetwork(projectId, request, status, bytes, duration, path) {
  try {
    const url = new URL(request.url);
    await broadcast({ type:'PRO_RUNNER_NETWORK', projectId, entry:{ method:request.method, status, bytes, duration, path, url:url.pathname + url.search, time:Date.now() } });
  } catch {}
}

async function broadcast(message) {
  const clients = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
  for (const client of clients) client.postMessage(message);
}

async function networkVersionResponse(request) {
  try {
    const response = await fetch(request, { cache:'no-store' });
    if (!response.ok) return response;
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return new Response(response.body, { status:response.status, statusText:response.statusText, headers });
  } catch {
    return new Response(JSON.stringify({ error:'offline' }), { status:503, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'} });
  }
}

async function shellResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch:true });
  if (cached) return cached;
  try {
    return await fetch(request, { cache:'no-store' });
  } catch {
    return new Response('Offline and this resource is not available in the application cache.', { status:503, headers:{'Content-Type':'text/plain; charset=utf-8'} });
  }
}

self.addEventListener('fetch', (event) => {
  if (!['GET','HEAD'].includes(event.request.method)) return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const scopePath = new URL(self.registration.scope).pathname;
  const versionPath = new URL('./version.json', self.registration.scope).pathname;
  if (url.pathname === versionPath) {
    event.respondWith(networkVersionResponse(event.request));
    return;
  }
  const prefix = `${scopePath}${VIRTUAL_PREFIX}`;
  if (url.pathname.startsWith(prefix)) {
    const remainder = url.pathname.slice(prefix.length);
    const [rawProjectId, ...rawParts] = remainder.split('/');
    let projectId = rawProjectId;
    let rawPath = rawParts.join('/');
    try { projectId = decodeURIComponent(rawProjectId); rawPath = rawParts.map(decodeURIComponent).join('/'); } catch {}
    event.respondWith(serveVirtual(event.request, projectId, rawPath));
    return;
  }
  if (SHELL_PATHS.has(url.pathname)) event.respondWith(shellResponse(event.request));
});

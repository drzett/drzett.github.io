const SHELL_VERSION = '1.1.0';
const CACHE_NAME = `local-html-runner-shell-${SHELL_VERSION}`;
const DB_NAME = 'local-html-runner-v1';
const DB_VERSION = 1;
const FILE_STORE = 'files';
const META_STORE = 'meta';

const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('local-html-runner-shell-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    );

    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({ type: 'RUNNER_SW_READY', version: SHELL_VERSION });
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE, { keyPath: 'path' });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbGet(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result?.value ?? request.result ?? null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

function normalizePath(path) {
  const output = [];

  for (const raw of String(path || '').replaceAll('\\', '/').split('/')) {
    const part = raw.trim();
    if (!part || part === '.') continue;
    if (part === '..') {
      if (output.length) output.pop();
      continue;
    }
    output.push(part);
  }

  return output.join('/');
}

function mimeFromPath(path) {
  const ext = path.toLowerCase().split('.').pop();
  const map = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    xhtml: 'application/xhtml+xml',
    css: 'text/css; charset=utf-8',
    js: 'text/javascript; charset=utf-8',
    mjs: 'text/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    webmanifest: 'application/manifest+json; charset=utf-8',
    map: 'application/json; charset=utf-8',
    txt: 'text/plain; charset=utf-8',
    md: 'text/markdown; charset=utf-8',
    csv: 'text/csv; charset=utf-8',
    xml: 'application/xml',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    ico: 'image/x-icon',
    heic: 'image/heic',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    wasm: 'application/wasm',
    pdf: 'application/pdf',
  };

  return map[ext] || 'application/octet-stream';
}

function baseHeaders(record, path) {
  return new Headers({
    'Content-Type': record.type || mimeFromPath(path),
    'Cache-Control': 'no-store',
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
    'X-Local-HTML-Runner': '1',
  });
}

function rangeResponse(request, record, path) {
  const range = request.headers.get('Range');
  if (!range || !record.blob || typeof record.blob.slice !== 'function') return null;

  const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
  if (!match) return null;

  const size = record.blob.size;
  let start;
  let end;

  if (match[1] === '' && match[2] !== '') {
    const suffixLength = Number(match[2]);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Number(match[2]);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= size || end < start) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${size}` },
    });
  }

  end = Math.min(end, size - 1);
  const chunk = record.blob.slice(start, end + 1);
  const headers = baseHeaders(record, path);
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));

  return new Response(request.method === 'HEAD' ? null : chunk, {
    status: 206,
    headers,
  });
}

async function resolveVirtualRecord(request, rawVirtualPath) {
  const normalized = normalizePath(rawVirtualPath);
  const requestedDirectory = String(rawVirtualPath || '').endsWith('/');

  if (normalized) {
    const direct = await dbGet(FILE_STORE, normalized);
    if (direct) return { record: direct, path: normalized };
  }

  if (request.mode === 'navigate' || request.destination === 'document') {
    const project = await dbGet(META_STORE, 'project');

    if (!normalized && project?.entryPath) {
      const entry = await dbGet(FILE_STORE, project.entryPath);
      if (entry) return { record: entry, path: project.entryPath };
    }

    if (normalized && (requestedDirectory || !/\.[^/]+$/.test(normalized))) {
      const directoryIndexPath = `${normalized}/index.html`;
      const directoryIndex = await dbGet(FILE_STORE, directoryIndexPath);
      if (directoryIndex) return { record: directoryIndex, path: directoryIndexPath };
    }

    const settings = await dbGet(META_STORE, 'settings');
    if (settings?.spaFallback && project?.entryPath) {
      const fallback = await dbGet(FILE_STORE, project.entryPath);
      if (fallback) return { record: fallback, path: project.entryPath };
    }
  }

  return null;
}

async function serveVirtual(request, virtualPath) {
  const resolved = await resolveVirtualRecord(request, virtualPath);

  if (!resolved) {
    const path = normalizePath(virtualPath);
    return new Response(`Local HTML Runner: file not found: ${path || '/'}`, {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  const { record, path } = resolved;
  const partial = rangeResponse(request, record, path);
  if (partial) return partial;

  const headers = baseHeaders(record, path);
  headers.set('Content-Length', String(record.blob?.size ?? record.size ?? 0));

  return new Response(request.method === 'HEAD' ? null : record.blob, {
    status: 200,
    headers,
  });
}

async function shellResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });

  if (cached) {
    fetch(request)
      .then((response) => {
        if (response?.ok && request.method === 'GET') cache.put(request, response.clone());
      })
      .catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response?.ok && request.method === 'GET') cache.put(request, response.clone());
    return response;
  } catch {
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }

    return new Response('Offline and this resource is not available in the application cache.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

self.addEventListener('fetch', (event) => {
  if (!['GET', 'HEAD'].includes(event.request.method)) return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const scopePath = new URL(self.registration.scope).pathname;
  const virtualPrefix = `${scopePath}__local__/`;

  if (url.pathname.startsWith(virtualPrefix)) {
    const encoded = url.pathname.slice(virtualPrefix.length);
    let decoded;

    try {
      decoded = encoded.split('/').map(decodeURIComponent).join('/');
    } catch {
      decoded = encoded;
    }

    event.respondWith(serveVirtual(event.request, decoded));
    return;
  }

  event.respondWith(shellResponse(event.request));
});

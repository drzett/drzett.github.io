import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
let releaseOverride = null;
let deploymentMode = 'current';
const deployedWorker = new Map([
  ['/pro-runner/sw.js', execFileSync('git', ['show', '192ff1e:pro-runner/sw.js'], { cwd:root, encoding:'utf8' })],
  ['/pro-runner/sw-core-v140.js', execFileSync('git', ['show', '192ff1e:pro-runner/sw-core-v140.js'], { cwd:root, encoding:'utf8' })],
]);
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/__test__/release') {
      if (request.method === 'POST') {
        releaseOverride = { version: url.searchParams.get('version'), build: url.searchParams.get('build') };
        if (!releaseOverride.version || !releaseOverride.build) throw new Error('Invalid release override');
      } else if (request.method === 'DELETE') releaseOverride = null;
      else throw new Error('Unsupported release override method');
      response.writeHead(204).end();
      return;
    }
    if (pathname === '/__test__/deployment') {
      if (request.method !== 'POST') throw new Error('Unsupported deployment override method');
      deploymentMode = url.searchParams.get('mode') === 'legacy' ? 'legacy' : 'current';
      response.writeHead(204).end();
      return;
    }
    if (deploymentMode === 'legacy' && deployedWorker.has(pathname)) {
      const body = deployedWorker.get(pathname);
      response.writeHead(200, { 'Content-Type':'text/javascript; charset=utf-8', 'Content-Length':Buffer.byteLength(body), 'Cache-Control':'no-store' });
      response.end(body);
      return;
    }
    if (releaseOverride && pathname === '/pro-runner/release.js') {
      const body = `globalThis.PRO_RUNNER_RELEASE=Object.freeze(${JSON.stringify({ ...releaseOverride, channel:'stable', released:'2026-09-18' })});`;
      response.writeHead(200, { 'Content-Type':'text/javascript; charset=utf-8', 'Content-Length':Buffer.byteLength(body), 'Cache-Control':'no-store' });
      response.end(body);
      return;
    }
    if (releaseOverride && pathname === '/pro-runner/version.json') {
      const body = JSON.stringify({ ...releaseOverride, channel:'stable', released:'2026-09-18', summary:'Playwright update fixture' });
      response.writeHead(200, { 'Content-Type':'application/json; charset=utf-8', 'Content-Length':Buffer.byteLength(body), 'Cache-Control':'no-store' });
      response.end(body);
      return;
    }
    let file = resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(`${root}${sep}`)) throw new Error('Path outside root');
    let info = await stat(file);
    if (info.isDirectory()) {
      file = resolve(file, 'index.html');
      info = await stat(file);
    }
    response.writeHead(200, {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-store',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}).listen(4173, '127.0.0.1');

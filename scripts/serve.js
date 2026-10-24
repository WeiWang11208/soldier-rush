#!/usr/bin/env bun
/** 本地静态服务器（无依赖），用于开发与浏览器自测。 */

import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function safePath(pathname) {
  const decoded = decodeURIComponent(pathname.split('?')[0]);
  const normalized = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = join(root, normalized === '/' ? 'index.html' : normalized);
  return full.startsWith(root) ? full : join(root, 'index.html');
}

const server = Bun.serve({
  port,
  hostname: host,
  async fetch(request) {
    const url = new URL(request.url);
    let filePath = safePath(url.pathname);
    let file = Bun.file(filePath);
    if (!(await file.exists()) && !extname(filePath)) {
      filePath = join(root, 'index.html');
      file = Bun.file(filePath);
    }
    if (!(await file.exists())) {
      return new Response('Not found', { status: 404 });
    }
    return new Response(file, {
      headers: {
        'content-type': MIME[extname(filePath)] || 'application/octet-stream',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  },
});

console.log(`soldier-rush dev server: http://${host}:${server.port}/`);
console.log(`debug: http://${host}:${server.port}/?debug=1`);

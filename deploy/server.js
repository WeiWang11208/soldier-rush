// 生产静态服务器：只读发布目录，默认仅监听本机回环地址。
// Debian 上由 systemd 启动，personal-agent-server 通过反向 SSH 隧道访问。
import { extname, join, normalize, resolve, sep } from 'node:path';

const ROOT = resolve(process.env.ROOT || import.meta.dir);
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3472);

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
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

function cacheControl(pathname) {
  if (pathname === '/sw.js') return 'no-cache, no-store, must-revalidate';
  if (pathname === '/' || pathname === '/index.html') return 'no-cache';
  return 'public, max-age=600';
}

export function resolvePath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const suffix = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const full = normalize(join(ROOT, suffix));
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  if (full === join(ROOT, 'server.js')) return null; // 不对外暴露静态服务器自身源码
  return full;
}

export async function handle(req) {
  const url = new URL(req.url);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { ...SECURITY_HEADERS, Allow: 'GET, HEAD' },
    });
  }
  if (url.pathname === '/healthz') {
    return new Response('ok', {
      headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const path = resolvePath(url.pathname);
  const file = path ? Bun.file(path) : null;
  const stat = file && (await file.exists()) ? await file.stat() : null;
  if (!file || !stat || stat.isDirectory()) {
    return new Response('Not Found', {
      status: 404,
      headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const headers = {
    ...SECURITY_HEADERS,
    'Content-Type': MIME[extname(path)] || 'application/octet-stream',
    'Cache-Control': cacheControl(url.pathname),
  };
  if (req.method === 'HEAD') headers['Content-Length'] = String(stat.size);
  return new Response(req.method === 'HEAD' ? null : file, { headers });
}

if (import.meta.main) {
  Bun.serve({ hostname: HOST, port: PORT, fetch: handle });
  console.log(`soldier-rush listening on http://${HOST}:${PORT} (root ${ROOT})`);
}

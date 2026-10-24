/* 小兵冲冲冲 Service Worker：离线缓存 / 快速二次加载 */

const VERSION = 'soldier-rush-v1.0.0';
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icon.svg',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './js/main.js',
  './js/game.js',
  './js/renderer.js',
  './js/levels.js',
  './js/combat.js',
  './js/items.js',
  './js/save.js',
  './js/camera.js',
  './js/audio.js',
];

const CACHE_PREFIX = 'soldier-rush-';

// fetch() 会自动解压响应体，但 Cache API 会保留 content-encoding 头；离线原样返回时，
// 浏览器会把明文 CSS/JS 当成 gzip 再解一次。Cloudflare 已对本游戏关闭压缩，
// 预缓存只接受未压缩响应并保留原始 URL；若压缩回归则让安装失败，避免缓存坏资源。
function cacheable(response) {
  const encoding = response.headers.get('content-encoding');
  return !encoding || encoding === 'identity';
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      for (const url of PRECACHE) {
        const response = await fetch(url, { cache: 'reload' });
        if (!response.ok) throw new Error(`precache failed: ${url} ${response.status}`);
        if (!cacheable(response)) throw new Error(`precache not identity: ${url} ${response.headers.get('content-encoding')}`);
        await cache.put(url, response);
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && cacheable(response)) {
            caches.open(VERSION).then((cache) => cache.put('./index.html', response.clone())).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(VERSION);
          return (await cache.match('./index.html', { ignoreVary: true })) || (await cache.match('./', { ignoreVary: true })) || Response.error();
        }),
    );
    return;
  }

  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(request, { ignoreVary: true });
      const network = fetch(request)
        .then((response) => {
          if (response.ok && cacheable(response)) cache.put(request, response.clone()).catch(() => {});
          return response;
        })
        .catch(() => null);
      return cached || (await network) || Response.error();
    }),
  );
});

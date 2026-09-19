/* Service Worker — Ekstrak Laporan
   Strategi: cache dulu (cepat & bisa offline), lalu diperbarui di latar belakang.
   Ubah CACHE_VERSION jika Anda menambah/mengganti file di daftar CORE. */
const CACHE_VERSION = 'v4';
const CACHE = 'ekstrak-laporan-' + CACHE_VERSION;

const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './libs/xlsx.full.min.js',
  './libs/dexie.min.js'
];

// Library kini dimuat dari ./libs/ (lokal). CDN hanya cadangan, disimpan otomatis saat pernah dipakai.
const CDN = [];
const CDN_HOSTS = ['cdn.jsdelivr.net'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache:'reload' = ambil versi terbaru dari server, bukan dari cache HTTP browser
    await cache.addAll(CORE.map(u => new Request(u, { cache: 'reload' })));
    // CDN bersifat "best effort": kalau gagal, instalasi tetap lanjut
    await Promise.allSettled(CDN.map(async (u) => {
      const res = await fetch(u, { mode: 'cors' });
      if (res.ok) await cache.put(u, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k.startsWith('ekstrak-laporan-') && k !== CACHE).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

async function staleWhileRevalidate(request, cacheKey) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(cacheKey || request, { ignoreSearch: !!cacheKey });
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok && !res.redirected) cache.put(cacheKey || request, res.clone());
      return res;
    })
    .catch(() => null);
  if (cached) { network.catch(() => {}); return cached; }
  return (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isCdn = CDN_HOSTS.includes(url.hostname);
  if (!sameOrigin && !isCdn) return;

  // Buka halaman -> selalu layani index.html (bisa offline)
  if (req.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(req, './index.html'));
    return;
  }
  event.respondWith(staleWhileRevalidate(req));
});

const CACHE_NAME = 'hoshizaki-service-pwa-v1197-deep-scan-verified';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './hzk_enterprise_modules.js',
  './hzk_sales_crm_quotation_addon.js',
  './hzk_v1195_sales_mkt_omni_suite.js',
  './hzk_v1197_smart_bi_voice_studio.js',
  './sales_crm_master_db_y2026.json',
  './live_stock_snapshot_y2026.json',
  './parts_catalog.json',
  './serial_db.json',
  './quotation_archive.json',
  './penguin-tech-bg.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url || '';
  const cleanPath = url.split('?')[0];
  if (cleanPath.endsWith('.js') || cleanPath.endsWith('.json') || cleanPath.endsWith('.html') || event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

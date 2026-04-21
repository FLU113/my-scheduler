// ===== Service Worker: 오프라인 캐싱 & PWA 지원 =====
const CACHE_NAME = 'scheduler-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// ─── 설치: 핵심 파일 캐싱 ──────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ─── 활성화: 오래된 캐시 정리 ────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── 네트워크 요청 처리 ──────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase / 외부 API 요청은 캐시하지 않고 네트워크 우선
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('google') ||
      url.hostname.includes('gstatic')) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // 앱 자체 파일: 캐시 우선, 없으면 네트워크
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // GET 요청만 캐싱
        if (event.request.method !== 'GET') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // 오프라인이고 캐시도 없으면 index.html 반환
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// ─── 백그라운드 동기화 (지원 브라우저에서) ─────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-events') {
    console.log('[SW] 백그라운드 동기화 시작');
  }
});

// ─── 푸시 알림 (향후 확장용) ─────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || '스케줄러 알림', {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png'
  });
});

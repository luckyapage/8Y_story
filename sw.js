/**
 * sw.js：Service Worker（離線閱讀）
 * 放在網站根目錄，作用範圍才能涵蓋整個 App。
 *
 * 快取策略：
 *   - 安裝時預先下載 App 外殼與全部故事（文字與插圖），之後沒有網路也能閱讀。
 *   - 故事資料（data/）：先用快取立即顯示，同時背景更新（stale-while-revalidate），日後新增或修改故事會自動更新。
 *   - 其他本站檔案：快取優先，沒有才連網路。
 *   - Font Awesome（CDN）：第一次載入時存入快取，離線時圖示照常顯示。
 *
 * 修改任何檔案後，請把 CACHE_VERSION 加 1，讓使用者取得新版本。
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `kid-reading-${CACHE_VERSION}`;
const FONT_AWESOME_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2';
/** Font Awesome 樣式與本 App 用到的字型檔（實心、空心圖示） */
const FONT_AWESOME_FILES = [
  `${FONT_AWESOME_BASE}/css/all.min.css`,
  `${FONT_AWESOME_BASE}/webfonts/fa-solid-900.woff2`,
  `${FONT_AWESOME_BASE}/webfonts/fa-regular-400.woff2`
];

/** 故事 id 清單（需與 data/themes.json 一致），每篇有 4 張插圖 */
const STORY_IDS = [
  'little-ant-team', 'puppy-lost-ball',
  'seed-journey', 'raindrop-trip',
  'magic-words', 'share-umbrella',
  'paper-boat', 'star-train'
];
const IMAGES_PER_STORY = 4;

/** App 外殼檔案 */
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style-base.css',
  './css/toast-message.css',
  './css/reading-timer.css',
  './css/zhuyin-text.css',
  './css/theme-list.css',
  './css/story-list.css',
  './css/story-reader.css',
  './css/quiz-panel.css',
  './css/install-prompt.css',
  './js/main-app.js',
  './js/app-router.js',
  './js/progress-store.js',
  './js/story-data.js',
  './js/toast-message.js',
  './js/speech-helper.js',
  './js/zhuyin-text.js',
  './js/reading-timer.js',
  './js/theme-list.js',
  './js/story-list.js',
  './js/story-reader.js',
  './js/quiz-panel.js',
  './js/install-prompt.js',
  './data/themes.json',
  './images/icons/icon-192.png',
  './images/icons/icon-512.png',
  './images/icons/apple-touch-icon.png'
];

/** 全部故事檔案（JSON＋插圖） */
const STORY_FILES = STORY_IDS.flatMap((id) => [
  `./data/stories/${id}.json`,
  ...Array.from({ length: IMAGES_PER_STORY }, (_, i) => `./images/stories/${id}-${i + 1}.svg`)
]);

/* ---------- 安裝：預先快取 ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // App 外殼必須全部成功，否則安裝失敗（下次再試）
    await cache.addAll(APP_SHELL);
    // 故事與圖示字型逐一快取，單一檔案失敗不影響安裝
    await Promise.all([...STORY_FILES, ...FONT_AWESOME_FILES].map((url) =>
      cache.add(url).catch((err) => console.warn('無法快取', url, err))
    ));
    await self.skipWaiting();
  })());
});

/* ---------- 啟用：清除舊版快取 ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith('kid-reading-') && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

/** 快取優先：有快取就用，沒有就連網路並存入快取 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

/** 先回快取，同時背景更新；沒有快取時等網路 */
async function staleWhileRevalidate(event) {
  const { request } = event;
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  if (cached) {
    event.waitUntil(network.catch(() => {})); // 離線時更新失敗就算了
    return cached;
  }
  return network;
}

/* ---------- 攔截請求 ---------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // 開啟頁面：離線時一律回傳 index.html（hash 路由不需要其他頁面）
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 本站資源
  if (url.origin === self.location.origin) {
    if (url.pathname.includes('/data/')) {
      event.respondWith(staleWhileRevalidate(event));
    } else {
      event.respondWith(cacheFirst(request));
    }
    return;
  }

  // Font Awesome 的樣式與字型檔
  if (url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(cacheFirst(request));
  }
});

/**
 * story-data.js
 * 讀取主題與故事資料（JSON）。
 * 資料檔由 Service Worker 快取，離線時一樣可以讀取。
 */

const THEMES_URL = 'data/themes.json';
const storyUrl = (id) => `data/stories/${id}.json`;

let themesPromise = null;
const storyPromises = new Map();

/** 讀取 JSON，失敗時丟出錯誤讓畫面顯示提示 */
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`無法讀取 ${url}（${res.status}）`);
  return res.json();
}

/** 取得全部主題 */
export function getThemes() {
  if (!themesPromise) {
    themesPromise = fetchJson(THEMES_URL).catch((err) => {
      themesPromise = null; // 失敗時允許下次重試
      throw err;
    });
  }
  return themesPromise;
}

/** 依 id 取得主題，找不到回傳 null */
export async function getTheme(themeId) {
  const themes = await getThemes();
  return themes.find((t) => t.id === themeId) || null;
}

/** 依 id 取得故事內容 */
export function getStory(storyId) {
  if (!storyPromises.has(storyId)) {
    const p = fetchJson(storyUrl(storyId)).catch((err) => {
      storyPromises.delete(storyId);
      throw err;
    });
    storyPromises.set(storyId, p);
  }
  return storyPromises.get(storyId);
}

/** 依主題順序取得所有故事 id */
export async function getAllStoryIds() {
  const themes = await getThemes();
  return themes.flatMap((t) => t.stories);
}

/**
 * 檢查故事是否已存進離線快取（JSON 與所有插圖都在才算）。
 * 不支援 Cache API 時回傳 false。
 */
export async function isStoryOffline(story) {
  if (!('caches' in window)) return false;
  try {
    const urls = [storyUrl(story.id), ...story.paragraphs.map((p) => p.image)];
    const hits = await Promise.all(urls.map((u) => caches.match(u)));
    return hits.every(Boolean);
  } catch (err) {
    return false;
  }
}

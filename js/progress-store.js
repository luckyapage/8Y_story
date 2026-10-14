/**
 * progress-store.js
 * 負責把設定、已讀紀錄、每日閱讀秒數存到 localStorage。
 * 所有讀寫都用 try/catch 保護：私密瀏覽或儲存被封鎖時，App 仍可正常閱讀，只是不會記住進度。
 */

const STORAGE_KEY = 'kid-reading-v1';
/** 每日閱讀目標（秒）：10 分鐘 */
export const DAILY_GOAL_SECONDS = 600;
/** 每日紀錄最多保留天數，避免資料無限增加 */
const KEEP_DAYS = 120;

/** 預設資料結構 */
function createDefault() {
  return {
    settings: { showZhuyin: true, installDismissed: false },
    stories: {}, // { 故事id: { bestScore, total, lastRead } }
    daily: {}    // { 'YYYY-MM-DD': 秒數 }
  };
}

let cache = null;

/** 讀取全部資料（第一次讀取後保存在記憶體） */
function load() {
  if (cache) return cache;
  cache = createDefault();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      cache = {
        settings: { ...cache.settings, ...saved.settings },
        stories: saved.stories || {},
        daily: saved.daily || {}
      };
    }
  } catch (err) {
    // 無法讀取時沿用預設值
  }
  return cache;
}

/** 寫回 localStorage */
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (err) {
    // 儲存失敗（例如空間不足或被封鎖）時忽略，不影響閱讀
  }
}

/** 取得本地時區的日期字串 YYYY-MM-DD */
export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/* ---------- 設定 ---------- */

export function getSetting(name) {
  return load().settings[name];
}

export function setSetting(name, value) {
  load().settings[name] = value;
  save();
}

/* ---------- 故事紀錄 ---------- */

/** 取得某篇故事的紀錄，沒讀過則回傳 null */
export function getStoryRecord(storyId) {
  return load().stories[storyId] || null;
}

/** 完成故事問答後記錄分數（保留最高分） */
export function markStoryDone(storyId, score, total) {
  const data = load();
  const old = data.stories[storyId];
  data.stories[storyId] = {
    bestScore: Math.max(score, old ? old.bestScore : 0),
    total,
    lastRead: dateKey()
  };
  save();
}

/* ---------- 每日閱讀時間 ---------- */

/** 增加今天的閱讀秒數，回傳今天累計秒數 */
export function addReadingSeconds(seconds) {
  const data = load();
  const today = dateKey();
  data.daily[today] = (data.daily[today] || 0) + seconds;
  pruneOldDays(data.daily);
  save();
  return data.daily[today];
}

/** 取得今天累計閱讀秒數 */
export function getTodaySeconds() {
  return load().daily[dateKey()] || 0;
}

/**
 * 計算連續達標天數。
 * 今天若還沒讀滿 10 分鐘，從昨天開始往回算，讓小孩不會一早就看到連續天數歸零。
 */
export function getStreak() {
  const daily = load().daily;
  const day = new Date();
  let streak = 0;
  if ((daily[dateKey(day)] || 0) >= DAILY_GOAL_SECONDS) {
    streak = 1;
  }
  day.setDate(day.getDate() - 1);
  while ((daily[dateKey(day)] || 0) >= DAILY_GOAL_SECONDS) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

/** 刪除太舊的每日紀錄 */
function pruneOldDays(daily) {
  const limit = new Date();
  limit.setDate(limit.getDate() - KEEP_DAYS);
  const limitKey = dateKey(limit);
  Object.keys(daily).forEach((key) => {
    if (key < limitKey) delete daily[key];
  });
}

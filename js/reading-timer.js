/**
 * reading-timer.js
 * 每日 10 分鐘閱讀計時：只有在故事閱讀頁、畫面可見、且小孩有在操作時才累計時間。
 * 頁首顯示今日進度條與連續達標天數。
 */

import { addReadingSeconds, getTodaySeconds, getStreak, DAILY_GOAL_SECONDS } from './progress-store.js';
import { isSpeaking } from './speech-helper.js';
import { showToast } from './toast-message.js';

/** 超過這段時間沒有任何操作就暫停計時（毫秒） */
const IDLE_LIMIT = 2 * 60 * 1000;
/** 每累計幾秒寫入一次儲存空間 */
const FLUSH_EVERY = 5;

let root = null;
let barFill = null;
let label = null;
let streakEl = null;
let progressEl = null;
let intervalId = null;
let pendingSeconds = 0;
let lastActivity = Date.now();

/** 建立頁首的進度顯示 */
export function initReadingTimer(container) {
  root = container;
  root.innerHTML = `
    <div class="timer-streak" title="連續達成天數">
      <i class="fa-solid fa-fire" aria-hidden="true"></i>
      <span class="timer-streak-num"></span>
    </div>
    <div class="timer-progress" role="progressbar" aria-valuemin="0" aria-valuemax="10">
      <div class="timer-bar"><div class="timer-bar-fill"></div></div>
      <span class="timer-label"></span>
    </div>
  `;
  barFill = root.querySelector('.timer-bar-fill');
  label = root.querySelector('.timer-label');
  streakEl = root.querySelector('.timer-streak-num');
  progressEl = root.querySelector('.timer-progress');

  // 任何操作都視為「正在閱讀」
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((type) => {
    window.addEventListener(type, markActivity, { passive: true });
  });
  // 切到背景時先把累計時間存起來
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush();
  });

  render(getTodaySeconds());
}

function markActivity() {
  lastActivity = Date.now();
}

/** 更新進度條與文字 */
function render(totalSeconds) {
  if (!root) return;
  const minutes = Math.min(Math.floor(totalSeconds / 60), 10);
  const percent = Math.min(totalSeconds / DAILY_GOAL_SECONDS, 1) * 100;
  const done = totalSeconds >= DAILY_GOAL_SECONDS;

  barFill.style.width = `${percent}%`;
  label.textContent = done ? '今天達成了！' : `${minutes}／10 分`;
  progressEl.setAttribute('aria-valuenow', String(minutes));
  progressEl.setAttribute('aria-label', `今天讀了 ${minutes} 分鐘，目標 10 分鐘`);
  root.classList.toggle('is-done', done);

  const streak = getStreak();
  streakEl.textContent = String(streak);
  root.querySelector('.timer-streak').setAttribute('aria-label', `連續 ${streak} 天達成閱讀目標`);
}

/** 每秒執行一次 */
function tick() {
  if (document.hidden) return;
  const idle = Date.now() - lastActivity > IDLE_LIMIT;
  if (idle && !isSpeaking()) return; // 太久沒操作就不計時

  pendingSeconds += 1;
  const before = getTodaySeconds() + pendingSeconds - 1;
  const now = before + 1;
  if (pendingSeconds >= FLUSH_EVERY) flush();
  render(now);

  // 剛好跨過 10 分鐘時給予鼓勵
  if (before < DAILY_GOAL_SECONDS && now >= DAILY_GOAL_SECONDS) {
    showToast('太棒了！今天已經讀滿 10 分鐘！', { icon: 'fa-trophy', type: 'success', duration: 5000 });
  }
}

/** 把尚未儲存的秒數寫入 */
function flush() {
  if (pendingSeconds <= 0) return;
  addReadingSeconds(pendingSeconds);
  pendingSeconds = 0;
}

/** 進入閱讀頁時開始計時 */
export function startReading() {
  if (intervalId) return;
  markActivity();
  intervalId = setInterval(tick, 1000);
}

/** 離開閱讀頁時停止計時 */
export function stopReading() {
  clearInterval(intervalId);
  intervalId = null;
  flush();
  render(getTodaySeconds());
}

/** 取得目前連續達標天數（首頁使用） */
export function currentStreak() {
  return getStreak();
}

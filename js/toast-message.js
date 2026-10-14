/**
 * toast-message.js
 * 在畫面下方短暫顯示提示訊息（例如：達成今日目標、沒有語音）。
 * 訊息區有 role="status"，螢幕報讀器也會念出內容。
 */

const DEFAULT_DURATION = 3500;

/**
 * 顯示提示訊息
 * @param {string} text 訊息文字
 * @param {{icon?: string, type?: 'info'|'success'|'warn', duration?: number}} options
 */
export function showToast(text, { icon = 'fa-circle-info', type = 'info', duration = DEFAULT_DURATION } = {}) {
  const area = document.getElementById('toast-area');
  if (!area) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconEl = document.createElement('i');
  iconEl.className = `fa-solid ${icon}`;
  iconEl.setAttribute('aria-hidden', 'true');

  const textEl = document.createElement('span');
  textEl.textContent = text;

  toast.append(iconEl, textEl);
  area.append(toast);

  // 時間到先淡出再移除
  setTimeout(() => {
    toast.classList.add('toast-leave');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

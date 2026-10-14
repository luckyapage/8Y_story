/**
 * install-prompt.js
 * 提示使用者把 App「加入主畫面」：
 *   - Android / 電腦版 Chrome、Edge：攔截 beforeinstallprompt，顯示「安裝」按鈕。
 *   - iPhone / iPad Safari：不支援自動安裝，改顯示操作說明。
 * 使用者按「之後再說」後不再顯示。
 */

import { getSetting, setSetting } from './progress-store.js';
import { showToast } from './toast-message.js';

let deferredPrompt = null;
let bar = null;
let wanted = false; // 是否有提示要顯示（閱讀頁時暫時藏起來）

/** 閱讀故事時不顯示提示列，避免擋住內文或讓小孩誤按 */
function isReading() {
  return window.location.hash.startsWith('#/story/');
}

/** 依目前頁面決定是否顯示 */
function updateVisibility() {
  if (bar) bar.hidden = !wanted || isReading();
}

/** 是否已經以 App 模式（從主畫面）開啟 */
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

/** 是否為 iOS 裝置（iPadOS 會偽裝成 Mac，用觸控點判斷） */
function isIos() {
  const ua = window.navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** 隱藏提示列 */
function hide() {
  wanted = false;
  updateVisibility();
}

/** 使用者按「之後再說」 */
function dismiss() {
  setSetting('installDismissed', true);
  hide();
}

/**
 * 顯示提示列
 * @param {string} message 說明文字（可含 HTML 圖示）
 * @param {boolean} withInstallButton 是否顯示「安裝」按鈕
 */
function show(message, withInstallButton) {
  bar.innerHTML = `
    <i class="fa-solid fa-mobile-screen-button install-prompt-icon" aria-hidden="true"></i>
    <p class="install-prompt-text">${message}</p>
    <div class="install-prompt-actions">
      ${withInstallButton ? '<button class="btn btn-primary install-yes" type="button">安裝</button>' : ''}
      <button class="btn btn-outline install-no" type="button">之後再說</button>
    </div>
  `;
  bar.querySelector('.install-no').addEventListener('click', dismiss);
  const yes = bar.querySelector('.install-yes');
  if (yes) {
    yes.addEventListener('click', async () => {
      hide();
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (outcome === 'accepted') {
        showToast('已加入主畫面，之後點圖示就能閱讀！', { icon: 'fa-circle-check', type: 'success' });
      }
    });
  }
  wanted = true;
  updateVisibility();
}

/** 初始化安裝提示 */
export function initInstallPrompt(element) {
  bar = element;
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', '加入主畫面');

  if (isStandalone() || getSetting('installDismissed')) return;

  window.addEventListener('hashchange', updateVisibility);

  // Chrome / Edge：瀏覽器判斷可安裝時觸發
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    show('把「小書蟲」加入主畫面，就能像 App 一樣隨時打開，沒有網路也能讀故事！', true);
  });

  // 安裝完成後隱藏提示
  window.addEventListener('appinstalled', hide);

  // iOS Safari：顯示手動操作說明
  if (isIos()) {
    show('點瀏覽器下方的 <i class="fa-solid fa-arrow-up-from-bracket" aria-label="分享"></i> 分享按鈕，再選「加入主畫面」，就能像 App 一樣使用！', false);
  }
}

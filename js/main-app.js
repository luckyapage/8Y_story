/**
 * main-app.js
 * 程式進入點：初始化各功能並註冊 Service Worker（離線閱讀）。
 */

import { initZhuyinToggle } from './zhuyin-text.js';
import { initReadingTimer } from './reading-timer.js';
import { initInstallPrompt } from './install-prompt.js';
import { startRouter } from './app-router.js';
import { showToast } from './toast-message.js';

/** 註冊 Service Worker，讓 App 可以離線使用 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // 本機用 file:// 開啟時不支援，需透過 http(s) 伺服器
  if (!window.location.protocol.startsWith('http')) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((registration) => {
      // 第一次安裝完成時提示「已可離線閱讀」
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        const firstInstall = !navigator.serviceWorker.controller;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated' && firstInstall) {
            showToast('故事都下載好了，沒有網路也能讀！', { icon: 'fa-circle-check', type: 'success' });
          }
        });
      });
    }).catch((err) => {
      console.warn('Service Worker 註冊失敗：', err);
    });
  });
}

/** 網路狀態改變時提示 */
function watchNetwork() {
  window.addEventListener('offline', () => {
    showToast('目前沒有網路，可以繼續讀已下載的故事', { icon: 'fa-wifi', type: 'warn' });
  });
  window.addEventListener('online', () => {
    showToast('網路連上了！', { icon: 'fa-wifi', type: 'success' });
  });
}

/** 初始化 */
function init() {
  initZhuyinToggle(document.getElementById('zhuyin-toggle'));
  initReadingTimer(document.getElementById('reading-timer'));
  initInstallPrompt(document.getElementById('install-prompt'));
  startRouter(document.getElementById('app'));
  watchNetwork();
  registerServiceWorker();
}

init();

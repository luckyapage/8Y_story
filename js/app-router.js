/**
 * app-router.js
 * 簡易 hash 路由：依網址 # 後面的路徑切換畫面。
 *   #/              首頁（主題選擇）
 *   #/theme/主題id   主題內的故事清單
 *   #/story/故事id   故事閱讀頁
 * 使用 hash 路由，加入主畫面或離線時都不需要伺服器設定。
 */

import { renderThemeList } from './theme-list.js';
import { renderStoryList } from './story-list.js';
import { renderStoryReader } from './story-reader.js';

const routes = [
  { pattern: /^#?\/?$/, view: renderThemeList, title: '' },
  { pattern: /^#\/theme\/([\w-]+)$/, view: renderStoryList, title: '主題' },
  { pattern: /^#\/story\/([\w-]+)$/, view: renderStoryReader, title: '故事' }
];

const APP_TITLE = '小書蟲每日閱讀';

let container = null;
let cleanup = null;
let renderId = 0;

/** 顯示錯誤畫面（例如離線時故事尚未下載） */
function renderError(message) {
  const box = document.createElement('div');
  box.className = 'empty-state';
  box.innerHTML = `
    <i class="fa-solid fa-cloud-arrow-down" aria-hidden="true"></i>
    <h1 class="page-title" tabindex="-1"></h1>
    <p>連上網路後再試一次，故事就會下載到這台裝置，之後沒有網路也能讀喔！</p>
    <a class="btn btn-primary" href="#/"><i class="fa-solid fa-house" aria-hidden="true"></i> 回首頁</a>
  `;
  box.querySelector('h1').textContent = message;
  container.replaceChildren(box);
}

/** 依目前網址渲染畫面 */
async function handleRoute() {
  const hash = window.location.hash || '#/';
  const route = routes.find((r) => r.pattern.test(hash));
  const myId = ++renderId; // 防止快速切換時舊畫面晚到覆蓋新畫面

  // 先清理上一個畫面（停止計時、朗讀等）
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;

  if (!route) {
    window.location.replace('#/');
    return;
  }

  const param = hash.match(route.pattern)[1];
  const view = document.createElement('div');
  view.className = 'view';

  try {
    const result = await route.view(view, param);
    if (myId !== renderId) {
      // 已經切到別的畫面，丟棄這次結果
      if (typeof result === 'function') result();
      return;
    }
    cleanup = result;
    container.replaceChildren(view);
  } catch (err) {
    if (myId !== renderId) return;
    console.error(err);
    renderError(navigator.onLine ? '哎呀，找不到這個內容' : '故事還沒有下載到這台裝置');
  }

  // 更新分頁標題，並把焦點移到頁面標題（螢幕報讀器會念出）
  const heading = container.querySelector('.page-title');
  document.title = heading && route.title ? `${heading.textContent.replace(/[ㄅ-ㄩ˙ˊˇˋ]/g, '')}－${APP_TITLE}` : APP_TITLE;
  window.scrollTo({ top: 0 });
  if (heading && myId > 1) heading.focus({ preventScroll: true });
}

/** 啟動路由 */
export function startRouter(mainEl) {
  container = mainEl;
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

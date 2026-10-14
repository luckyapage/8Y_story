/**
 * story-list.js
 * 主題頁：列出此主題的所有故事，顯示「已讀星星」與「可離線閱讀」狀態。
 */

import { getTheme, getStory, isStoryOffline } from './story-data.js';
import { getStoryRecord } from './progress-store.js';
import { renderTokens } from './zhuyin-text.js';

/** 建立單篇故事卡片 */
function createStoryCard(story, index) {
  const record = getStoryRecord(story.id);

  const item = document.createElement('li');
  const link = document.createElement('a');
  link.className = 'story-card';
  link.href = `#/story/${story.id}`;

  const img = document.createElement('img');
  img.className = 'story-card-img';
  img.src = story.paragraphs[0].image;
  img.alt = '';
  img.width = 400;
  img.height = 300;
  img.loading = 'lazy';

  const body = document.createElement('div');
  body.className = 'story-card-body';

  const no = document.createElement('span');
  no.className = 'story-card-no';
  no.textContent = `第 ${index + 1} 篇`;

  const title = document.createElement('h2');
  title.className = 'story-card-title';
  title.append(renderTokens(story.title, { interactive: false }).fragment);

  const summary = document.createElement('p');
  summary.className = 'story-card-summary';
  summary.append(renderTokens(story.summary, { interactive: false }).fragment);

  // 狀態徽章：已讀星星、可離線
  const badges = document.createElement('div');
  badges.className = 'story-card-badges';
  if (record) {
    const stars = document.createElement('span');
    stars.className = 'badge badge-read';
    stars.setAttribute('aria-label', `已讀，答對 ${record.bestScore} 題，共 ${record.total} 題`);
    for (let i = 0; i < record.total; i += 1) {
      const star = document.createElement('i');
      star.className = i < record.bestScore ? 'fa-solid fa-star' : 'fa-regular fa-star';
      star.setAttribute('aria-hidden', 'true');
      stars.append(star);
    }
    badges.append(stars);
  } else {
    const unread = document.createElement('span');
    unread.className = 'badge badge-new';
    unread.textContent = '新故事';
    badges.append(unread);
  }

  body.append(no, title, summary, badges);
  link.append(img, body);
  item.append(link);

  // 非同步檢查離線快取，有的話加上徽章
  isStoryOffline(story).then((offline) => {
    if (!offline) return;
    const badge = document.createElement('span');
    badge.className = 'badge badge-offline';
    badge.innerHTML = '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> 可離線閱讀';
    badges.append(badge);
  });

  return item;
}

/** 渲染主題頁 */
export async function renderStoryList(container, themeId) {
  const theme = await getTheme(themeId);
  if (!theme) throw new Error('找不到這個主題');

  container.style.setProperty('--theme-color', theme.color);

  const head = document.createElement('div');
  head.className = 'page-head story-list-head';
  head.innerHTML = `
    <a class="btn btn-icon" href="#/" aria-label="回到首頁">
      <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
    </a>
    <span class="story-list-icon"><i class="fa-solid ${theme.icon}" aria-hidden="true"></i></span>
  `;
  const title = document.createElement('h1');
  title.className = 'page-title story-list-title';
  title.tabIndex = -1;
  title.setAttribute('aria-label', theme.name);
  title.append(renderTokens([{ t: theme.name, z: theme.zhuyin }], { interactive: false }).fragment);
  head.append(title);

  const list = document.createElement('ul');
  list.className = 'story-grid';

  // 故事個別載入，某一篇失敗不影響其他篇
  const stories = await Promise.all(theme.stories.map((id) => getStory(id).catch(() => null)));
  stories.forEach((story, i) => {
    if (story) list.append(createStoryCard(story, i));
  });

  if (!list.children.length) {
    throw new Error('故事還沒有下載');
  }

  container.append(head, list);

  // 離開頁面時清除主題色
  return () => container.style.removeProperty('--theme-color');
}

/**
 * theme-list.js
 * 首頁：顯示今日閱讀狀態、「今日推薦」故事，以及可選擇的閱讀主題卡片。
 */

import { getThemes, getStory, getAllStoryIds } from './story-data.js';
import { getStoryRecord, getTodaySeconds, DAILY_GOAL_SECONDS } from './progress-store.js';
import { currentStreak } from './reading-timer.js';
import { renderTokens } from './zhuyin-text.js';

/**
 * 依日期挑選今日推薦故事：每天輪替起點，優先推薦還沒讀過的故事，保持新鮮感。
 */
async function pickTodayStoryId() {
  const ids = await getAllStoryIds();
  if (ids.length === 0) return null;
  const now = new Date();
  const dayNumber = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
  const start = dayNumber % ids.length;
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[(start + i) % ids.length];
    if (!getStoryRecord(id)) return id;
  }
  return ids[start];
}

/** 依時段產生問候語 */
function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return '早安！';
  if (hour < 18) return '午安！';
  return '晚安！';
}

/** 建立「今日狀態」區塊 */
function createStatus() {
  const seconds = getTodaySeconds();
  const minutes = Math.min(Math.floor(seconds / 60), 10);
  const done = seconds >= DAILY_GOAL_SECONDS;
  const streak = currentStreak();

  const section = document.createElement('section');
  section.className = 'home-status';
  section.setAttribute('aria-label', '今日閱讀狀態');
  section.innerHTML = `
    <div class="home-status-item">
      <i class="fa-solid fa-fire" aria-hidden="true"></i>
      <div><strong>${streak}</strong> 天<br><span>連續達成</span></div>
    </div>
    <div class="home-status-item ${done ? 'is-done' : ''}">
      <i class="fa-solid ${done ? 'fa-trophy' : 'fa-hourglass-half'}" aria-hidden="true"></i>
      <div><strong>${minutes}</strong> 分鐘<br><span>${done ? '今天完成了！' : '今天已閱讀（目標 10 分鐘）'}</span></div>
    </div>
  `;
  return section;
}

/** 建立「今日推薦」卡片 */
async function createTodayCard(themes) {
  const storyId = await pickTodayStoryId();
  if (!storyId) return null;
  const story = await getStory(storyId);
  const theme = themes.find((t) => t.id === story.themeId);

  const section = document.createElement('section');
  section.className = 'today-pick';
  section.setAttribute('aria-labelledby', 'today-pick-heading');

  const heading = document.createElement('h2');
  heading.id = 'today-pick-heading';
  heading.className = 'section-title';
  heading.innerHTML = '<i class="fa-solid fa-star" aria-hidden="true"></i> 今日推薦';

  const link = document.createElement('a');
  link.className = 'today-card';
  link.href = `#/story/${story.id}`;
  if (theme) link.style.setProperty('--theme-color', theme.color);

  const img = document.createElement('img');
  img.className = 'today-card-img';
  img.src = story.paragraphs[0].image;
  img.alt = '';
  img.width = 400;
  img.height = 300;

  const body = document.createElement('div');
  body.className = 'today-card-body';

  const tag = document.createElement('span');
  tag.className = 'today-card-tag';
  tag.textContent = theme ? theme.name : '';

  const title = document.createElement('h3');
  title.className = 'today-card-title';
  title.append(renderTokens(story.title, { interactive: false }).fragment);

  const summary = document.createElement('p');
  summary.className = 'today-card-summary';
  summary.append(renderTokens(story.summary, { interactive: false }).fragment);

  const go = document.createElement('span');
  go.className = 'btn btn-primary today-card-go';
  go.innerHTML = '<i class="fa-solid fa-book-open" aria-hidden="true"></i> 開始閱讀';

  body.append(tag, title, summary, go);
  link.append(img, body);
  section.append(heading, link);
  return section;
}

/** 建立主題卡片清單 */
function createThemeGrid(themes) {
  const section = document.createElement('section');
  section.setAttribute('aria-labelledby', 'theme-heading');

  const heading = document.createElement('h2');
  heading.id = 'theme-heading';
  heading.className = 'section-title';
  heading.innerHTML = '<i class="fa-solid fa-shapes" aria-hidden="true"></i> 選擇閱讀主題';

  const list = document.createElement('ul');
  list.className = 'theme-grid';

  themes.forEach((theme) => {
    const readCount = theme.stories.filter((id) => getStoryRecord(id)).length;

    const item = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'theme-card';
    link.href = `#/theme/${theme.id}`;
    link.style.setProperty('--theme-color', theme.color);

    const icon = document.createElement('span');
    icon.className = 'theme-card-icon';
    icon.innerHTML = `<i class="fa-solid ${theme.icon}" aria-hidden="true"></i>`;

    const name = document.createElement('span');
    name.className = 'theme-card-name';
    name.append(renderTokens([{ t: theme.name, z: theme.zhuyin }], { interactive: false }).fragment);

    const count = document.createElement('span');
    count.className = 'theme-card-count';
    count.textContent = `已讀 ${readCount}／${theme.stories.length} 篇`;

    link.append(icon, name, count);
    item.append(link);
    list.append(item);
  });

  section.append(heading, list);
  return section;
}

/** 渲染首頁 */
export async function renderThemeList(container) {
  const themes = await getThemes();

  const head = document.createElement('div');
  head.className = 'page-head home-head';
  const title = document.createElement('h1');
  title.className = 'page-title';
  title.tabIndex = -1;
  title.textContent = `${greeting()}今天想讀什麼故事呢？`;
  head.append(title);

  container.append(head, createStatus());

  try {
    const today = await createTodayCard(themes);
    if (today) container.append(today);
  } catch (err) {
    // 今日推薦載入失敗（例如離線且未快取）時略過，不影響主題選擇
  }

  container.append(createThemeGrid(themes));
}

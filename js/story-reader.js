/**
 * story-reader.js
 * 故事閱讀頁：一頁一段（插圖＋注音文字），最後一頁是回顧問答。
 * 互動：點詞語朗讀、點插圖朗讀整段並逐詞高亮、左右滑動或方向鍵翻頁。
 */

import { getStory, getTheme } from './story-data.js';
import { renderTokens, tokensToText, enableWordSpeech } from './zhuyin-text.js';
import { speak, stopSpeaking } from './speech-helper.js';
import { startReading, stopReading } from './reading-timer.js';
import { renderQuiz } from './quiz-panel.js';

/** 判斷為「滑動翻頁」的最小水平距離（px） */
const SWIPE_DISTANCE = 60;

/** 渲染故事閱讀頁，回傳離開頁面時的清理函式 */
export async function renderStoryReader(container, storyId) {
  const story = await getStory(storyId);
  const theme = await getTheme(story.themeId);
  const totalPages = story.paragraphs.length + 1; // 最後一頁為問答
  let pageIndex = 0;

  if (theme) container.style.setProperty('--theme-color', theme.color);

  /* ---------- 頁首：返回與標題 ---------- */
  const head = document.createElement('div');
  head.className = 'page-head reader-head';
  const back = document.createElement('a');
  back.className = 'btn btn-icon';
  back.href = theme ? `#/theme/${theme.id}` : '#/';
  back.setAttribute('aria-label', theme ? `回到「${theme.name}」主題` : '回到首頁');
  back.innerHTML = '<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>';

  const title = document.createElement('h1');
  title.className = 'page-title reader-title';
  title.tabIndex = -1;
  title.append(renderTokens(story.title).fragment);
  head.append(back, title);

  /* ---------- 頁面內容區 ---------- */
  const pageArea = document.createElement('div');
  pageArea.className = 'reader-page';

  /* ---------- 翻頁控制 ---------- */
  const nav = document.createElement('nav');
  nav.className = 'reader-nav';
  nav.setAttribute('aria-label', '翻頁');
  nav.innerHTML = `
    <button class="btn btn-outline reader-prev" type="button">
      <i class="fa-solid fa-chevron-left" aria-hidden="true"></i><span>上一頁</span>
    </button>
    <ol class="reader-dots" aria-hidden="true"></ol>
    <button class="btn btn-primary reader-next" type="button">
      <span>下一頁</span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
    </button>
  `;
  const prevBtn = nav.querySelector('.reader-prev');
  const nextBtn = nav.querySelector('.reader-next');
  const nextLabel = nextBtn.querySelector('span');
  const dots = nav.querySelector('.reader-dots');
  for (let i = 0; i < totalPages; i += 1) {
    const dot = document.createElement('li');
    if (i === totalPages - 1) dot.className = 'is-quiz';
    dots.append(dot);
  }

  container.append(head, pageArea, nav);

  // 頁面內所有詞語都可點擊朗讀（含標題與問答）
  enableWordSpeech(container);

  /** 建立一個故事段落頁 */
  function buildParagraphPage(paragraph, index) {
    const page = document.createElement('section');
    page.className = 'reader-paragraph';
    page.setAttribute('aria-label', `第 ${index + 1} 頁，共 ${totalPages} 頁`);

    // 插圖本身就是「朗讀這一段」按鈕
    const figure = document.createElement('figure');
    figure.className = 'reader-figure';
    const imgBtn = document.createElement('button');
    imgBtn.type = 'button';
    imgBtn.className = 'reader-image-btn';
    imgBtn.setAttribute('aria-label', `朗讀這一頁：${paragraph.imageAlt}`);
    const img = document.createElement('img');
    img.src = paragraph.image;
    img.alt = '';
    img.width = 400;
    img.height = 300;
    const hint = document.createElement('span');
    hint.className = 'reader-image-hint';
    hint.innerHTML = '<i class="fa-solid fa-volume-high" aria-hidden="true"></i><span>點圖聽故事</span>';
    imgBtn.append(img, hint);
    figure.append(imgBtn);

    const text = document.createElement('p');
    text.className = 'reader-text';
    const { fragment, words } = renderTokens(paragraph.tokens);
    text.append(fragment);

    // 計算每個 token 在整段文字中的起始位置，用來對應朗讀進度
    const offsets = [];
    let pos = 0;
    paragraph.tokens.forEach((t) => {
      offsets.push(pos);
      pos += t.t.length;
    });

    let playing = false;
    let current = null; // 朗讀整段時目前高亮的詞語
    const clearHighlight = () => {
      if (current) current.classList.remove('is-speaking');
      current = null;
    };
    const stopPlaying = () => {
      playing = false;
      imgBtn.classList.remove('is-playing');
      text.classList.remove('is-reading');
      clearHighlight();
    };

    imgBtn.addEventListener('click', () => {
      if (playing) {
        stopSpeaking();
        stopPlaying();
        return;
      }
      playing = true;
      imgBtn.classList.add('is-playing');
      text.classList.add('is-reading');
      speak(tokensToText(paragraph.tokens), {
        onBoundary: (charIndex) => {
          // 找出目前念到的詞語並高亮（瀏覽器支援時）
          let idx = offsets.length - 1;
          while (idx > 0 && offsets[idx] > charIndex) idx -= 1;
          if (!words[idx]) return;
          text.classList.remove('is-reading');
          clearHighlight();
          current = words[idx];
          current.classList.add('is-speaking');
        },
        onEnd: stopPlaying
      });
    });

    page.append(figure, text);
    return page;
  }

  /** 建立問答頁 */
  function buildQuizPage() {
    const page = document.createElement('section');
    page.className = 'reader-quiz';
    page.setAttribute('aria-label', '故事問答');
    renderQuiz(page, story, {
      theme,
      onRestart: () => goTo(0)
    });
    return page;
  }

  /** 切換到指定頁 */
  function goTo(index, { focus = true } = {}) {
    if (index < 0 || index >= totalPages) return;
    stopSpeaking();
    pageIndex = index;

    const isQuiz = index === totalPages - 1;
    const page = isQuiz ? buildQuizPage() : buildParagraphPage(story.paragraphs[index], index);
    pageArea.replaceChildren(page);

    // 更新翻頁按鈕與頁碼點點
    prevBtn.disabled = index === 0;
    nextBtn.hidden = isQuiz;
    nextLabel.textContent = index === totalPages - 2 ? '回答問題' : '下一頁';
    Array.from(dots.children).forEach((dot, i) => {
      dot.classList.toggle('is-active', i === index);
      dot.classList.toggle('is-passed', i < index);
    });

    if (focus) {
      window.scrollTo({ top: 0 });
      page.tabIndex = -1;
      page.focus({ preventScroll: true });
    }
  }

  prevBtn.addEventListener('click', () => goTo(pageIndex - 1));
  nextBtn.addEventListener('click', () => goTo(pageIndex + 1));

  /* ---------- 方向鍵翻頁 ---------- */
  const onKey = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowRight' && pageIndex < totalPages - 1) goTo(pageIndex + 1);
    if (event.key === 'ArrowLeft') goTo(pageIndex - 1);
  };
  document.addEventListener('keydown', onKey);

  /* ---------- 左右滑動翻頁（手機） ---------- */
  let touchStartX = 0;
  let touchStartY = 0;
  const onTouchStart = (event) => {
    touchStartX = event.changedTouches[0].clientX;
    touchStartY = event.changedTouches[0].clientY;
  };
  const onTouchEnd = (event) => {
    const dx = event.changedTouches[0].clientX - touchStartX;
    const dy = event.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && pageIndex < totalPages - 1) goTo(pageIndex + 1);
    if (dx > 0) goTo(pageIndex - 1);
  };
  pageArea.addEventListener('touchstart', onTouchStart, { passive: true });
  pageArea.addEventListener('touchend', onTouchEnd, { passive: true });

  goTo(0, { focus: false });
  startReading();

  // 離開閱讀頁：停止計時、停止朗讀、移除全域事件
  return () => {
    stopReading();
    stopSpeaking();
    document.removeEventListener('keydown', onKey);
    container.style.removeProperty('--theme-color');
  };
}

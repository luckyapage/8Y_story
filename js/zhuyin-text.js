/**
 * zhuyin-text.js
 * 把故事的 token 資料轉成「國字＋右側直排注音」的畫面，並控制注音顯示開關。
 *
 * token 格式：
 *   { t: '小貓', z: ['ㄒㄧㄠˇ', 'ㄇㄠ'] }  → 詞語（每個字對應一個注音）
 *   { t: '，' }                            → 標點符號（沒有注音）
 */

import { getSetting, setSetting } from './progress-store.js';
import { speak } from './speech-helper.js';

const TONE_MARKS = 'ˊˇˋ';
const LIGHT_TONE = '˙';
/** 前引號類標點：要跟「後面」的詞語綁在一起 */
const OPENING_PUNCT = '「『（《〈';

/**
 * 建立單一字的注音區塊
 * 例：'ㄒㄧㄠˇ' → 直排的「ㄒㄧㄠ」＋右側聲調「ˇ」
 *     '˙ㄉㄜ'   → 上方輕聲點「˙」＋直排的「ㄉㄜ」
 */
function createBopomofo(zhuyin) {
  const wrap = document.createElement('span');
  wrap.className = 'zy-bpmf';
  wrap.setAttribute('aria-hidden', 'true'); // 螢幕報讀器只念國字

  let symbols = zhuyin;
  let tone = '';
  let light = false;

  if (symbols.startsWith(LIGHT_TONE)) {
    light = true;
    symbols = symbols.slice(1);
  }
  const last = symbols.slice(-1);
  if (TONE_MARKS.includes(last)) {
    tone = last;
    symbols = symbols.slice(0, -1);
  }

  const col = document.createElement('span');
  col.className = 'zy-col';
  if (light) {
    const dot = document.createElement('span');
    dot.className = 'zy-light';
    dot.textContent = LIGHT_TONE;
    col.append(dot);
  }
  const sym = document.createElement('span');
  sym.className = 'zy-sym';
  sym.textContent = symbols;
  col.append(sym);
  wrap.append(col);

  const toneEl = document.createElement('span');
  toneEl.className = 'zy-tone';
  toneEl.textContent = tone;
  // 依注音符號數量決定聲調的垂直位置（貼近最後一個符號）
  toneEl.dataset.len = String(symbols.length);
  wrap.append(toneEl);

  return wrap;
}

/** 建立單一國字＋注音 */
function createChar(han, zhuyin) {
  const charEl = document.createElement('span');
  charEl.className = 'zy-char';
  const hanEl = document.createElement('span');
  hanEl.className = 'zy-han';
  hanEl.textContent = han;
  charEl.append(hanEl);
  if (zhuyin) charEl.append(createBopomofo(zhuyin));
  return charEl;
}

/**
 * 把 token 陣列轉成 DOM
 * @param {Array} tokens token 陣列
 * @param {{interactive?: boolean}} options interactive 為 true 時，詞語是可點擊朗讀的按鈕
 * @returns {{fragment: DocumentFragment, words: HTMLElement[]}} words 依序對應有注音的 token
 */
export function renderTokens(tokens, { interactive = true } = {}) {
  const fragment = document.createDocumentFragment();
  const words = [];
  // 「單位」= 前引號＋詞語＋後方標點，綁在一起不斷行，避免句號、逗號出現在行首
  let unit = null;
  let pendingOpen = null;

  const newUnit = () => {
    unit = document.createElement('span');
    unit.className = 'zy-unit';
    fragment.append(unit);
    if (pendingOpen) {
      unit.append(pendingOpen);
      pendingOpen = null;
    }
    return unit;
  };

  tokens.forEach((token) => {
    if (!token.z) {
      // 標點符號
      const punct = document.createElement('span');
      punct.className = 'zy-punct';
      punct.textContent = token.t;
      words.push(null);
      if (OPENING_PUNCT.includes(token.t.slice(-1))) {
        // 前引號（如「）：留給下一個詞語；若前面還有結尾標點（如」「），結尾部分先接在上一個單位
        const close = token.t.slice(0, -1);
        if (close && unit) {
          const closeEl = punct.cloneNode();
          closeEl.textContent = close;
          unit.append(closeEl);
          punct.textContent = token.t.slice(-1);
        }
        pendingOpen = punct;
      } else {
        (unit || newUnit()).append(punct);
      }
      return;
    }

    const word = document.createElement(interactive ? 'button' : 'span');
    word.className = 'zy-word';
    if (interactive) {
      word.type = 'button';
      word.dataset.say = token.t;
    }
    Array.from(token.t).forEach((han, i) => {
      word.append(createChar(han, token.z[i]));
    });
    newUnit().append(word);
    words.push(word);
  });

  // 結尾若只剩前引號，直接放在最後
  if (pendingOpen) fragment.append(pendingOpen);

  return { fragment, words };
}

/** 把 token 陣列組回純文字（朗讀用） */
export function tokensToText(tokens) {
  return tokens.map((t) => t.t).join('');
}

/**
 * 讓容器內的詞語按鈕可以「點一下就朗讀」（事件委派，只需設定一次）
 * @param {HTMLElement} container
 */
export function enableWordSpeech(container) {
  container.addEventListener('click', (event) => {
    const word = event.target.closest('button.zy-word');
    if (!word || !container.contains(word)) return;
    // 朗讀時加上高亮，結束後移除
    container.querySelectorAll('.zy-word.is-speaking').forEach((el) => el.classList.remove('is-speaking'));
    word.classList.add('is-speaking');
    speak(word.dataset.say, {
      onEnd: () => word.classList.remove('is-speaking')
    });
  });
}

/* ---------- 注音顯示開關 ---------- */

/** 套用注音顯示狀態到整個頁面 */
function applyZhuyin(show, button) {
  document.body.classList.toggle('hide-zhuyin', !show);
  if (button) {
    button.setAttribute('aria-pressed', String(show));
    button.title = show ? '隱藏注音' : '顯示注音';
  }
}

/** 初始化頁首的注音開關按鈕 */
export function initZhuyinToggle(button) {
  let show = getSetting('showZhuyin') !== false;
  applyZhuyin(show, button);
  button.addEventListener('click', () => {
    show = !show;
    setSetting('showZhuyin', show);
    applyZhuyin(show, button);
  });
}

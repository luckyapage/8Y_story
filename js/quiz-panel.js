/**
 * quiz-panel.js
 * 故事最後的回顧問答：一次一題，答對有星星與鼓勵，答錯顯示提示並可再試一次。
 * 第一次就答對才得到星星，完成後記錄成績。
 */

import { renderTokens, tokensToText } from './zhuyin-text.js';
import { speak } from './speech-helper.js';
import { markStoryDone } from './progress-store.js';

const PRAISE = ['答對了！', '好厲害！', '你真棒！'];
const RESULT_MESSAGES = [
  '沒關係，再讀一次會更懂喔！',
  '不錯喔，再接再厲！',
  '很棒！差一點就全對了！',
  '太厲害了！全部答對！'
];

/**
 * 在容器中渲染問答
 * @param {HTMLElement} container
 * @param {object} story 故事資料
 * @param {{theme?: object, onRestart?: Function}} options
 */
export function renderQuiz(container, story, { theme, onRestart } = {}) {
  const questions = story.quiz;
  let index = 0;
  let score = 0;

  const panel = document.createElement('div');
  panel.className = 'quiz-panel';
  container.append(panel);

  /** 顯示第 index 題 */
  function showQuestion() {
    const item = questions[index];
    let firstTry = true;
    panel.replaceChildren();

    // 題號與朗讀題目按鈕
    const top = document.createElement('div');
    top.className = 'quiz-top';
    const counter = document.createElement('h2');
    counter.className = 'quiz-counter';
    counter.innerHTML = `<i class="fa-solid fa-circle-question" aria-hidden="true"></i> 想一想　第 ${index + 1}／${questions.length} 題`;
    const sayBtn = document.createElement('button');
    sayBtn.type = 'button';
    sayBtn.className = 'btn btn-icon';
    sayBtn.setAttribute('aria-label', '朗讀題目');
    sayBtn.innerHTML = '<i class="fa-solid fa-volume-high" aria-hidden="true"></i>';
    sayBtn.addEventListener('click', () => {
      const optionsText = item.options.map((o, i) => `第${i + 1}個，${tokensToText(o)}`).join('。');
      speak(`${tokensToText(item.q)}。${optionsText}`);
    });
    top.append(counter, sayBtn);

    // 題目（詞語可點擊朗讀）
    const question = document.createElement('p');
    question.className = 'quiz-question';
    question.append(renderTokens(item.q).fragment);

    // 選項
    const list = document.createElement('div');
    list.className = 'quiz-options';
    list.setAttribute('role', 'group');
    list.setAttribute('aria-label', '選項');

    // 回饋訊息（螢幕報讀器會念出）
    const feedback = document.createElement('div');
    feedback.className = 'quiz-feedback';
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'btn btn-primary quiz-next';
    next.hidden = true;
    next.innerHTML = index < questions.length - 1
      ? '下一題 <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>'
      : '看結果 <i class="fa-solid fa-flag-checkered" aria-hidden="true"></i>';
    next.addEventListener('click', () => {
      index += 1;
      if (index < questions.length) showQuestion();
      else showResult();
    });

    item.options.forEach((option, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-option';
      const no = document.createElement('span');
      no.className = 'quiz-option-no';
      no.setAttribute('aria-hidden', 'true');
      no.textContent = String(i + 1);
      const text = document.createElement('span');
      text.className = 'quiz-option-text';
      text.append(renderTokens(option, { interactive: false }).fragment);
      btn.append(no, text);

      btn.addEventListener('click', () => {
        if (i === item.answer) {
          // 答對：鎖定所有選項，顯示星星
          if (firstTry) score += 1;
          btn.classList.add('is-correct');
          list.querySelectorAll('.quiz-option').forEach((b) => { b.disabled = true; });
          const praise = PRAISE[Math.floor(Math.random() * PRAISE.length)];
          feedback.className = 'quiz-feedback is-correct';
          feedback.innerHTML = `<span class="quiz-star" aria-hidden="true"><i class="fa-solid fa-star"></i></span><strong>${praise}</strong>`;
          speak(praise);
          next.hidden = false;
          next.focus();
        } else {
          // 答錯：此選項失效，顯示提示，可以再試
          firstTry = false;
          btn.classList.add('is-wrong');
          btn.disabled = true;
          feedback.className = 'quiz-feedback is-wrong';
          feedback.replaceChildren();
          const head = document.createElement('strong');
          head.innerHTML = '<i class="fa-solid fa-lightbulb" aria-hidden="true"></i> 再想想看：';
          const hint = document.createElement('span');
          hint.className = 'quiz-hint';
          hint.append(renderTokens(item.hint).fragment);
          feedback.append(head, hint);
        }
      });
      list.append(btn);
    });

    panel.append(top, question, list, feedback, next);

    // 換題後把焦點移到題號，方便鍵盤與螢幕報讀器使用者
    if (index > 0) {
      counter.tabIndex = -1;
      counter.focus();
    }
  }

  /** 顯示成績 */
  function showResult() {
    markStoryDone(story.id, score, questions.length);
    panel.replaceChildren();

    const result = document.createElement('div');
    result.className = 'quiz-result';

    const heading = document.createElement('h2');
    heading.className = 'quiz-result-title';
    heading.tabIndex = -1;
    heading.textContent = '故事讀完了！';

    const stars = document.createElement('div');
    stars.className = 'quiz-result-stars';
    stars.setAttribute('role', 'img');
    stars.setAttribute('aria-label', `答對 ${score} 題，共 ${questions.length} 題`);
    for (let i = 0; i < questions.length; i += 1) {
      const star = document.createElement('i');
      star.className = i < score ? 'fa-solid fa-star is-earned' : 'fa-regular fa-star';
      star.style.animationDelay = `${i * 0.25}s`;
      star.setAttribute('aria-hidden', 'true');
      stars.append(star);
    }

    const ratio = score / questions.length;
    const msgIndex = ratio === 1 ? 3 : ratio >= 0.6 ? 2 : ratio > 0 ? 1 : 0;
    const message = document.createElement('p');
    message.className = 'quiz-result-message';
    message.textContent = RESULT_MESSAGES[msgIndex];

    const actions = document.createElement('div');
    actions.className = 'quiz-result-actions';

    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'btn btn-outline';
    again.innerHTML = '<i class="fa-solid fa-rotate-left" aria-hidden="true"></i> 再讀一次';
    again.addEventListener('click', () => onRestart && onRestart());

    const more = document.createElement('a');
    more.className = 'btn btn-primary';
    more.href = theme ? `#/theme/${theme.id}` : '#/';
    more.innerHTML = '<i class="fa-solid fa-book" aria-hidden="true"></i> 讀別的故事';

    const home = document.createElement('a');
    home.className = 'btn btn-outline';
    home.href = '#/';
    home.innerHTML = '<i class="fa-solid fa-house" aria-hidden="true"></i> 回首頁';

    actions.append(again, more, home);
    result.append(heading, stars, message, actions);
    panel.append(result);

    heading.focus();
    speak(`故事讀完了！${RESULT_MESSAGES[msgIndex]}`);
  }

  showQuestion();
}

/**
 * speech-helper.js
 * 包裝瀏覽器內建的語音合成（Web Speech API），用臺灣華語朗讀詞語與段落。
 * 說明：大部分手機與電腦內建中文語音，離線也能朗讀；若裝置沒有中文語音則顯示提示。
 */

import { showToast } from './toast-message.js';

const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
/** 適合小孩聽的語速（1 為正常） */
const SPEECH_RATE = 0.8;

let chineseVoice = null;
let warned = false;

/** 依優先順序挑選中文語音：臺灣 > 其他中文 */
function pickVoice() {
  if (!synth) return;
  const voices = synth.getVoices();
  const normalize = (lang) => lang.replace('_', '-').toLowerCase();
  chineseVoice =
    voices.find((v) => normalize(v.lang) === 'zh-tw') ||
    voices.find((v) => normalize(v.lang).startsWith('zh-hant')) ||
    voices.find((v) => normalize(v.lang).startsWith('zh')) ||
    null;
}

if (synth) {
  pickVoice();
  // 部分瀏覽器的語音清單是非同步載入的
  synth.addEventListener('voiceschanged', pickVoice);
}

/** 是否可以朗讀 */
export function canSpeak() {
  return Boolean(synth);
}

/** 停止目前的朗讀 */
export function stopSpeaking() {
  if (synth) synth.cancel();
}

/** 目前是否正在朗讀 */
export function isSpeaking() {
  return Boolean(synth && synth.speaking);
}

/**
 * 朗讀文字
 * @param {string} text 要朗讀的文字
 * @param {{onStart?: Function, onEnd?: Function, onBoundary?: (charIndex:number)=>void}} handlers
 */
export function speak(text, { onStart, onEnd, onBoundary } = {}) {
  if (!synth) {
    if (!warned) {
      showToast('這台裝置不支援朗讀功能', { icon: 'fa-volume-xmark', type: 'warn' });
      warned = true;
    }
    if (onEnd) onEnd();
    return;
  }

  // 先停止前一段，避免聲音重疊
  synth.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'zh-TW';
  utter.rate = SPEECH_RATE;
  utter.pitch = 1.05;
  if (chineseVoice) {
    utter.voice = chineseVoice;
  } else if (!warned && synth.getVoices().length > 0) {
    // 有語音清單但沒有中文語音
    showToast('找不到中文語音，請到裝置設定下載「中文（台灣）」語音', { icon: 'fa-volume-xmark', type: 'warn', duration: 5000 });
    warned = true;
  }

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (onEnd) onEnd();
  };

  utter.onstart = () => onStart && onStart();
  utter.onend = finish;
  utter.onerror = finish;
  if (onBoundary) {
    utter.onboundary = (event) => onBoundary(event.charIndex);
  }

  synth.speak(utter);
}

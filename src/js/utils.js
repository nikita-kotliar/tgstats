import { SW, RW, NOISE_RE } from './constants.js';

export const $ = id => document.getElementById(id);
export const fmt = n => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : String(n);
export const fmtDur = s => {
  if (!s) return '0с';
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  if (h > 0) return `${h}г ${m}хв`;
  if (m > 0) return `${m}хв ${sec}с`;
  return `${sec}с`;
};
export const initials = s => (s||'?').split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase();
export const pc = (i, pal) => pal[i % pal.length];

export function getText(msg) {
  if (typeof msg.text === 'string') return msg.text;
  if (Array.isArray(msg.text)) return msg.text.map(t => typeof t === 'string' ? t : (t.text||'')).join('');
  return '';
}

export function getLinks(msg) {
  const ent = Array.isArray(msg.text_entities) ? msg.text_entities : [];
  return ent.filter(e => e.type === 'link' || e.type === 'text_link').map(e => e.text || e.href || '');
}

export function isStopWord(w) {
  return SW.has(w) || RW.has(w) || NOISE_RE.test(w);
}

// Normalize similar words: хахаха/хахаа → хаха, мгмм → мгм etc.
export function normalizeWord(w) {
  return w
    .replace(/(ха){2,}/gi, 'хаха')
    .replace(/х+а+х+/gi, 'хаха')
    .replace(/а+х+а+/gi, 'хаха')
    .replace(/м+г+м+/gi, 'мгм')
    .replace(/г+м+/gi, 'гм')
    .replace(/х+м+/gi, 'хм')
    .replace(/о+к+/gi, 'ок')
    .replace(/(.)\1{2,}/gi, '$1$1'); // collapse 3+ repeats to 2
}

export function resolveChats(raw) {
  if (Array.isArray(raw.messages) && raw.messages.length) {
    return [{ name: raw.name || 'Чат', type: raw.type || 'personal_chat', messages: raw.messages }];
  }
  if (raw.chats && Array.isArray(raw.chats.list)) {
    return raw.chats.list.filter(c => Array.isArray(c.messages) && c.messages.length > 0);
  }
  throw new Error('Не вдалося розпізнати формат. Завантаж result.json з Telegram Desktop.');
}

export function isSoloChat(chatType) {
  return chatType === 'personal_chat' || chatType === 'bot_chat';
}

export function isSelfChat(chatObj) {
  // "Saved Messages" or only 1 unique sender
  const msgs = (chatObj.messages || []).filter(m => m.type === 'message');
  const senders = new Set(msgs.map(m => m.from).filter(Boolean));
  return senders.size <= 1;
}

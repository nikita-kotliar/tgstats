import { resolveChats } from './utils.js';
import { analyzeChat, mergeStats } from './analyze.js';
import { render, renderContent, resetHidden } from './render.js';
import { destroyAll } from './charts.js';
import { openShareModal } from './share.js';
import { $ } from './utils.js';

let ALL_CHATS = [];
let CURRENT = null;

// — App state —
export function getAll() { return ALL_CHATS; }
export function getCurrent() { return CURRENT; }

// — Loading UI —
function showLoading()  { $('upload-screen').style.display='none'; $('loading-screen').classList.add('active'); setLoader('Читаємо файл…',15); }
function hideLoading()  { $('loading-screen').classList.remove('active'); $('upload-screen').style.display='flex'; }
function setLoader(t,p) { $('lt').textContent=t; $('lb').style.width=p+'%'; }
function showDashboard(){ $('loading-screen').classList.remove('active'); $('dashboard').classList.add('active'); }

export function resetApp() {
  $('dashboard').classList.remove('active');
  $('upload-screen').style.display = 'flex';
  $('fi').value = '';
  destroyAll();
  resetHidden();
  ALL_CHATS = [];
  CURRENT = null;
}

// — File handling —
function handleFile(file) {
  if (!file) return;
  $('lf').textContent = file.name + ' · ' + (file.size/1024/1024).toFixed(1) + ' MB';
  showLoading();
  const reader = new FileReader();
  reader.onload = e => {
    try {
      setLoader('Парсимо JSON…', 35);
      const raw = JSON.parse(e.target.result);
      setLoader('Розпізнаємо чати…', 55);
      setTimeout(() => {
        try {
          const chatList = resolveChats(raw);
          setLoader('Аналізуємо повідомлення…', 75);
          setTimeout(() => {
            ALL_CHATS = chatList.map(c => analyzeChat(c));
            const merged = mergeStats(ALL_CHATS);
            ALL_CHATS.unshift(merged);
            setLoader('Будуємо дашборд…', 90);
            setTimeout(() => {
              buildSwitcher();
              showChat(0);
              setLoader('Готово!', 100);
              setTimeout(showDashboard, 300);
            }, 150);
          }, 100);
        } catch(err) { hideLoading(); toast('Помилка: ' + err.message); console.error(err); }
      }, 80);
    } catch(err) { hideLoading(); toast('Невалідний JSON'); }
  };
  reader.readAsText(file);
}

function buildSwitcher() {
  const bar = $('chat-switcher');
  bar.innerHTML = '';

  // "All chats" pill
  if (ALL_CHATS.length > 1) {
    const all = document.createElement('div');
    all.className = 'chat-pill active';
    all.textContent = '🌐 Всі чати';
    all.onclick = () => showChat(0);
    bar.appendChild(all);
  }

  // Top-10 individual chats by message count (skip index 0 = merged)
  const sorted = ALL_CHATS.slice(1).sort((a,b) => b.totalMessages - a.totalMessages).slice(0,10);
  sorted.forEach(s => {
    const idx = ALL_CHATS.indexOf(s);
    const p = document.createElement('div');
    p.className = 'chat-pill';
    p.textContent = s.isNotes ? '📝 ' + s.chatName : s.chatName;
    p.onclick = () => showChat(idx);
    bar.appendChild(p);
  });
}

function showChat(idx) {
  document.querySelectorAll('.chat-pill').forEach(p => p.classList.remove('active'));
  const pills = document.querySelectorAll('.chat-pill');
  // match by index
  const s = ALL_CHATS[idx];
  document.querySelectorAll('.chat-pill').forEach(p => {
    const match = p.textContent.trim() === ('🌐 Всі чати') && idx === 0
      || p.textContent.trim() === s.chatName
      || p.textContent.trim() === ('📝 ' + s.chatName);
    if (match) p.classList.add('active');
  });

  CURRENT = s;
  $('nav-count').textContent = (s.totalMessages/1000).toFixed(1) + 'K повідомлень';
  manageCallsTab(s);
  manageSendersTab(s);
  render(s);
  window._rerender = () => render(s);
  switchTab('overview');
}

function manageCallsTab(s) {
  const tab = document.querySelector('[data-tab="calls"]');
  if (!tab) return;
  tab.style.display = s.calls?.total > 0 ? '' : 'none';
}

function manageSendersTab(s) {
  const tab = document.querySelector('[data-tab="senders"]');
  if (!tab) return;
  tab.style.display = s.isNotes ? 'none' : '';
}

// — Tabs —
export function switchTab(n) {
  document.querySelectorAll('.dash-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === n));
  document.querySelectorAll('.dash-section').forEach(s => s.classList.toggle('active', s.id === 'tab-'+n));
}

// — Scroll to top button —
function initScrollTop() {
  const btn = document.createElement('button');
  btn.id = 'scroll-top-btn';
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>';
  document.body.appendChild(btn);

  const content = document.getElementById('dashboard');
  let lastY = 0;

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(100, Math.round(y / max * 100)) : 0;
    btn.style.setProperty('--pct', pct + '%');
    if (y > 300) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
    lastY = y;
  }, { passive: true });

  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// — Toast —
export function toast(m) {
  const t = $('toast');
  t.textContent = m;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// — Drag & drop —
function handleDragOver(e)  { e.preventDefault(); $('drop-zone').classList.add('drag-over'); }
function handleDragLeave()  { $('drop-zone').classList.remove('drag-over'); }
function handleDrop(e)      { e.preventDefault(); $('drop-zone').classList.remove('drag-over'); const f=e.dataTransfer.files[0]; if(f) handleFile(f); }

// — Background particles toggle —
function initBgToggle() {
  const btn = $('bg-toggle');
  if (!btn) return;
  let on = true;
  btn.addEventListener('click', () => {
    on = !on;
    document.body.classList.toggle('no-bg-anim', !on);
    btn.textContent = on ? '✦' : '✧';
    btn.title = on ? 'Вимкнути анімацію фону' : 'Увімкнути анімацію фону';
  });
}

// — Share button —
function initShare() {
  const btn = $('share-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (CURRENT) openShareModal(CURRENT);
  });
}

// — Init —
document.addEventListener('DOMContentLoaded', () => {
  $('drop-zone')?.addEventListener('dragover', handleDragOver);
  $('drop-zone')?.addEventListener('dragleave', handleDragLeave);
  $('drop-zone')?.addEventListener('drop', handleDrop);
  $('fi')?.addEventListener('change', e => handleFile(e.target.files[0]));
  $('reset-btn')?.addEventListener('click', resetApp);

  document.querySelectorAll('.dash-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  initScrollTop();
  initBgToggle();
  initShare();

  // Chat switcher: mouse wheel horizontal scroll
  const switcher = $('chat-switcher');
  if (switcher) {
    switcher.addEventListener('wheel', e => {
      if (e.deltaY !== 0) { e.preventDefault(); switcher.scrollLeft += e.deltaY; }
    }, { passive: false });
  }
});

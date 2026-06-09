import { PAL, DAYS_UK, CHAT_TYPE_LABELS } from './constants.js';
import { $, fmt, fmtDur, initials, pc, isSoloChat } from './utils.js';
import { barChart, hBarChart, lineChart, multiLineChart, doughnutChart, stackedBarChart, mkChart } from './charts.js';

let hiddenWords = new Set();
let hiddenNames = new Map(); // name → display alias

function monthLabel(m) {
  const [y, mo] = m.split('-');
  return mo + '.' + y.slice(2);
}

export function render(s) {
  renderHeader(s);
  renderBento(s);
  renderOverview(s);
  renderActivity(s);
  renderSenders(s);
  renderContent(s);
  renderRecords(s);
  renderCalls(s);
}

function renderHeader(s) {
  const av = $('h-av');
  av.textContent = s.isGlobal ? '🌐' : initials(s.chatName);
  av.style.background = s.isGlobal
    ? 'linear-gradient(135deg,#00dcff,#a855f7)'
    : `linear-gradient(135deg,${pc(0,PAL)}88,${pc(1,PAL)}88)`;

  $('h-name').textContent = s.chatName;
  const f = s.firstDate?.toLocaleDateString('uk-UA', { day:'numeric', month:'long', year:'numeric' }) || '';
  const l = s.lastDate?.toLocaleDateString('uk-UA', { day:'numeric', month:'long', year:'numeric' }) || '';
  $('h-dates').textContent = f + ' — ' + l;

  let typeLabel;
  if (s.isGlobal) typeLabel = 'ВСЬОГО ЧАТІВ: ' + s.totalChats;
  else if (s.isNotes) typeLabel = 'НОТАТКИ';
  else typeLabel = CHAT_TYPE_LABELS[s.chatType] || s.chatType.toUpperCase();
  $('h-type').textContent = typeLabel;
}

function renderBento(s) {
  const solo = isSoloChat(s.chatType) || s.isNotes;
  const items = [
    { icon:'💬', label:'Повідомлень',    val: fmt(s.totalMessages),           hl:'hl-c' },
    { icon:'📅', label:'Днів листування', val: fmt(s.totalDays),               hl:'' },
    { icon:'🔤', label:'Слів написано',   val: fmt(s.totalWords),              hl:'' },
    ...(!solo ? [{ icon:'👥', label:'Учасників', val: s.senders.length, hl:'hl-p' }] : []),
    { icon:'🖼',  label:'Фото',           val: fmt(s.mPhoto),                  hl:'' },
    { icon:'🎬', label:'Відео',           val: fmt(s.mVideo),                  hl:'' },
    { icon:'⭕', label:'Кружечки',        val: fmt(s.mCircle),                 hl:'hl-a' },
    { icon:'🎙', label:'Голосові',        val: fmt(s.mVoice),                  hl:'' },
    { icon:'😄', label:'Стікери',         val: fmt(s.mSticker),               hl:'' },
    { icon:'🔗', label:'Посилання',       val: fmt(s.mLink),                   hl:'' },
    { icon:'🔥', label:'Streak',          val: s.maxStreak + 'д',              hl:'hl-g' },
    { icon:'🏆', label:'Рекорд/день',     val: fmt(s.bestDay[1]),              hl:'hl-c' },
  ];
  $('bento').innerHTML = items.map(d =>
    `<div class="mc ${d.hl}"><span class="mc-icon">${d.icon}</span><div class="mc-label">${d.label}</div><div class="mc-value">${d.val}</div></div>`
  ).join('');
}

function renderOverview(s) {
  const ml = s.sortedMonths.map(monthLabel);
  const mt = s.sortedMonths.map(m => Object.values(s.byMonth[m]).reduce((a,b) => a+b, 0));

  barChart('ch-monthly', ml, mt, ml.map((_,i) => PAL[i%PAL.length]+'44'));
  $('ch-monthly').parentElement.querySelector('.cw') && null; // chart already made

  const top8 = s.senders.slice(0, 8);
  if (!s.isNotes && top8.length > 1) {
    doughnutChart('ch-pie', top8.map(n => hiddenNames.get(n) || n), top8.map(sd => s.senderMap[sd].msgs));
    $('pie-section')?.classList.remove('hidden');
  } else {
    $('pie-section')?.classList.add('hidden');
  }

  const tiles = [
    { icon:'🖼️', label:'Фото',       val: s.mPhoto },
    { icon:'🎬', label:'Відео',      val: s.mVideo },
    { icon:'⭕', label:'Кружечки',   val: s.mCircle,   sub: fmtDur(s.circleDuration) },
    { icon:'🎙️', label:'Голосові',   val: s.mVoice,    sub: fmtDur(s.voiceDuration) },
    { icon:'🎵', label:'Аудіо',      val: s.mAudio },
    { icon:'😄', label:'Стікери',    val: s.mSticker },
    { icon:'🎞️', label:'GIF',        val: s.mGif },
    { icon:'🔗', label:'Посилання',  val: s.mLink },
    { icon:'📎', label:'Файли',      val: s.mFile },
  ];
  $('media-tiles').innerHTML = tiles.map(t =>
    `<div class="media-tile"><span class="mt-icon">${t.icon}</span><div class="mt-label">${t.label}</div><div class="mt-val">${fmt(t.val)}</div>${t.sub ? `<div class="mt-sub">${t.sub}</div>` : ''}</div>`
  ).join('');
}

function renderActivity(s) {
  const maxH = Math.max(...s.byHour) || 1;
  let hm = '<div class="hm"><div class="hm-lbl"></div>';
  for (let h = 0; h < 24; h++) hm += `<div class="hm-h">${h}</div>`;
  DAYS_UK.forEach((d, di) => {
    hm += `<div class="hm-lbl">${d}</div>`;
    for (let h = 0; h < 24; h++) {
      const v = Math.round(s.byHour[h] * s.byWeekday[di] / s.totalMessages * 7);
      const a = Math.max(0.05, v / maxH);
      hm += `<div class="hm-cell" style="background:rgba(0,220,255,${a.toFixed(2)})" data-tip="${d} ${h}:00 ~ ${v} пов."></div>`;
    }
  });
  hm += '</div>';
  $('heatmap').innerHTML = hm;

  barChart('ch-weekday', DAYS_UK, s.byWeekday, DAYS_UK.map((_,i) => PAL[i%PAL.length]+'88'));
  lineChart('ch-hours',
    Array.from({length:24}, (_,i) => i+':00'),
    [{ data: s.byHour, borderColor:'#a855f7', backgroundColor:'rgba(168,85,247,0.12)', fill:true, tension:0.4, pointRadius:3 }]
  );

  const top8 = s.senders.slice(0, 4);
  const ml = s.sortedMonths.map(monthLabel);
  $('monthly-legend').innerHTML = top8.map((n,i) =>
    `<span><span class="lr-dot" style="background:${PAL[i%PAL.length]}"></span>${hiddenNames.get(n)||n}</span>`
  ).join('');
  lineChart('ch-monthly-line', ml, top8.map((n,i) => ({
    label: n, data: s.sortedMonths.map(m => s.byMonth[m][n]||0),
    borderColor: PAL[i%PAL.length], backgroundColor:'transparent', tension:0.4, pointRadius:2, borderWidth:1.5,
  })));

  // Response time: show only if proper gap-based (≥30min silence)
  const lines = s.senders.map((sd, i) => {
    const med = s.responseMedians[sd];
    if (med === null) return null;
    const mins = Math.round(med / 60);
    const str = mins < 1 ? '<1 хв' : mins >= 60 ? `${Math.floor(mins/60)}г ${mins%60}хв` : mins + ' хв';
    return `<span style="color:${PAL[i%PAL.length]}">${hiddenNames.get(sd)||sd}</span>: ${str}`;
  }).filter(Boolean);
  $('resp-info').innerHTML = lines.length
    ? '<small style="color:var(--t3);font-size:10px">Медіана часу відповіді після ≥30 хв мовчання</small><br>' + lines.join(' &nbsp;|&nbsp; ')
    : 'Недостатньо даних';
}

function renderSenders(s) {
  if (s.isNotes) { $('tab-senders') && ($('tab-senders').innerHTML = '<div class="cc sg" style="text-align:center;color:var(--t2);padding:2rem">У нотатках немає учасників</div>'); return; }

  const top8 = s.senders.slice(0, 8);
  $('sc-grid').innerHTML = top8.map((name, i) => {
    const sd = s.senderMap[name];
    const pct = Math.round(sd.msgs / s.totalMessages * 100);
    const col = PAL[i % PAL.length];
    const med = s.responseMedians[name];
    const mins = med !== null ? Math.round(med/60) : null;
    const medStr = med !== null ? (mins < 1 ? '<1хв' : mins >= 60 ? `${Math.floor(mins/60)}г ${mins%60}хв` : mins+'хв') : '—';
    const displayName = hiddenNames.has(name) ? '[ прихований ]' : name;

    return `<div class="sc">
      <div class="sc-hdr">
        <div class="sc-av" style="background:${col}22;color:${col};border:1.5px solid ${col}44">${hiddenNames.has(name)?'?':initials(name)}</div>
        <div>
          <div class="sc-name">${displayName}</div>
          <div class="sc-rank" style="color:${col}">#${i+1} · ${pct}%</div>
        </div>
        <button class="name-action-btn" data-name="${name}" title="Дії з іменем">⋯</button>
      </div>
      <div class="sc-stats">
        <div class="ss"><div class="ss-l">Повідомлень</div><div class="ss-v" style="color:${col}">${fmt(sd.msgs)}</div></div>
        <div class="ss"><div class="ss-l">Відповідь</div><div class="ss-v">${medStr}</div></div>
        <div class="ss"><div class="ss-l">Фото</div><div class="ss-v">${fmt(sd.photos)}</div></div>
        <div class="ss"><div class="ss-l">Симв./пов.</div><div class="ss-v">${s.avgChar[name]||0}</div></div>
        <div class="ss"><div class="ss-l">Стікери</div><div class="ss-v">${fmt(sd.stickers)}</div></div>
        <div class="ss"><div class="ss-l">Посилань</div><div class="ss-v">${fmt(sd.links)}</div></div>
      </div>
      <div class="sc-bar">
        <div class="sc-bl"><span>${displayName}</span><span>${pct}%</span></div>
        <div class="sc-bt"><div class="sc-bf" style="width:${pct}%;background:${col}"></div></div>
      </div>
    </div>`;
  }).join('');

  document.querySelectorAll('.name-action-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      showNameModal(btn.dataset.name);
    });
  });

  hBarChart('ch-avglen', top8.map(n => hiddenNames.get(n)||n), top8.map(sd => s.avgChar[sd]));

  $('stacked-legend').innerHTML = top8.map((n,i) =>
    `<span><span class="lr-dot" style="background:${PAL[i%PAL.length]}"></span>${hiddenNames.get(n)||n}</span>`
  ).join('');
  stackedBarChart('ch-stacked', s.sortedMonths.map(monthLabel), top8.map((n,i) => ({
    label: n,
    data: s.sortedMonths.map(m => s.byMonth[m][n]||0),
    backgroundColor: PAL[i%PAL.length]+'99',
    borderWidth: 0, borderRadius: 2,
  })));
}

export function renderContent(s) {
  const maxW = s.topWords[0]?.[1] || 1;
  $('words-cloud').innerHTML = s.topWords
    .filter(([w]) => !hiddenWords.has(w))
    .map(([w,c]) =>
      `<div class="wp" style="font-size:${11+Math.round(c/maxW*10)}px">
        ${w}<span class="wc">${c}</span>
        <button class="word-hide-btn" data-word="${w}" title="Сховати">✕</button>
      </div>`
    ).join('');

  document.querySelectorAll('.word-hide-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      hiddenWords.add(btn.dataset.word);
      renderContent(s);
    });
  });

  $('emoji-grid').innerHTML = s.topEmoji.length
    ? s.topEmoji.map(([em,c]) =>
        `<div class="ei"><span class="ei-e">${em}</span><div class="ei-c">${fmt(c)}</div></div>`
      ).join('')
    : '<div style="color:var(--t3);font-family:var(--fm);font-size:12px">Емодзі не знайдено</div>';

  const bk = Object.keys(s.lengthBuckets);
  barChart('ch-lengths', bk, bk.map(k => s.lengthBuckets[k]), PAL.slice(0,5).map(c=>c+'99'));

  multiLineChart('ch-media-m', s.sortedMonths.map(monthLabel), [
    { label:'Фото',      data: s.sortedMonths.map(m=>(s.mediaByMonth[m]||{}).photo||0),   borderColor:PAL[0], backgroundColor:'transparent', tension:0.3, pointRadius:2, borderWidth:1.5 },
    { label:'Відео',     data: s.sortedMonths.map(m=>(s.mediaByMonth[m]||{}).video||0),   borderColor:PAL[2], backgroundColor:'transparent', tension:0.3, pointRadius:2, borderWidth:1.5 },
    { label:'Кружечки',  data: s.sortedMonths.map(m=>(s.mediaByMonth[m]||{}).circle||0),  borderColor:PAL[4], backgroundColor:'transparent', tension:0.3, pointRadius:2, borderWidth:1.5 },
    { label:'Голосові',  data: s.sortedMonths.map(m=>(s.mediaByMonth[m]||{}).voice||0),   borderColor:PAL[3], backgroundColor:'transparent', tension:0.3, pointRadius:2, borderWidth:1.5 },
    { label:'Стікери',   data: s.sortedMonths.map(m=>(s.mediaByMonth[m]||{}).sticker||0), borderColor:PAL[1], backgroundColor:'transparent', tension:0.3, pointRadius:2, borderWidth:1.5 },
    { label:'Посилання', data: s.sortedMonths.map(m=>(s.mediaByMonth[m]||{}).link||0),    borderColor:PAL[5], backgroundColor:'transparent', tension:0.3, pointRadius:2, borderWidth:1.5 },
  ]);
}

export function renderRecords(s) {
  const topS = s.senders[0] || '—';
  const topPct = Math.round((s.senderMap[topS]?.msgs||0) / s.totalMessages * 100);
  const bdDate = s.bestDay[0] !== '—'
    ? new Date(s.bestDay[0]).toLocaleDateString('uk-UA', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
    : '—';

  const items = [
    { icon:'🏆', label:'Рекордний день',      detail: bdDate,                                         val: fmt(s.bestDay[1]) + ' пов.' },
    { icon:'🔥', label:'Найдовша серія',       detail: 'днів поспіль',                                val: s.maxStreak + 'д' },
    { icon:'⏰', label:'Пік активності',       detail: 'найактивніша година',                         val: s.peakHour + ':00' },
    { icon:'📆', label:'Піковий день тижня',   detail: '',                                             val: s.peakWeekday },
    { icon:'👑', label:'Головний автор',       detail: (hiddenNames.get(topS)||topS) + ' · ' + topPct + '%', val: fmt(s.senderMap[topS]?.msgs||0) },
    { icon:'📝', label:'Найдовше повідомлення', detail: hiddenNames.get(s.longestMsg.sender)||s.longestMsg.sender||'—', val: fmt(s.longestMsg.len) + ' симв.' },
    { icon:'🎙', label:'Голосові — тривалість', detail: fmt(s.mVoice) + ' файлів',                    val: fmtDur(s.voiceDuration) },
    { icon:'⭕', label:'Кружечки — тривалість', detail: fmt(s.mCircle) + ' відео',                    val: fmtDur(s.circleDuration) },
    { icon:'📈', label:'Середній темп',         detail: 'повідомлень на день',                         val: (s.totalMessages/s.totalDays).toFixed(1) },
  ];

  $('rec-list').innerHTML = items.map(it =>
    `<div class="ri">
      <div class="ri-icon">${it.icon}</div>
      <div class="ri-info"><div class="ri-label">${it.label}</div><div class="ri-detail">${it.detail}</div></div>
      <div class="ri-val">${it.val}</div>
    </div>`
  ).join('');

  barChart('ch-topdays',
    s.topDays.map(([d]) => new Date(d).toLocaleDateString('uk-UA', { day:'numeric', month:'short' })),
    s.topDays.map(([,v]) => v),
    PAL.slice(0,10).map(c=>c+'99')
  );
}

function renderCalls(s) {
  const c = s.calls;
  if (!c || c.total === 0) {
    $('tab-calls').innerHTML = '<div class="cc sg" style="text-align:center;color:var(--t2);padding:2rem;font-family:var(--fm);font-size:12px">Дзвінків не знайдено в цьому чаті</div>';
    return;
  }

  const actors = Object.entries(c.byActor).sort((a,b) => b[1].initiated - a[1].initiated);

  $('tab-calls').innerHTML = `
    <div class="bento sg" id="calls-bento">
      <div class="mc hl-c"><span class="mc-icon">📞</span><div class="mc-label">Всього дзвінків</div><div class="mc-value">${fmt(c.total)}</div></div>
      <div class="mc hl-g"><span class="mc-icon">✅</span><div class="mc-label">Завершено</div><div class="mc-value">${fmt(c.hangup||0)}</div></div>
      <div class="mc hl-a"><span class="mc-icon">📵</span><div class="mc-label">Пропущено</div><div class="mc-value">${fmt(c.missed||0)}</div></div>
      <div class="mc"><span class="mc-icon">🔴</span><div class="mc-label">Зайнято</div><div class="mc-value">${fmt(c.busy||0)}</div></div>
      <div class="mc"><span class="mc-icon">⚡</span><div class="mc-label">Перервано</div><div class="mc-value">${fmt(c.disconnect||0)}</div></div>
      <div class="mc hl-p"><span class="mc-icon">⏱</span><div class="mc-label">Загальний час</div><div class="mc-value">${fmtDur(c.totalDuration)}</div></div>
    </div>
    <div class="cc sg">
      <div class="ct">Дзвінки по учасниках</div>
      <div class="sc-grid" id="calls-by-actor">
        ${actors.map(([ name, data ], i) => {
          const col = PAL[i%PAL.length];
          const dn = hiddenNames.get(name) || name;
          return `<div class="sc">
            <div class="sc-hdr">
              <div class="sc-av" style="background:${col}22;color:${col};border:1.5px solid ${col}44">${hiddenNames.has(name)?'?':initials(name)}</div>
              <div><div class="sc-name">${dn}</div><div class="sc-rank" style="color:${col}">#${i+1}</div></div>
            </div>
            <div class="sc-stats">
              <div class="ss"><div class="ss-l">Ініційовано</div><div class="ss-v" style="color:${col}">${fmt(data.initiated)}</div></div>
              <div class="ss"><div class="ss-l">Час розмов</div><div class="ss-v">${fmtDur(data.duration)}</div></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

// — Name modal —
function showNameModal(name) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const isHidden = hiddenNames.has(name);
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title">${isHidden ? '[ прихований ]' : name}</div>
      <div class="modal-btns">
        ${isHidden
          ? `<button class="mbtn mbtn-c" id="mb-show">Показати</button>`
          : `<button class="mbtn mbtn-a" id="mb-rename">Перейменувати</button>
             <button class="mbtn mbtn-d" id="mb-hide">Сховати</button>`
        }
        <button class="mbtn" id="mb-close">Закрити</button>
      </div>
      <div id="mb-rename-form" style="display:none;margin-top:1rem">
        <input class="modal-input" id="mb-rename-val" type="text" placeholder="Нове ім'я" value="${hiddenNames.get(name)||name}">
        <button class="mbtn mbtn-c" id="mb-rename-ok">OK</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#mb-close')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#mb-hide')?.addEventListener('click', () => {
    hiddenNames.set(name, '[ прихований ]');
    overlay.remove();
    window._rerender?.();
  });
  overlay.querySelector('#mb-show')?.addEventListener('click', () => {
    hiddenNames.delete(name);
    overlay.remove();
    window._rerender?.();
  });
  overlay.querySelector('#mb-rename')?.addEventListener('click', () => {
    overlay.querySelector('#mb-rename-form').style.display = 'flex';
  });
  overlay.querySelector('#mb-rename-ok')?.addEventListener('click', () => {
    const val = overlay.querySelector('#mb-rename-val').value.trim();
    if (val) { hiddenNames.set(name, val); overlay.remove(); window._rerender?.(); }
  });
}

export function resetHidden() {
  hiddenWords.clear();
  hiddenNames.clear();
}

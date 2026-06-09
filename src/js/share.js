import { fmt, fmtDur } from './utils.js';

export function openShareModal(s) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const sections = [
    { id: 'general',  label: '📊 Загальна статистика' },
    { id: 'media',    label: '📎 Медіа' },
    { id: 'activity', label: '⏱ Активність' },
    { id: 'words',    label: '🔤 Топ слів' },
    { id: 'records',  label: '🏆 Рекорди' },
    { id: 'calls',    label: '📞 Дзвінки' },
  ];

  overlay.innerHTML = `
    <div class="modal" style="max-width:420px">
      <div class="modal-title">Поділитися статистикою</div>
      <div style="font-family:var(--fm);font-size:11px;color:var(--t2);margin-bottom:1rem">Обери що включити:</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:1.25rem">
        ${sections.map(s => `
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-family:var(--fm);font-size:12px;color:var(--t1)">
            <input type="checkbox" class="share-check" data-id="${s.id}" checked style="accent-color:var(--c1)">
            ${s.label}
          </label>`).join('')}
      </div>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-family:var(--fm);font-size:11px;color:var(--t2);margin-bottom:1rem">
        <input type="checkbox" id="share-hide-names" style="accent-color:var(--c1)">
        Приховати імена учасників
      </label>
      <div class="modal-btns">
        <button class="mbtn mbtn-c" id="share-copy">Копіювати текст</button>
        <button class="mbtn" id="share-close">Закрити</button>
      </div>
      <div id="share-preview" style="margin-top:1rem;display:none">
        <textarea id="share-text" style="width:100%;height:200px;background:var(--bg3);border:1px solid var(--br);border-radius:8px;color:var(--t1);font-family:var(--fm);font-size:11px;padding:10px;resize:vertical"></textarea>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#share-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#share-copy').addEventListener('click', () => {
    const checked = new Set([...overlay.querySelectorAll('.share-check:checked')].map(c => c.dataset.id));
    const hideNames = overlay.querySelector('#share-hide-names').checked;
    const text = buildShareText(s, checked, hideNames);
    const preview = overlay.querySelector('#share-preview');
    const ta = overlay.querySelector('#share-text');
    preview.style.display = 'block';
    ta.value = text;
    navigator.clipboard?.writeText(text).catch(() => {});
    ta.select();
  });
}

function buildShareText(s, sections, hideNames) {
  const name = hideNames ? 'Чат' : s.chatName;
  const lines = [`📊 TG Stats — ${name}`, ''];

  if (sections.has('general')) {
    lines.push('— Загальна статистика —');
    lines.push(`💬 Повідомлень: ${fmt(s.totalMessages)}`);
    lines.push(`📅 Днів листування: ${fmt(s.totalDays)}`);
    lines.push(`🔤 Слів написано: ${fmt(s.totalWords)}`);
    if (!hideNames && s.senders.length > 1) lines.push(`👥 Учасників: ${s.senders.length}`);
    lines.push('');
  }

  if (sections.has('media')) {
    lines.push('— Медіа —');
    lines.push(`🖼 Фото: ${fmt(s.mPhoto)}`);
    lines.push(`🎬 Відео: ${fmt(s.mVideo)}`);
    lines.push(`⭕ Кружечки: ${fmt(s.mCircle)} (${fmtDur(s.circleDuration)})`);
    lines.push(`🎙 Голосові: ${fmt(s.mVoice)} (${fmtDur(s.voiceDuration)})`);
    lines.push(`😄 Стікери: ${fmt(s.mSticker)}`);
    lines.push('');
  }

  if (sections.has('activity')) {
    lines.push('— Активність —');
    lines.push(`🔥 Streak: ${s.maxStreak} днів поспіль`);
    lines.push(`⏰ Пік: ${s.peakHour}:00, ${s.peakWeekday}`);
    lines.push('');
  }

  if (sections.has('words')) {
    lines.push('— Топ-10 слів —');
    s.topWords.slice(0,10).forEach(([w,c]) => lines.push(`  ${w}: ${c}`));
    lines.push('');
  }

  if (sections.has('records')) {
    lines.push('— Рекорди —');
    lines.push(`🏆 Рекорд дня: ${fmt(s.bestDay[1])} пов.`);
    lines.push(`📝 Найдовше: ${fmt(s.longestMsg.len)} симв.`);
    lines.push('');
  }

  if (sections.has('calls') && s.calls?.total > 0) {
    lines.push('— Дзвінки —');
    lines.push(`📞 Всього: ${fmt(s.calls.total)}`);
    lines.push(`✅ Завершено: ${fmt(s.calls.hangup||0)}`);
    lines.push(`📵 Пропущено: ${fmt(s.calls.missed||0)}`);
    lines.push(`⏱ Загальний час: ${fmtDur(s.calls.totalDuration)}`);
    lines.push('');
  }

  lines.push('tgstats.app');
  return lines.join('\n');
}

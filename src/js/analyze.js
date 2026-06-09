import { WORD_RE, EMOJI_RE, RESPONSE_GAP_MIN, RESPONSE_GAP_MAX, DAYS_UK, CALL_STATUS } from './constants.js';
import { getText, getLinks, isStopWord, normalizeWord, isSelfChat } from './utils.js';

export function analyzeChat(chatObj) {
  const allMsgs = chatObj.messages || [];
  const msgs = allMsgs.filter(m => m.type === 'message');
  const services = allMsgs.filter(m => m.type === 'service');
  const chatName = chatObj.name || 'Чат';
  const chatType = chatObj.type || 'personal_chat';
  const isNotes = isSelfChat(chatObj);

  const senderMap = {};
  const byDay = {}, byMonth = {}, byHour = new Array(24).fill(0), byWeekday = new Array(7).fill(0);
  const wordFreq = {}, emojiFreq = {};
  const lengthBuckets = { '1-50':0, '51-150':0, '151-300':0, '301-500':0, '500+':0 };

  let mPhoto=0, mVideo=0, mCircle=0, mVoice=0, mAudio=0, mSticker=0, mFile=0, mLink=0, mGif=0;
  let voiceDuration=0, circleDuration=0;
  const mediaByMonth = {};

  // Call stats
  const calls = { total:0, hangup:0, missed:0, busy:0, disconnect:0, totalDuration:0, byActor:{} };

  let firstDate=null, lastDate=null;
  let longestMsg = { text:'', len:0, sender:'', date:'' };
  const responseTimes = {};
  let prevMsg = null;

  // — Service events (calls) —
  services.forEach(svc => {
    if (svc.action !== 'phone_call') return;
    const reason = svc.discard_reason || 'hangup';
    const dur = svc.duration_seconds || 0;
    calls.total++;
    calls[reason] = (calls[reason] || 0) + 1;
    calls.totalDuration += dur;

    const actor = svc.actor || 'Невідомо';
    if (!calls.byActor[actor]) calls.byActor[actor] = { initiated:0, duration:0 };
    calls.byActor[actor].initiated++;
    calls.byActor[actor].duration += dur;
  });

  // — Messages —
  msgs.forEach(msg => {
    const sender = msg.from || 'Невідомо';
    if (!senderMap[sender]) senderMap[sender] = { msgs:0, words:0, chars:0, photos:0, videos:0, circles:0, voices:0, stickers:0, links:0, files:0 };
    if (!responseTimes[sender]) responseTimes[sender] = [];
    const sd = senderMap[sender];
    sd.msgs++;

    const date = new Date(msg.date);
    if (!firstDate || date < firstDate) firstDate = date;
    if (!lastDate || date > lastDate) lastDate = date;
    byHour[date.getHours()]++;
    byWeekday[date.getDay()]++;
    const dk = date.toISOString().slice(0,10);
    byDay[dk] = (byDay[dk]||0) + 1;
    const mk = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
    if (!byMonth[mk]) byMonth[mk] = {};
    byMonth[mk][sender] = (byMonth[mk][sender]||0) + 1;
    if (!mediaByMonth[mk]) mediaByMonth[mk] = { photo:0, video:0, circle:0, voice:0, sticker:0, link:0 };

    // Response time: only after ≥30 min gap from different sender
    if (prevMsg && prevMsg.from !== sender) {
      const diff = (date - new Date(prevMsg.date)) / 1000;
      if (diff >= RESPONSE_GAP_MIN && diff <= RESPONSE_GAP_MAX) {
        responseTimes[sender].push(diff);
      }
    }
    prevMsg = msg;

    // Media
    const mt = msg.media_type || '';
    if (msg.photo) { sd.photos++; mPhoto++; mediaByMonth[mk].photo++; }
    else if (mt === 'video_message') {
      sd.circles++; mCircle++; mediaByMonth[mk].circle++;
      circleDuration += msg.duration_seconds || 0;
    }
    else if (mt === 'video_file') { sd.videos++; mVideo++; mediaByMonth[mk].video++; }
    else if (mt === 'voice_message') {
      sd.voices++; mVoice++; mediaByMonth[mk].voice++;
      voiceDuration += msg.duration_seconds || 0;
    }
    else if (mt === 'audio_file') { mAudio++; }
    else if (mt === 'sticker') { sd.stickers++; mSticker++; mediaByMonth[mk].sticker++; }
    else if (mt === 'animation' || mt === 'gif') { mGif++; }
    else if (msg.file && !mt) { sd.files++; mFile++; }

    const links = getLinks(msg);
    if (links.length) { sd.links += links.length; mLink += links.length; mediaByMonth[mk].link += links.length; }

    const text = getText(msg);
    if (text) {
      const len = text.length;
      sd.chars += len;
      if (len > longestMsg.len) longestMsg = { text: text.slice(0,120), len, sender, date: msg.date };
      if (len <= 50) lengthBuckets['1-50']++;
      else if (len <= 150) lengthBuckets['51-150']++;
      else if (len <= 300) lengthBuckets['151-300']++;
      else if (len <= 500) lengthBuckets['301-500']++;
      else lengthBuckets['500+']++;

      const words = text.toLowerCase().match(WORD_RE) || [];
      words.forEach(w => {
        if (!isStopWord(w)) {
          const nw = normalizeWord(w);
          if (!isStopWord(nw)) { wordFreq[nw] = (wordFreq[nw]||0) + 1; sd.words++; }
        }
      });

      const emojis = text.match(EMOJI_RE) || [];
      emojis.forEach(em => { emojiFreq[em] = (emojiFreq[em]||0) + 1; });
    }
  });

  const senders = Object.keys(senderMap).sort((a,b) => senderMap[b].msgs - senderMap[a].msgs);
  const sortedMonths = Object.keys(byMonth).sort();
  const totalDays = firstDate && lastDate ? Math.max(1, Math.round((lastDate-firstDate)/86400000)) : 1;
  const totalWords = Object.values(wordFreq).reduce((s,n) => s+n, 0);
  const bestDay = Object.entries(byDay).sort((a,b) => b[1]-a[1])[0] || ['—', 0];
  const topDays = Object.entries(byDay).sort((a,b) => b[1]-a[1]).slice(0,10);

  // Streak
  const dayKeys = Object.keys(byDay).sort();
  let maxStreak=0, cur=0, prevD=null;
  dayKeys.forEach(d => {
    const dd = new Date(d);
    if (prevD && (dd-prevD)/86400000 === 1) cur++; else cur = 1;
    if (cur > maxStreak) maxStreak = cur;
    prevD = dd;
  });

  const peakHour = byHour.indexOf(Math.max(...byHour));
  const peakWeekday = DAYS_UK[byWeekday.indexOf(Math.max(...byWeekday))];

  const topWords = Object.entries(wordFreq).sort((a,b) => b[1]-a[1]).slice(0,40);
  const topEmoji = Object.entries(emojiFreq).sort((a,b) => b[1]-a[1]).slice(0,20);

  const responseMedians = {};
  senders.forEach(s => {
    const arr = responseTimes[s].sort((a,b) => a-b);
    if (arr.length) {
      const m = Math.floor(arr.length/2);
      responseMedians[s] = arr.length % 2 ? arr[m] : (arr[m-1]+arr[m])/2;
    } else {
      responseMedians[s] = null;
    }
  });

  const avgChar = {};
  senders.forEach(s => { avgChar[s] = senderMap[s].msgs > 0 ? Math.round(senderMap[s].chars/senderMap[s].msgs) : 0; });

  return {
    chatName, chatType, isNotes,
    firstDate, lastDate, totalDays, totalWords,
    messages: msgs, totalMessages: msgs.length,
    senders, senderMap, byMonth, sortedMonths, byHour, byWeekday, byDay,
    mPhoto, mVideo, mCircle, mVoice, mAudio, mSticker, mFile, mLink, mGif,
    voiceDuration, circleDuration,
    mediaByMonth, lengthBuckets, topWords, topEmoji,
    bestDay, topDays, maxStreak, peakHour, peakWeekday,
    responseMedians, avgChar, longestMsg,
    calls,
    isGlobal: false,
  };
}

export function mergeStats(chatStats) {
  const allMessages = [];
  chatStats.forEach(cs => cs.messages.forEach(m => allMessages.push(m)));
  // also merge service messages for calls
  const allServices = [];
  chatStats.forEach(cs => {
    (cs.calls?.byActor ? [] : []).forEach(s => allServices.push(s));
  });

  const merged = analyzeChat({ name:'Всі чати', type:'merged', messages: allMessages });

  // Re-merge calls from all chats
  chatStats.forEach(cs => {
    merged.calls.total += cs.calls.total;
    merged.calls.hangup += cs.calls.hangup || 0;
    merged.calls.missed += cs.calls.missed || 0;
    merged.calls.busy += cs.calls.busy || 0;
    merged.calls.disconnect += cs.calls.disconnect || 0;
    merged.calls.totalDuration += cs.calls.totalDuration || 0;
    Object.entries(cs.calls.byActor || {}).forEach(([actor, data]) => {
      if (!merged.calls.byActor[actor]) merged.calls.byActor[actor] = { initiated:0, duration:0 };
      merged.calls.byActor[actor].initiated += data.initiated;
      merged.calls.byActor[actor].duration += data.duration;
    });
  });

  merged.chatName = 'Всі чати';
  merged.isGlobal = true;
  merged.totalChats = chatStats.length;
  return merged;
}

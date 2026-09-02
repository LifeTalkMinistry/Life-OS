function formatRestDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  if (totalSeconds < 60) return `${totalSeconds} sec`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  if (seconds === 0) return `${minutes} min`;
  return `${minutes}m ${seconds}s`;
}

function safeSessionBounds(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const start = Number(entry.startAt ?? entry.endedAt);
  if (!Number.isFinite(start)) return null;
  const explicitEnd = Number(entry.endedAt);
  const duration = Math.max(0, Number(entry.durationMs || entry.sessionDurationMs || 0));
  const end = Number.isFinite(explicitEnd) && explicitEnd >= start ? explicitEnd : start + duration;
  if (!Number.isFinite(end) || end < start) return null;
  return { start, end };
}

function safeManilaParts(stamp) {
  const date = new Date(Number(stamp) + 8 * 60 * 60 * 1000);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    weekday: date.getUTCDay()
  };
}

function safeManilaDayKey(stamp) {
  const parts = safeManilaParts(stamp);
  return `${parts.year}-${String(parts.month + 1).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function safeManilaDayStart(stamp) {
  const parts = safeManilaParts(stamp);
  return Date.UTC(parts.year, parts.month, parts.day) - 8 * 60 * 60 * 1000;
}

function safeDateLabel(stamp, now = Date.now()) {
  const parts = safeManilaParts(stamp);
  const todayStart = safeManilaDayStart(now);
  const stampStart = safeManilaDayStart(stamp);
  const dayOffset = Math.round((todayStart - stampStart) / 86_400_000);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return {
    weekday: weekdays[parts.weekday],
    date: `${months[parts.month]} ${parts.day}${dayOffset === 0 ? ' · Today' : dayOffset === 1 ? ' · Yesterday' : ''}`
  };
}

function safeHistoryStamp(stamp) {
  const parts = safeManilaParts(stamp);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hour12 = parts.hour % 12 || 12;
  const meridiem = parts.hour >= 12 ? 'PM' : 'AM';
  return `${months[parts.month]} ${parts.day}, ${hour12}:${String(parts.minute).padStart(2, '0')} ${meridiem}`;
}

function safeTimeOfDay(stamp) {
  const hour = safeManilaParts(stamp).hour;
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 22) return 'Evening';
  return 'Late night';
}

function safeRecentInsights(state, now = Date.now()) {
  const dayMs = 86_400_000;
  const todayStart = safeManilaDayStart(now);
  const currentStart = todayStart - 6 * dayMs;
  const previousStart = currentStart - 7 * dayMs;

  const days = Array.from({ length: 7 }, (_, index) => {
    const start = currentStart + index * dayMs;
    const labels = safeDateLabel(start, now);
    return { key: safeManilaDayKey(start), start, totalMs: 0, sessions: 0, ...labels };
  });
  const byKey = new Map(days.map((day) => [day.key, day]));

  const history = (Array.isArray(state?.history) ? state.history : [])
    .filter((entry) => entry && typeof entry === 'object')
    .slice(0, 500);

  let sessions = 0;
  let totalMs = 0;
  let longestMs = 0;
  let previousTotalMs = 0;
  const currentRestDays = new Set();
  const previousRestDays = new Set();
  const timeBuckets = new Map();

  const recentEntries = [];

  for (const entry of history) {
    const bounds = safeSessionBounds(entry);
    if (!bounds) continue;

    if (bounds.end >= previousStart && bounds.start < currentStart) {
      const overlap = Math.max(0, Math.min(bounds.end, currentStart) - Math.max(bounds.start, previousStart));
      if (overlap) {
        previousTotalMs += overlap;
        previousRestDays.add(safeManilaDayKey(Math.max(bounds.start, previousStart)));
      }
    }

    if (bounds.end < currentStart || bounds.start > now) continue;
    const creditedStart = Math.max(bounds.start, currentStart);
    const creditedEnd = Math.min(bounds.end, now);
    const duration = Math.max(0, creditedEnd - creditedStart);
    if (!duration) continue;

    sessions += 1;
    totalMs += duration;
    longestMs = Math.max(longestMs, duration);
    const dayKey = safeManilaDayKey(creditedStart);
    currentRestDays.add(dayKey);
    const day = byKey.get(dayKey);
    if (day) {
      day.totalMs += duration;
      day.sessions += 1;
    }

    const timeLabel = safeTimeOfDay(bounds.start);
    timeBuckets.set(timeLabel, (timeBuckets.get(timeLabel) || 0) + 1);
    recentEntries.push({ entry, bounds, duration });
  }

  recentEntries.sort((a, b) => b.bounds.end - a.bounds.end);
  const mostCommonTime = [...timeBuckets.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  return {
    sessions,
    totalMs,
    averageMs: sessions ? totalMs / sessions : 0,
    longestMs,
    restDays: currentRestDays.size,
    previousRestDays: previousRestDays.size,
    previousTotalMs,
    mostCommonTime,
    days,
    recentEntries: recentEntries.slice(0, 20)
  };
}

function safeEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeChangeCopy(value, noun) {
  if (value > 0) return `+${value} ${noun} vs last week`;
  if (value < 0) return `${Math.abs(value)} fewer ${noun} vs last week`;
  return `Same ${noun} as last week`;
}

function ensureSafeInsightsStyles() {
  if (document.querySelector('#pause-safe-insights-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-safe-insights-style';
  style.textContent = `
    .pause-safe-insights.pause-view-insights { max-height:min(84svh,780px); }
    .pause-safe-insights .pause-live-data-note { margin:-5px 0 14px; color:#746d7d; font-size:.6rem; font-weight:600; letter-spacing:.11em; text-transform:uppercase; }
    .pause-safe-insights .pause-live-data-note::before { content:''; display:inline-block; width:5px; height:5px; margin-right:7px; border-radius:50%; background:#a579ff; box-shadow:0 0 8px rgba(165,121,255,.5); vertical-align:1px; }
    .pause-safe-insights .pause-rhythm-hero { margin:4px 0 18px; padding:20px 18px; border:1px solid rgba(174,126,255,.2); border-radius:18px; background:linear-gradient(180deg,rgba(74,37,124,.13),rgba(17,10,33,.25)); text-align:center; }
    .pause-safe-insights .pause-rhythm-hero small,
    .pause-safe-insights .pause-insight-section-title { color:#92899d; font-size:.64rem; font-weight:650; letter-spacing:.14em; }
    .pause-safe-insights .pause-rhythm-value { display:block; margin-top:7px; color:#f3edf9; font-size:clamp(2rem,10vw,3rem); font-weight:360; line-height:1; letter-spacing:-.03em; }
    .pause-safe-insights .pause-rhythm-copy { margin:8px 0 0; color:#afa6b9; font-size:.74rem; line-height:1.45; }
    .pause-safe-insights .pause-detailed-grid { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
    .pause-safe-insights .pause-detailed-grid article { min-width:0; padding:14px; border:1px solid rgba(155,120,219,.14); border-radius:13px; background:rgba(16,11,33,.38); display:grid; gap:7px; }
    .pause-safe-insights .pause-detailed-grid small { color:#898190; font-size:.59rem; letter-spacing:.1em; }
    .pause-safe-insights .pause-detailed-grid strong { color:#eee8f4; font-size:1.12rem; font-weight:430; }
    .pause-safe-insights .pause-insight-section { margin-top:24px; }
    .pause-safe-insights .pause-insight-section-title { margin:0 0 12px; }
    .pause-safe-insights .pause-insight-section-copy { margin:-6px 0 13px; color:#7f7788; font-size:.66rem; line-height:1.45; }
    .pause-safe-insights .pause-rhythm-days { display:grid; gap:6px; }
    .pause-safe-insights .pause-rhythm-day { display:grid; grid-template-columns:68px 1fr 72px; align-items:center; gap:10px; min-width:0; min-height:48px; padding:6px 4px; color:#a79fac; font-size:.69rem; }
    .pause-safe-insights .pause-rhythm-day-label { min-width:0; display:grid; gap:2px; }
    .pause-safe-insights .pause-rhythm-day-label strong { overflow:hidden; color:#c7bfce; font-size:.69rem; font-weight:520; text-overflow:ellipsis; white-space:nowrap; }
    .pause-safe-insights .pause-rhythm-day-label small { color:#706978; font-size:.57rem; letter-spacing:.02em; }
    .pause-safe-insights .pause-rhythm-track { height:5px; overflow:hidden; border-radius:999px; background:rgba(151,119,201,.1); }
    .pause-safe-insights .pause-rhythm-fill { display:block; height:100%; min-width:0; border-radius:inherit; background:linear-gradient(90deg,rgba(104,91,255,.8),rgba(210,88,221,.88)); box-shadow:0 0 10px rgba(154,91,255,.18); }
    .pause-safe-insights .pause-rhythm-day-tail { display:flex; align-items:center; justify-content:flex-end; gap:7px; min-width:0; }
    .pause-safe-insights .pause-rhythm-duration { color:#c1b7cb; white-space:nowrap; }
    .pause-safe-insights .pause-pattern-row { display:flex; justify-content:space-between; gap:14px; padding:12px 0; border-bottom:1px solid rgba(153,124,202,.11); }
    .pause-safe-insights .pause-pattern-row:last-child { border-bottom:0; }
    .pause-safe-insights .pause-pattern-row span { color:#91899b; font-size:.72rem; }
    .pause-safe-insights .pause-pattern-row strong { color:#ddd5e6; font-size:.76rem; font-weight:520; text-align:right; }
    .pause-safe-insights .pause-history-list { display:grid; }
    .pause-safe-insights .pause-history-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:13px 2px; border-bottom:1px solid rgba(153,124,202,.11); }
    .pause-safe-insights .pause-history-row-main { min-width:0; display:grid; gap:4px; }
    .pause-safe-insights .pause-history-row-main strong { overflow:hidden; color:#e8e2ee; font-size:.84rem; font-weight:500; text-overflow:ellipsis; white-space:nowrap; }
    .pause-safe-insights .pause-history-row-main small { color:#837b8b; font-size:.68rem; }
    .pause-safe-insights .pause-history-duration { color:#b792f4; font-size:.74rem; white-space:nowrap; }
    .pause-safe-insights .pause-weekday-learning { padding:17px 16px; border:1px solid rgba(164,121,226,.15); border-radius:15px; background:rgba(20,12,40,.34); }
    .pause-safe-insights .pause-weekday-learning strong { display:block; margin-bottom:7px; color:#dcd3e7; font-size:.8rem; font-weight:540; letter-spacing:.04em; }
    .pause-safe-insights .pause-weekday-learning p { margin:0; color:#8f8798; font-size:.72rem; line-height:1.55; }
    .pause-safe-insights .pause-weekday-progress { display:flex; gap:14px; margin-top:12px; color:#a496b3; font-size:.66rem; }
    .pause-safe-insights .pause-insight-note { margin:22px 0 2px; color:#8f8798; font-size:.75rem; line-height:1.5; text-align:center; }
    .pause-safe-insights .pause-empty { color:#8f8798; font-size:.75rem; line-height:1.5; }
    @media (max-width:390px) {
      .pause-safe-insights .pause-rhythm-day { grid-template-columns:62px 1fr 68px; gap:8px; }
      .pause-safe-insights .pause-history-row { align-items:flex-start; }
    }
  `;
  document.head.appendChild(style);
}

function safeInsightsMarkup(insights) {
  const maxDaily = Math.max(1, ...insights.days.map((day) => day.totalMs));
  const dailyRows = insights.days.map((day) => {
    const width = day.totalMs > 0 ? Math.max(7, Math.round((day.totalMs / maxDaily) * 100)) : 0;
    return `
      <div class="pause-rhythm-day">
        <div class="pause-rhythm-day-label">
          <strong>${safeEscape(day.weekday)}</strong>
          <small>${safeEscape(day.date)}</small>
        </div>
        <div class="pause-rhythm-track" aria-hidden="true"><span class="pause-rhythm-fill" style="width:${width}%"></span></div>
        <span class="pause-rhythm-day-tail"><span class="pause-rhythm-duration">${day.totalMs ? safeEscape(formatRestDuration(day.totalMs)) : '—'}</span></span>
      </div>
    `;
  }).join('');

  const historyRows = insights.recentEntries.map(({ entry, bounds, duration }) => `
    <div class="pause-history-row">
      <div class="pause-history-row-main">
        <strong>${safeEscape(entry.label || 'Rest')}</strong>
        <small>${safeEscape(safeHistoryStamp(bounds.end))} · Manila${entry.manuallyEdited || entry.editedAt ? ' · Edited' : ''}</small>
      </div>
      <span class="pause-history-duration">${safeEscape(formatRestDuration(duration))}</span>
    </div>
  `).join('');

  const restDayChange = insights.restDays - insights.previousRestDays;
  const timeChange = insights.totalMs - insights.previousTotalMs;
  const calendarProgress = Math.min(7, insights.restDays + (7 - insights.restDays));
  const restDayProgress = Math.min(insights.restDays, 4);

  return `
    <section class="pause-rhythm-hero">
      <small>REST RHYTHM · LAST 7 CALENDAR DAYS</small>
      <strong class="pause-rhythm-value">${insights.restDays} / 7</strong>
      <p class="pause-rhythm-copy">days with at least one intentional pause</p>
    </section>

    <div class="pause-detailed-grid">
      <article><small>TOTAL REST</small><strong>${safeEscape(formatRestDuration(insights.totalMs))}</strong></article>
      <article><small>PAUSES</small><strong>${insights.sessions}</strong></article>
      <article><small>AVERAGE REST</small><strong>${safeEscape(formatRestDuration(insights.averageMs))}</strong></article>
      <article><small>LONGEST REST</small><strong>${safeEscape(formatRestDuration(insights.longestMs))}</strong></article>
    </div>

    <section class="pause-insight-section">
      <p class="pause-insight-section-title">YOUR 7-DAY RHYTHM</p>
      <p class="pause-insight-section-copy">Your completed rests across the last seven Manila calendar days.</p>
      <div class="pause-rhythm-days">${dailyRows}</div>
    </section>

    <section class="pause-insight-section">
      <p class="pause-insight-section-title">YOUR REST PATTERN · BY WEEKDAY</p>
      <p class="pause-insight-section-copy">PAUSE will bring back weekday ranking after the safe Rest Insights foundation has enough stable history.</p>
      <div class="pause-weekday-learning">
        <strong>LEARNING YOUR REST PATTERN</strong>
        <p>Keep using the ORB and PAUSE will learn which days you consistently make the most room to stop.</p>
        <div class="pause-weekday-progress"><span>${calendarProgress} / 14 days observed</span><span>${restDayProgress} / 4 rest days</span></div>
      </div>
    </section>

    <section class="pause-insight-section">
      <p class="pause-insight-section-title">PATTERN</p>
      <div class="pause-pattern-row"><span>You pause most often</span><strong>${safeEscape(insights.mostCommonTime)}</strong></div>
      <div class="pause-pattern-row"><span>Rest-day consistency</span><strong>${safeEscape(safeChangeCopy(restDayChange, 'rest days'))}</strong></div>
      <div class="pause-pattern-row"><span>Compared with last week</span><strong>${timeChange === 0 ? 'Same rest time' : `${timeChange > 0 ? '+' : '−'}${safeEscape(formatRestDuration(Math.abs(timeChange)))}`}</strong></div>
    </section>

    <section class="pause-insight-section">
      <p class="pause-insight-section-title">RECENT RESTS</p>
      <p class="pause-insight-section-copy">Your most recent completed rests recorded by PAUSE.</p>
      <div class="pause-history-list">${historyRows || '<p class="pause-empty">No rests yet. Tap the ORB when you decide to stop.</p>'}</div>
    </section>

    <p class="pause-insight-note">PAUSE reflects your recorded rest behavior. It doesn't grade or judge it.</p>
  `;
}

export function RestInsightsSafePanel({ state, onClose }) {
  ensureSafeInsightsStyles();

  const backdrop = document.createElement('div');
  backdrop.className = 'system-backdrop pause-backdrop';

  const panel = document.createElement('section');
  panel.className = 'system-panel pause-panel pause-view-insights pause-safe-insights';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Rest Insights');

  const header = document.createElement('div');
  header.className = 'system-panel-header';
  header.innerHTML = `
    <div class="pause-panel-heading">
      <div>
        <p class="system-panel-eyebrow">PAUSE</p>
        <h2>Rest Insights</h2>
      </div>
    </div>
  `;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'system-panel-close';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '×';
  close.addEventListener('click', () => onClose?.());
  header.appendChild(close);

  const intro = document.createElement('p');
  intro.className = 'system-panel-intro';
  intro.textContent = "Understand how consistently you're actually giving yourself permission to stop.";

  const live = document.createElement('p');
  live.className = 'pause-live-data-note';
  live.textContent = 'Calculated from your completed rests';

  const content = document.createElement('div');
  content.className = 'pause-audit-empty';
  content.textContent = 'Loading Rest Insights…';

  panel.append(header, intro, live, content);
  backdrop.appendChild(panel);

  setTimeout(() => {
    if (!panel.isConnected) return;
    try {
      const insights = safeRecentInsights(state);
      content.className = '';
      content.innerHTML = safeInsightsMarkup(insights);
    } catch {
      content.className = 'pause-audit-empty';
      content.textContent = 'Rest Insights could not load this section yet.';
    }
  }, 60);

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) onClose?.();
  });

  return backdrop;
}

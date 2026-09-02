function formatRestDuration(ms) {
  const totalMinutes = Math.max(0, Math.round(Number(ms || 0) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}m`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function safeSessionBounds(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const start = Number(entry.startAt ?? entry.endedAt);
  if (!Number.isFinite(start)) return null;
  const explicitEnd = Number(entry.endedAt);
  const duration = Math.max(0, Number(entry.durationMs || 0));
  const end = Number.isFinite(explicitEnd) && explicitEnd >= start ? explicitEnd : start + duration;
  if (!Number.isFinite(end) || end < start) return null;
  return { start, end };
}

function manilaDayKey(stamp) {
  const date = new Date(Number(stamp) + 8 * 60 * 60 * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function recentSevenDaySummary(state, now = Date.now()) {
  const dayMs = 24 * 60 * 60 * 1000;
  const todayStartManila = (() => {
    const shifted = new Date(now + 8 * 60 * 60 * 1000);
    return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 8 * 60 * 60 * 1000;
  })();
  const windowStart = todayStartManila - 6 * dayMs;
  const windowEnd = now;
  const days = Array.from({ length: 7 }, (_, index) => {
    const start = windowStart + index * dayMs;
    return { key: manilaDayKey(start), totalMs: 0, sessions: 0 };
  });
  const byKey = new Map(days.map((day) => [day.key, day]));

  let sessions = 0;
  let totalMs = 0;
  let longestMs = 0;

  for (const entry of Array.isArray(state?.history) ? state.history.slice(0, 500) : []) {
    const bounds = safeSessionBounds(entry);
    if (!bounds || bounds.end < windowStart || bounds.start > windowEnd) continue;
    const creditedStart = Math.max(bounds.start, windowStart);
    const creditedEnd = Math.min(bounds.end, windowEnd);
    const duration = Math.max(0, creditedEnd - creditedStart);
    if (!duration) continue;

    sessions += 1;
    totalMs += duration;
    longestMs = Math.max(longestMs, duration);

    const day = byKey.get(manilaDayKey(creditedStart));
    if (day) {
      day.totalMs += duration;
      day.sessions += 1;
    }
  }

  return { sessions, totalMs, longestMs, days };
}

function ensureSafeInsightsStyles() {
  if (document.querySelector('#pause-safe-insights-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-safe-insights-style';
  style.textContent = `
    .pause-safe-insights-summary { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin:14px 0 18px; }
    .pause-safe-insights-stat { padding:13px 8px; border:1px solid rgba(170,128,237,.14); border-radius:14px; background:rgba(93,56,151,.07); text-align:center; }
    .pause-safe-insights-stat strong { display:block; color:#eee8f4; font-size:.98rem; font-weight:520; }
    .pause-safe-insights-stat span { display:block; margin-top:5px; color:#817889; font-size:.55rem; letter-spacing:.08em; }
    .pause-safe-insights-days { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:6px; align-items:end; min-height:118px; margin-top:12px; }
    .pause-safe-insights-day { display:grid; gap:7px; justify-items:center; min-width:0; }
    .pause-safe-insights-bar-track { width:100%; height:78px; display:flex; align-items:flex-end; border-radius:8px; overflow:hidden; background:rgba(135,100,188,.08); }
    .pause-safe-insights-bar { width:100%; min-height:2px; border-radius:8px 8px 0 0; background:linear-gradient(180deg,rgba(186,129,255,.88),rgba(99,78,214,.7)); }
    .pause-safe-insights-day small { color:#756d7d; font-size:.52rem; }
    .pause-safe-insights-section-title { margin:0; color:#cfc4d8; font-size:.68rem; font-weight:650; letter-spacing:.1em; }
    @media (max-width:380px) { .pause-safe-insights-summary { grid-template-columns:1fr 1fr; } .pause-safe-insights-stat:first-child { grid-column:1 / -1; } }
  `;
  document.head.appendChild(style);
}

export function RestInsightsSafePanel({ state, onClose }) {
  ensureSafeInsightsStyles();

  const backdrop = document.createElement('div');
  backdrop.className = 'system-backdrop pause-backdrop';

  const panel = document.createElement('section');
  panel.className = 'system-panel pause-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Rest Insights');

  const header = document.createElement('div');
  header.className = 'system-panel-header';

  const title = document.createElement('h2');
  title.textContent = 'Rest Insights';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'system-panel-close';
  close.setAttribute('aria-label', 'Close Rest Insights');
  close.textContent = '×';
  close.addEventListener('click', () => onClose?.());

  header.append(title, close);

  const intro = document.createElement('p');
  intro.className = 'system-panel-intro';
  intro.textContent = 'Your recorded Rest from the last 7 days.';

  const content = document.createElement('div');
  content.className = 'pause-audit-empty';
  content.textContent = 'Loading Rest Insights…';

  panel.append(header, intro, content);
  backdrop.appendChild(panel);

  setTimeout(() => {
    if (!panel.isConnected) return;
    try {
      const summary = recentSevenDaySummary(state);
      const maxDaily = Math.max(1, ...summary.days.map((day) => day.totalMs));
      const dayMarkup = summary.days.map((day) => {
        const height = Math.max(2, Math.round((day.totalMs / maxDaily) * 100));
        const label = day.key.slice(5).replace('-', '/');
        return `
          <div class="pause-safe-insights-day" aria-label="${label}: ${formatRestDuration(day.totalMs)}">
            <div class="pause-safe-insights-bar-track"><span class="pause-safe-insights-bar" style="height:${height}%"></span></div>
            <small>${label}</small>
          </div>
        `;
      }).join('');

      content.className = '';
      content.innerHTML = `
        <div class="pause-safe-insights-summary">
          <div class="pause-safe-insights-stat"><strong>${formatRestDuration(summary.totalMs)}</strong><span>TOTAL REST</span></div>
          <div class="pause-safe-insights-stat"><strong>${summary.sessions}</strong><span>SESSIONS</span></div>
          <div class="pause-safe-insights-stat"><strong>${formatRestDuration(summary.longestMs)}</strong><span>LONGEST</span></div>
        </div>
        <p class="pause-safe-insights-section-title">LAST 7 DAYS</p>
        <div class="pause-safe-insights-days">${dayMarkup}</div>
      `;
    } catch (error) {
      content.className = 'pause-audit-empty';
      content.textContent = 'Rest Insights could not load this section yet.';
    }
  }, 60);

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) onClose?.();
  });

  return backdrop;
}

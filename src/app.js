import { Brand } from './components/Brand.js';
import { OrbArtwork } from './components/OrbArtwork.js';

const app = document.querySelector('#app');
const STORAGE_KEY = 'life-os-tracker-v1';
const INTRO_KEY = 'life-os-tracker-intro-seen';
const MIN_GAP_MS = 15 * 60 * 1000;

const PRESETS = [
  ['Work', 'Responsibility'],
  ['Sleep', 'Sleep / Recovery'],
  ['Workout', 'Health'],
  ['Family', 'Relationships / Family'],
  ['Friends', 'Relationships / Family'],
  ['Devotion', 'Faith / Meaning'],
  ['Church', 'Faith / Meaning'],
  ['Project', 'Purpose / Projects'],
  ['Learning', 'Growth / Learning'],
  ['Entertainment', 'Recreation / Enjoyment']
];

const DOMAINS = [
  'Sleep / Recovery',
  'Responsibility',
  'Health',
  'Relationships / Family',
  'Faith / Meaning',
  'Growth / Learning',
  'Purpose / Projects',
  'Recreation / Enjoyment',
  'Other'
];

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix = 'item') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultState() {
  return {
    sessions: [],
    active: null,
    customActivities: [],
    gapLabels: {}
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      active: parsed.active && parsed.active.startedAt ? parsed.active : null,
      customActivities: Array.isArray(parsed.customActivities) ? parsed.customActivities : [],
      gapLabels: parsed.gapLabels && typeof parsed.gapLabels === 'object' ? parsed.gapLabels : {}
    };
  } catch {
    return defaultState();
  }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

let state = loadState();
let screen = 'launch';
let overlay = null;
let analyticsPeriod = 'day';
let ticker = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatTimer(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

function formatClock(iso) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

function periodStart(period) {
  const d = new Date();
  if (period === 'day') d.setHours(0, 0, 0, 0);
  if (period === 'week') {
    const day = d.getDay();
    const delta = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - delta);
    d.setHours(0, 0, 0, 0);
  }
  if (period === 'month') {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
  }
  return d.getTime();
}

function sessionEndMs(session) {
  return session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
}

function sessionsForPeriod(period) {
  const start = periodStart(period);
  const completed = state.sessions.filter((s) => sessionEndMs(s) >= start);
  if (!state.active) return completed;
  return [...completed, { ...state.active, endedAt: nowIso(), live: true }];
}

function summarizeByActivity(period) {
  const map = new Map();
  sessionsForPeriod(period).forEach((session) => {
    const start = Math.max(new Date(session.startedAt).getTime(), periodStart(period));
    const duration = Math.max(0, sessionEndMs(session) - start);
    const key = session.name || 'Other';
    const current = map.get(key) || { name: key, domain: session.domain || 'Other', duration: 0 };
    current.duration += duration;
    map.set(key, current);
  });
  return [...map.values()].sort((a, b) => b.duration - a.duration);
}

function summarizeByDomain(period) {
  const map = new Map(DOMAINS.map((domain) => [domain, 0]));
  sessionsForPeriod(period).forEach((session) => {
    const start = Math.max(new Date(session.startedAt).getTime(), periodStart(period));
    const duration = Math.max(0, sessionEndMs(session) - start);
    const domain = DOMAINS.includes(session.domain) ? session.domain : 'Other';
    map.set(domain, (map.get(domain) || 0) + duration);
  });
  return [...map.entries()].map(([name, duration]) => ({ name, duration })).filter((item) => item.duration > 0).sort((a, b) => b.duration - a.duration);
}

function todaySessions() {
  const start = periodStart('day');
  return state.sessions
    .filter((s) => new Date(s.endedAt || s.startedAt).getTime() >= start)
    .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
}

function gapId(start, end) {
  return `${new Date(start).toISOString()}_${new Date(end).toISOString()}`;
}

function findTodayGaps() {
  const sessions = todaySessions();
  const gaps = [];
  for (let i = 1; i < sessions.length; i += 1) {
    const previousEnd = new Date(sessions[i - 1].endedAt).getTime();
    const nextStart = new Date(sessions[i].startedAt).getTime();
    if (nextStart - previousEnd >= MIN_GAP_MS) {
      const id = gapId(previousEnd, nextStart);
      gaps.push({ id, start: previousEnd, end: nextStart, duration: nextStart - previousEnd, label: state.gapLabels[id] || null });
    }
  }
  const last = sessions[sessions.length - 1];
  if (last && !state.active) {
    const lastEnd = new Date(last.endedAt).getTime();
    if (Date.now() - lastEnd >= 30 * 60 * 1000) {
      const id = gapId(lastEnd, Date.now());
      gaps.push({ id, start: lastEnd, end: Date.now(), duration: Date.now() - lastEnd, label: state.gapLabels[id] || null, liveGap: true });
    }
  }
  return gaps;
}

function startActivity(name, domain) {
  if (state.active) stopActivity();
  state.active = { id: uid('session'), name: name.trim().slice(0, 48), domain, startedAt: nowIso() };
  saveState();
  overlay = null;
  render();
}

function stopActivity() {
  if (!state.active) return;
  const endedAt = nowIso();
  const session = { ...state.active, endedAt };
  state.sessions.push(session);
  state.active = null;
  saveState();
  overlay = { type: 'complete', session };
  render();
}

function addCustomActivity(name, domain = 'Other') {
  const clean = name.trim().slice(0, 48);
  if (!clean) return;
  const existing = state.customActivities.find((item) => item.name.toLowerCase() === clean.toLowerCase());
  if (!existing) state.customActivities.push({ id: uid('activity'), name: clean, domain });
  saveState();
  startActivity(clean, existing?.domain || domain);
}

function relabelGap(gap, label, domain = 'Other') {
  const existingId = gap.id;
  if (gap.liveGap) {
    const stableId = gapId(gap.start, Date.now());
    state.gapLabels[stableId] = label;
  } else {
    state.gapLabels[existingId] = label;
  }
  if (label !== 'Untracked') {
    state.sessions.push({
      id: uid('gap'),
      name: label,
      domain,
      startedAt: new Date(gap.start).toISOString(),
      endedAt: new Date(gap.end).toISOString(),
      retroactive: true
    });
  }
  saveState();
  render();
}

function LaunchScreen() {
  const view = document.createElement('section');
  view.className = 'screen launch-screen';
  return view;
}

function IntroOverlay() {
  const wrap = document.createElement('div');
  wrap.className = 'tracker-intro';
  wrap.innerHTML = `
    <div class="tracker-intro-card">
      <div class="tracker-intro-mark" aria-hidden="true"></div>
      <h1>See where your life is going.</h1>
      <p>Track what you do. LIFE OS turns your actual time into a clear picture of how your life is being distributed.</p>
      <button class="tracker-enter" type="button">ENTER LIFE OS</button>
    </div>`;
  wrap.querySelector('.tracker-enter').addEventListener('click', () => {
    try { localStorage.setItem(INTRO_KEY, '1'); } catch {}
    overlay = null;
    render();
  });
  return wrap;
}

function OrbView() {
  const shell = document.createElement('div');
  shell.className = 'tracker-orb-shell';
  shell.appendChild(OrbArtwork());

  const button = document.createElement('button');
  button.className = 'tracker-orb';
  button.type = 'button';
  button.setAttribute('aria-label', state.active ? `Stop ${state.active.name}` : 'Start an activity');

  if (state.active) {
    button.innerHTML = `
      <div class="tracker-orb-content">
        <p class="tracker-kicker">RUNNING NOW</p>
        <h1 class="tracker-title">${escapeHtml(state.active.name)}</h1>
        <p class="tracker-timer" data-live-timer>${formatTimer(Date.now() - new Date(state.active.startedAt).getTime())}</p>
        <p class="tracker-sub">Tap when you finish.</p>
      </div>`;
    button.addEventListener('click', stopActivity);
  } else {
    button.innerHTML = `
      <div class="tracker-orb-content">
        <p class="tracker-kicker">LIFE OS</p>
        <h1 class="tracker-title">What are you doing?</h1>
        <p class="tracker-sub">Tap to start tracking.</p>
      </div>`;
    button.addEventListener('click', () => { overlay = { type: 'choose' }; render(); });
  }
  shell.appendChild(button);
  return shell;
}

function MainScreen() {
  const view = document.createElement('section');
  view.className = 'tracker-screen';
  view.appendChild(Brand());

  const stage = document.createElement('div');
  stage.className = 'tracker-stage';
  stage.appendChild(OrbView());
  view.appendChild(stage);

  const bottom = document.createElement('div');
  bottom.className = 'tracker-bottom';
  const gaps = findTodayGaps().filter((gap) => !gap.label);
  bottom.innerHTML = `
    <button type="button" class="tracker-pill" data-bottom="analytics">HOLISTIC LIFE</button>
    ${gaps.length ? `<button type="button" class="tracker-pill" data-bottom="gaps">${gaps.length} UNTRACKED</button>` : ''}
  `;
  bottom.querySelector('[data-bottom="analytics"]')?.addEventListener('click', () => { overlay = { type: 'analytics' }; render(); });
  bottom.querySelector('[data-bottom="gaps"]')?.addEventListener('click', () => { overlay = { type: 'gaps' }; render(); });
  view.appendChild(bottom);

  return view;
}

function Sheet(title, subtitle = '') {
  const shade = document.createElement('div');
  shade.className = 'tracker-overlay';
  shade.innerHTML = `
    <section class="tracker-sheet" role="dialog" aria-modal="true">
      <header class="tracker-sheet-header">
        <div><h2>${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div>
        <button class="tracker-close" type="button" aria-label="Close">×</button>
      </header>
      <div data-sheet-body></div>
    </section>`;
  shade.querySelector('.tracker-close').addEventListener('click', () => { overlay = null; render(); });
  shade.addEventListener('click', (event) => {
    if (event.target === shade) { overlay = null; render(); }
  });
  return shade;
}

function ChooseOverlay() {
  const shade = Sheet('Start an activity', 'What are you doing right now?');
  const body = shade.querySelector('[data-sheet-body]');
  const choices = document.createElement('div');
  choices.className = 'tracker-choices';

  [...PRESETS.map(([name, domain]) => ({ name, domain })), ...state.customActivities].forEach((item) => {
    const button = document.createElement('button');
    button.className = 'tracker-choice';
    button.type = 'button';
    button.innerHTML = `<strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.domain)}</span>`;
    button.addEventListener('click', () => startActivity(item.name, item.domain));
    choices.appendChild(button);
  });

  const custom = document.createElement('div');
  custom.className = 'tracker-custom';
  custom.innerHTML = `<input class="tracker-input" maxlength="48" placeholder="Something else…" aria-label="Custom activity"><button class="tracker-add" type="button">Start</button>`;
  custom.querySelector('.tracker-add').addEventListener('click', () => addCustomActivity(custom.querySelector('input').value));
  custom.querySelector('input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') addCustomActivity(event.currentTarget.value);
  });
  choices.appendChild(custom);
  body.appendChild(choices);
  return shade;
}

function CompleteOverlay(session) {
  const duration = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
  const shade = Sheet('Activity recorded', `${session.name} · ${formatDuration(duration)}`);
  const body = shade.querySelector('[data-sheet-body]');
  body.innerHTML = `
    <div class="metric-hero">
      <p class="metric-eyebrow">ACTUAL TIME</p>
      <h3>${escapeHtml(formatClock(session.startedAt))} — ${escapeHtml(formatClock(session.endedAt))}</h3>
      <p>LIFE OS is building your real activity history. The more you track, the clearer your Holistic Life picture becomes.</p>
    </div>`;
  return shade;
}

function AnalyticsOverlay() {
  const shade = Sheet('Holistic Life', 'See how your actual time is being distributed. Balance does not mean equal time.');
  const body = shade.querySelector('[data-sheet-body]');
  body.innerHTML = `
    <div class="analytics-tabs">
      <button class="analytics-tab ${analyticsPeriod === 'day' ? 'is-active' : ''}" data-period="day">TODAY</button>
      <button class="analytics-tab ${analyticsPeriod === 'week' ? 'is-active' : ''}" data-period="week">WEEK</button>
      <button class="analytics-tab ${analyticsPeriod === 'month' ? 'is-active' : ''}" data-period="month">MONTH</button>
    </div>`;

  body.querySelectorAll('[data-period]').forEach((button) => button.addEventListener('click', () => {
    analyticsPeriod = button.dataset.period;
    render();
  }));

  const domains = summarizeByDomain(analyticsPeriod);
  const activities = summarizeByActivity(analyticsPeriod);
  const total = domains.reduce((sum, item) => sum + item.duration, 0);
  const dominant = domains[0];
  const hero = document.createElement('div');
  hero.className = 'metric-hero';
  hero.innerHTML = total
    ? `<p class="metric-eyebrow">HOLISTIC LIFE METRIC</p><h3>${escapeHtml(dominant.name)} currently receives the most tracked time.</h3><p>${formatDuration(total)} tracked in this period. LIFE OS looks for chronic imbalance, not mathematical equality.</p>`
    : `<p class="metric-eyebrow">HOLISTIC LIFE METRIC</p><h3>Your picture is still forming.</h3><p>Start tracking activities and LIFE OS will show where your time is actually going.</p>`;
  body.appendChild(hero);

  if (domains.length) {
    const list = document.createElement('div');
    list.className = 'metric-list';
    domains.forEach((item) => {
      const pct = total ? Math.max(3, Math.round((item.duration / total) * 100)) : 0;
      const row = document.createElement('div');
      row.className = 'metric-row';
      row.innerHTML = `<span class="metric-name">${escapeHtml(item.name)}</span><span class="metric-time">${escapeHtml(formatDuration(item.duration))}</span><span class="metric-bar"><i style="width:${pct}%"></i></span>`;
      list.appendChild(row);
    });
    body.appendChild(list);
  }

  if (activities.length) {
    const note = document.createElement('div');
    note.className = 'untracked-note';
    note.innerHTML = `<strong>Most time:</strong> ${escapeHtml(activities[0].name)} — ${escapeHtml(formatDuration(activities[0].duration))}.`;
    body.appendChild(note);
  }

  const gaps = findTodayGaps().filter((gap) => !gap.label);
  if (analyticsPeriod === 'day' && gaps.length) {
    const untracked = gaps.reduce((sum, gap) => sum + gap.duration, 0);
    const note = document.createElement('div');
    note.className = 'untracked-note';
    note.innerHTML = `<strong>${escapeHtml(formatDuration(untracked))} is untracked today.</strong> Untracked time is unknown, not automatically wasted. Review it to make today's picture clearer.`;
    note.addEventListener('click', () => { overlay = { type: 'gaps' }; render(); });
    body.appendChild(note);
  }
  return shade;
}

function GapsOverlay() {
  const shade = Sheet('Untracked time', 'LIFE OS noticed gaps in today. What were you doing?');
  const body = shade.querySelector('[data-sheet-body]');
  const gaps = findTodayGaps().filter((gap) => !gap.label);

  if (!gaps.length) {
    body.innerHTML = `<div class="metric-hero"><h3>Nothing to review.</h3><p>Your detected gaps are already classified.</p></div>`;
    return shade;
  }

  gaps.forEach((gap) => {
    const card = document.createElement('div');
    card.className = 'gap-card';
    card.innerHTML = `
      <strong>${escapeHtml(formatClock(gap.start))} — ${escapeHtml(formatClock(gap.end))} · ${escapeHtml(formatDuration(gap.duration))}</strong>
      <p>Did you do something, watch something, talk to someone, rest, or leave this unknown?</p>
      <div class="gap-actions"></div>`;
    const actions = card.querySelector('.gap-actions');
    [
      ['Rest / Sleep', 'Sleep / Recovery'],
      ['Friends / Social', 'Relationships / Family'],
      ['Entertainment', 'Recreation / Enjoyment'],
      ['Travel / Errand', 'Responsibility'],
      ['Other activity', 'Other'],
      ['Untracked', 'Other']
    ].forEach(([label, domain]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => relabelGap(gap, label, domain));
      actions.appendChild(button);
    });
    body.appendChild(card);
  });
  return shade;
}

function renderOverlay() {
  if (!overlay) return null;
  if (overlay.type === 'intro') return IntroOverlay();
  if (overlay.type === 'choose') return ChooseOverlay();
  if (overlay.type === 'complete') return CompleteOverlay(overlay.session);
  if (overlay.type === 'analytics') return AnalyticsOverlay();
  if (overlay.type === 'gaps') return GapsOverlay();
  return null;
}

function render() {
  clearInterval(ticker);
  if (screen === 'launch') {
    app.replaceChildren(LaunchScreen());
    return;
  }
  const main = MainScreen();
  const layer = renderOverlay();
  app.replaceChildren(layer ? [main, layer] : [main]);
  if (state.active) {
    ticker = setInterval(() => {
      const timer = document.querySelector('[data-live-timer]');
      if (timer && state.active) timer.textContent = formatTimer(Date.now() - new Date(state.active.startedAt).getTime());
    }, 1000);
  }
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && overlay) {
    overlay = null;
    render();
  }
});

render();
setTimeout(() => {
  screen = 'tracker';
  let seen = false;
  try { seen = localStorage.getItem(INTRO_KEY) === '1'; } catch {}
  if (!seen) overlay = { type: 'intro' };
  render();
}, 1100);

window.__LIFE_OS__ = {
  getState: () => ({ ...state, screen, overlay, analyticsPeriod }),
  startActivity,
  stopActivity,
  openAnalytics: () => { overlay = { type: 'analytics' }; render(); },
  resetTracker: () => {
    try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(INTRO_KEY); } catch {}
    state = defaultState();
    overlay = { type: 'intro' };
    screen = 'tracker';
    render();
  }
};

const PAUSE_THIEF_STORAGE_KEY = 'pause-recovery-thief-v1';
const PAUSE_THIEF_MIN_DELAY_MINUTES = 15;
const PAUSE_THIEF_PROMPT_WINDOW_MINUTES = 120;
const PAUSE_THIEF_LOOKAROUND_DAYS = 3;
const PAUSE_THIEF_QUICK_OPTIONS = [
  'Scrolling',
  'Gaming',
  'Streaming',
  'Food',
  'Overtime',
  'Family',
  'Errands',
  'Couldn’t Sleep'
];
const PAUSE_THIEF_MORE_OPTIONS = [
  'Commute',
  'Work',
  'Social Activity',
  'Study',
  'Second Job',
  'Other'
];

let pauseThiefOverlay = null;
let pauseThiefMoreOpen = false;
let pauseThiefQueued = false;

function pauseThiefTimeToMinutes(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

function pauseThiefDayStart(date, offsetDays = 0) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + offsetDays,
    0,
    0,
    0,
    0
  );
}

function pauseThiefDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function pauseThiefNormalizeDays(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
}

function pauseThiefNormalizePlan(rawPlan = {}) {
  const shiftStartMinutes = pauseThiefTimeToMinutes(rawPlan.shiftStart);
  const shiftEndMinutes = pauseThiefTimeToMinutes(rawPlan.shiftEnd);
  const sleepStartMinutes = pauseThiefTimeToMinutes(rawPlan.sleepStart);
  return {
    setupComplete: rawPlan.setupComplete === true,
    workDays: pauseThiefNormalizeDays(rawPlan.workDays),
    shiftStart: shiftStartMinutes === null ? '22:00' : String(rawPlan.shiftStart),
    shiftEnd: shiftEndMinutes === null ? '08:00' : String(rawPlan.shiftEnd),
    sleepStart: sleepStartMinutes === null ? '' : String(rawPlan.sleepStart)
  };
}

function pauseThiefCycleForWorkDay(plan, dayStart) {
  if (!plan.workDays.includes(dayStart.getDay())) return null;
  const shiftStartMinutes = pauseThiefTimeToMinutes(plan.shiftStart);
  const shiftEndClockMinutes = pauseThiefTimeToMinutes(plan.shiftEnd);
  const sleepStartClockMinutes = pauseThiefTimeToMinutes(plan.sleepStart);
  if (shiftStartMinutes === null || shiftEndClockMinutes === null || sleepStartClockMinutes === null) return null;

  const shiftStartAt = new Date(dayStart.getTime() + shiftStartMinutes * 60_000);
  const shiftEndOffset = shiftEndClockMinutes + (shiftEndClockMinutes <= shiftStartMinutes ? 1440 : 0);
  const shiftEndAt = new Date(dayStart.getTime() + shiftEndOffset * 60_000);

  let sleepStartAt = new Date(dayStart.getTime() + sleepStartClockMinutes * 60_000);
  while (sleepStartAt.getTime() < shiftEndAt.getTime()) {
    sleepStartAt = new Date(sleepStartAt.getTime() + 86_400_000);
  }

  return {
    key: `${pauseThiefDateKey(dayStart)}:${plan.shiftStart}:${plan.sleepStart}`,
    shiftStartAt,
    shiftEndAt,
    sleepStartAt
  };
}

function pauseThiefCyclesAround(plan, now) {
  const cycles = [];
  for (let offset = -PAUSE_THIEF_LOOKAROUND_DAYS; offset <= 1; offset += 1) {
    const cycle = pauseThiefCycleForWorkDay(plan, pauseThiefDayStart(now, offset));
    if (cycle) cycles.push(cycle);
  }
  return cycles.sort((a, b) => a.sleepStartAt - b.sleepStartAt);
}

export function normalizeRecoveryThiefStore(value = {}) {
  const logs = (Array.isArray(value.logs) ? value.logs : [])
    .filter((item) => item && typeof item === 'object' && String(item.cycleKey || '').trim() && String(item.thief || '').trim())
    .map((item) => ({
      id: String(item.id || '').slice(0, 140),
      cycleKey: String(item.cycleKey || '').slice(0, 120),
      thief: String(item.thief || '').trim().slice(0, 48),
      note: String(item.note || '').trim().replace(/\s+/g, ' ').slice(0, 120),
      plannedSleepStartAt: Number(item.plannedSleepStartAt) || null,
      observedAt: Number(item.observedAt) || null,
      observedDelayMinutes: Math.max(0, Math.min(720, Math.round(Number(item.observedDelayMinutes) || 0)))
    }))
    .slice(0, 365);

  const dismissedCycles = [...new Set(
    (Array.isArray(value.dismissedCycles) ? value.dismissedCycles : [])
      .map((item) => String(item || '').trim().slice(0, 120))
      .filter(Boolean)
  )].slice(0, 120);

  return { version: 1, logs, dismissedCycles };
}

function pauseThiefStorageKey(accountId) {
  return `${PAUSE_THIEF_STORAGE_KEY}:account:${String(accountId)}`;
}

function pauseThiefLoadStore(accountId) {
  try {
    const raw = localStorage.getItem(pauseThiefStorageKey(accountId));
    return normalizeRecoveryThiefStore(raw ? JSON.parse(raw) : {});
  } catch {
    return normalizeRecoveryThiefStore();
  }
}

function pauseThiefSaveStore(accountId, value) {
  const normalized = normalizeRecoveryThiefStore(value);
  try {
    localStorage.setItem(pauseThiefStorageKey(accountId), JSON.stringify(normalized));
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pause:recovery-thief-changed', { detail: normalized }));
  }
  return normalized;
}

export function deriveRecoveryThiefPrompt(rawPlan, rawStore, nowValue = new Date()) {
  const plan = pauseThiefNormalizePlan(rawPlan);
  const store = normalizeRecoveryThiefStore(rawStore);
  const now = nowValue instanceof Date ? new Date(nowValue.getTime()) : new Date(nowValue);
  if (!plan.setupComplete || !plan.workDays.length || !plan.sleepStart || Number.isNaN(now.getTime())) return null;

  const nowMs = now.getTime();
  const minDelayMs = PAUSE_THIEF_MIN_DELAY_MINUTES * 60_000;
  const promptWindowMs = PAUSE_THIEF_PROMPT_WINDOW_MINUTES * 60_000;
  const alreadyHandled = new Set([
    ...store.dismissedCycles,
    ...store.logs.map((item) => item.cycleKey)
  ]);

  const due = pauseThiefCyclesAround(plan, now)
    .filter((cycle) => !alreadyHandled.has(cycle.key))
    .filter((cycle) => nowMs >= cycle.sleepStartAt.getTime() + minDelayMs)
    .filter((cycle) => nowMs <= cycle.sleepStartAt.getTime() + promptWindowMs)
    .sort((a, b) => b.sleepStartAt - a.sleepStartAt)[0];

  if (!due) return null;
  return {
    cycleKey: due.key,
    plannedSleepStartAt: due.sleepStartAt.getTime(),
    observedAt: nowMs,
    observedDelayMinutes: Math.max(0, Math.round((nowMs - due.sleepStartAt.getTime()) / 60_000))
  };
}

function pauseThiefEscapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function pauseThiefEnsureStyles() {
  if (document.querySelector('#pause-recovery-thief-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-recovery-thief-style';
  style.textContent = `
    .pause-thief-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1310;
      display: grid;
      align-items: end;
      padding: 18px 16px max(18px, env(safe-area-inset-bottom));
      background: rgba(1, 1, 5, .72);
      backdrop-filter: blur(12px);
      animation: pauseThiefFadeIn .16s ease-out both;
    }

    .pause-thief-sheet {
      width: min(100%, 430px);
      margin: 0 auto;
      padding: 21px 18px 15px;
      border: 1px solid rgba(176, 132, 239, .2);
      border-radius: 22px;
      background:
        radial-gradient(circle at 15% 5%, rgba(105, 83, 255, .12), transparent 34%),
        radial-gradient(circle at 90% 90%, rgba(211, 72, 199, .09), transparent 32%),
        rgba(10, 7, 18, .98);
      box-shadow: 0 -16px 48px rgba(0, 0, 0, .38);
    }

    .pause-thief-eyebrow {
      margin: 0 0 7px;
      color: #9a7bc6;
      font-size: .6rem;
      font-weight: 720;
      letter-spacing: .15em;
    }

    .pause-thief-sheet h2 {
      margin: 0;
      color: #f0eaf5;
      font-size: 1.2rem;
      font-weight: 480;
      letter-spacing: -.015em;
    }

    .pause-thief-delay {
      margin: 7px 0 16px;
      color: #807788;
      font-size: .68rem;
      line-height: 1.45;
    }

    .pause-thief-options {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .pause-thief-option,
    .pause-thief-more,
    .pause-thief-skip,
    .pause-thief-other-save {
      appearance: none;
      min-height: 43px;
      border: 1px solid rgba(163, 124, 224, .15);
      border-radius: 12px;
      background: rgba(22, 14, 39, .55);
      color: #d8cfdf;
      font-size: .72rem;
      font-weight: 540;
      cursor: pointer;
    }

    .pause-thief-option:hover,
    .pause-thief-option:focus-visible,
    .pause-thief-more:hover,
    .pause-thief-more:focus-visible,
    .pause-thief-other-save:hover,
    .pause-thief-other-save:focus-visible {
      border-color: rgba(184, 139, 248, .34);
      background: rgba(83, 48, 139, .2);
      outline: none;
    }

    .pause-thief-more {
      width: 100%;
      margin-top: 9px;
      background: transparent;
      color: #9b8da7;
    }

    .pause-thief-more-options {
      margin-top: 8px;
    }

    .pause-thief-other {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      margin-top: 10px;
    }

    .pause-thief-other input {
      min-width: 0;
      min-height: 43px;
      box-sizing: border-box;
      padding: 0 12px;
      border: 1px solid rgba(163, 124, 224, .18);
      border-radius: 12px;
      background: rgba(8, 6, 15, .75);
      color: #eee7f5;
      font: inherit;
      font-size: .72rem;
      outline: none;
    }

    .pause-thief-other input:focus {
      border-color: rgba(184, 139, 248, .4);
    }

    .pause-thief-other-save {
      min-width: 66px;
      padding: 0 12px;
    }

    .pause-thief-skip {
      width: 100%;
      margin-top: 8px;
      border-color: transparent;
      background: transparent;
      color: #776f80;
      font-size: .68rem;
      font-weight: 500;
    }

    @keyframes pauseThiefFadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (prefers-reduced-motion: reduce) {
      .pause-thief-backdrop { animation: none; }
    }
  `;
  document.head.appendChild(style);
}

function pauseThiefClose() {
  pauseThiefOverlay?.remove();
  pauseThiefOverlay = null;
  pauseThiefMoreOpen = false;
}

function pauseThiefRecord(accountId, prompt, thief, note = '') {
  const store = pauseThiefLoadStore(accountId);
  const observedAt = Date.now();
  const entry = {
    id: `thief-${prompt.cycleKey}-${observedAt}`,
    cycleKey: prompt.cycleKey,
    thief,
    note,
    plannedSleepStartAt: prompt.plannedSleepStartAt,
    observedAt,
    observedDelayMinutes: Math.max(0, Math.round((observedAt - prompt.plannedSleepStartAt) / 60_000))
  };
  pauseThiefSaveStore(accountId, {
    ...store,
    logs: [entry, ...store.logs.filter((item) => item.cycleKey !== prompt.cycleKey)]
  });
  pauseThiefClose();
}

function pauseThiefDismiss(accountId, prompt) {
  const store = pauseThiefLoadStore(accountId);
  pauseThiefSaveStore(accountId, {
    ...store,
    dismissedCycles: [prompt.cycleKey, ...store.dismissedCycles.filter((key) => key !== prompt.cycleKey)]
  });
  pauseThiefClose();
}

function pauseThiefRender(accountId, prompt) {
  if (!pauseThiefOverlay) return;
  const quick = PAUSE_THIEF_QUICK_OPTIONS.map((label) => `
    <button type="button" class="pause-thief-option" data-pause-thief="${pauseThiefEscapeHtml(label)}">${pauseThiefEscapeHtml(label)}</button>
  `).join('');
  const more = PAUSE_THIEF_MORE_OPTIONS.map((label) => `
    <button type="button" class="pause-thief-option" data-pause-thief="${pauseThiefEscapeHtml(label)}">${pauseThiefEscapeHtml(label)}</button>
  `).join('');

  pauseThiefOverlay.innerHTML = `
    <section class="pause-thief-sheet" role="dialog" aria-modal="true" aria-label="Log a sleep delay">
      <p class="pause-thief-eyebrow">SLEEP DELAY</p>
      <h2>What’s delaying sleep?</h2>
      <p class="pause-thief-delay">About ${prompt.observedDelayMinutes} min past your planned start.</p>
      <div class="pause-thief-options">${quick}</div>
      <button type="button" class="pause-thief-more" data-pause-thief-more aria-expanded="${pauseThiefMoreOpen ? 'true' : 'false'}">${pauseThiefMoreOpen ? 'Fewer options' : 'More options'}</button>
      ${pauseThiefMoreOpen ? `<div class="pause-thief-options pause-thief-more-options">${more}</div>` : ''}
      <div class="pause-thief-other" data-pause-thief-other hidden>
        <input type="text" maxlength="120" placeholder="What got in the way?" aria-label="Other sleep delay reason">
        <button type="button" class="pause-thief-other-save">Save</button>
      </div>
      <button type="button" class="pause-thief-skip" data-pause-thief-skip>Skip</button>
    </section>
  `;

  pauseThiefOverlay.querySelectorAll('[data-pause-thief]').forEach((button) => {
    button.addEventListener('click', () => {
      const thief = String(button.dataset.pauseThief || '').trim();
      if (thief !== 'Other') {
        pauseThiefRecord(accountId, prompt, thief);
        return;
      }
      const other = pauseThiefOverlay?.querySelector('[data-pause-thief-other]');
      if (other) {
        other.hidden = false;
        other.querySelector('input')?.focus({ preventScroll: true });
      }
    });
  });

  pauseThiefOverlay.querySelector('[data-pause-thief-more]')?.addEventListener('click', () => {
    pauseThiefMoreOpen = !pauseThiefMoreOpen;
    pauseThiefRender(accountId, prompt);
  });

  pauseThiefOverlay.querySelector('.pause-thief-other-save')?.addEventListener('click', () => {
    const input = pauseThiefOverlay?.querySelector('[data-pause-thief-other] input');
    const note = String(input?.value || '').trim().replace(/\s+/g, ' ').slice(0, 120);
    if (!note) {
      input?.focus();
      return;
    }
    pauseThiefRecord(accountId, prompt, 'Other', note);
  });

  pauseThiefOverlay.querySelector('[data-pause-thief-skip]')?.addEventListener('click', () => {
    pauseThiefDismiss(accountId, prompt);
  });
}

function pauseThiefShow(accountId, prompt) {
  if (pauseThiefOverlay) return;
  pauseThiefEnsureStyles();
  pauseThiefMoreOpen = false;
  pauseThiefOverlay = document.createElement('div');
  pauseThiefOverlay.className = 'pause-thief-backdrop';
  pauseThiefOverlay.addEventListener('pointerdown', (event) => {
    if (event.target === pauseThiefOverlay) pauseThiefDismiss(accountId, prompt);
  });
  document.body.appendChild(pauseThiefOverlay);
  pauseThiefRender(accountId, prompt);
}

function pauseThiefCanPrompt(pause) {
  if (!pause || pause.authStatus !== 'authenticated' || pause.screen !== 'main' || !pause.user?.id) return false;
  if (pause.menuOpen || pause.panelView || pause.completionVisible || pause.pauseState?.active) return false;
  if (document.hidden) return false;
  if (document.querySelector('.recovery-plan-overlay, .recovery-briefing-overlay, .system-backdrop')) return false;
  return true;
}

function pauseThiefReconcile() {
  if (pauseThiefQueued) return;
  pauseThiefQueued = true;
  queueMicrotask(() => {
    pauseThiefQueued = false;
    if (pauseThiefOverlay) return;
    const pause = window.__PAUSE__?.getState?.();
    if (!pauseThiefCanPrompt(pause)) return;

    const plan = window.__PAUSE_RECOVERY_PLAN__?.getPlan?.();
    if (!plan) return;
    const store = pauseThiefLoadStore(pause.user.id);
    const prompt = deriveRecoveryThiefPrompt(plan, store, new Date());
    if (prompt) pauseThiefShow(pause.user.id, prompt);
  });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.__PAUSE_RECOVERY_THIEVES__ = {
    getLogs: () => {
      const accountId = window.__PAUSE__?.getState?.().user?.id;
      return accountId ? pauseThiefLoadStore(accountId).logs : [];
    },
    getStore: () => {
      const accountId = window.__PAUSE__?.getState?.().user?.id;
      return accountId ? pauseThiefLoadStore(accountId) : normalizeRecoveryThiefStore();
    }
  };

  const pauseThiefInterval = setInterval(pauseThiefReconcile, 900);
  pauseThiefInterval.unref?.();
  window.addEventListener('focus', pauseThiefReconcile);
  window.addEventListener('pause:state-changed', pauseThiefReconcile);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) pauseThiefReconcile();
  });
  pauseThiefReconcile();
}

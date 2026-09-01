import {
  addManilaDays,
  manilaDateKey,
  manilaDateKeyToStartMs
} from './manilaTime.js';

export const PAUSE_SLEEP_STREAK_MIN_MINUTES = 6 * 60;
export const PAUSE_SLEEP_STREAK_PLAN_RATIO = 0.9;
const PAUSE_SLEEP_STREAK_MAX_LOOKBACK_DAYS = 730;

function pauseSleepStreakFinite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pauseSleepStreakWeekday(dateKey) {
  const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
}

function pauseSleepStreakValidTime(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function pauseSleepStreakTimeToMinutes(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function pauseSleepStreakRoutineDayOffset(plan = {}) {
  if (!pauseSleepStreakValidTime(plan.shiftStart) || !pauseSleepStreakValidTime(plan.shiftEnd)) return 0;

  const shiftStart = pauseSleepStreakTimeToMinutes(plan.shiftStart);
  const shiftEndClock = pauseSleepStreakTimeToMinutes(plan.shiftEnd);
  const shiftEnd = shiftEndClock <= shiftStart ? shiftEndClock + 1440 : shiftEndClock;
  const homeAt = shiftEnd + Math.max(0, Number(plan.commuteMinutes) || 0);

  const fallbackSleepClock = (
    shiftEndClock
    + Math.max(0, Number(plan.commuteMinutes) || 0)
    + Math.max(0, Number(plan.windDownMinutes) || 0)
  ) % 1440;
  const sleepClock = pauseSleepStreakValidTime(plan.sleepStart)
    ? pauseSleepStreakTimeToMinutes(plan.sleepStart)
    : fallbackSleepClock;

  let sleepAt = sleepClock;
  while (sleepAt < homeAt) sleepAt += 1440;
  return Math.max(0, Math.floor(sleepAt / 1440));
}

function pauseSleepStreakNormalizePlan(plan = {}) {
  const workDays = [...new Set((Array.isArray(plan.workDays) ? plan.workDays : [])
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
  const plannedMinutes = Math.max(
    0,
    Math.round(Number(plan.plannedMinutes ?? plan.sleepMinutes ?? plan.recoveryMinutes) || 0)
  );
  const normalized = {
    setupComplete: plan.setupComplete === true,
    workDays,
    plannedMinutes,
    shiftStart: pauseSleepStreakValidTime(plan.shiftStart) ? String(plan.shiftStart) : '',
    shiftEnd: pauseSleepStreakValidTime(plan.shiftEnd) ? String(plan.shiftEnd) : '',
    commuteMinutes: Math.max(0, Number(plan.commuteMinutes) || 0),
    windDownMinutes: Math.max(0, Number(plan.windDownMinutes) || 0),
    sleepStart: pauseSleepStreakValidTime(plan.sleepStart) ? String(plan.sleepStart) : ''
  };
  return {
    ...normalized,
    routineDayOffset: Number.isInteger(plan.routineDayOffset)
      ? Math.max(0, Number(plan.routineDayOffset))
      : pauseSleepStreakRoutineDayOffset(normalized)
  };
}

export function pauseSleepStreakRequiredMinutes(plannedMinutes) {
  const planned = Math.max(0, Math.round(Number(plannedMinutes) || 0));
  return Math.max(
    PAUSE_SLEEP_STREAK_MIN_MINUTES,
    Math.ceil(planned * PAUSE_SLEEP_STREAK_PLAN_RATIO)
  );
}

export function pauseSleepStreakIsSleepEntry(entry = {}) {
  const explicitType = String(entry.sessionType ?? entry.type ?? entry.kind ?? '').trim().toLowerCase();
  if (explicitType) return explicitType === 'sleep';
  return String(entry.label || '').trim().toLowerCase() === 'sleep';
}

function pauseSleepStreakEntryWindow(entry = {}) {
  const startAt = pauseSleepStreakFinite(entry.startAt ?? entry.endedAt);
  if (startAt === null) return null;
  const explicitEnd = pauseSleepStreakFinite(entry.endedAt);
  const durationMs = Math.max(0, Number(entry.durationMs || entry.sessionDurationMs || 0));
  const endedAt = explicitEnd !== null && explicitEnd >= startAt ? explicitEnd : startAt + durationMs;
  if (!Number.isFinite(endedAt) || endedAt < startAt) return null;
  return { startAt, endedAt, durationMs: Math.max(0, endedAt - startAt) };
}

export function pauseSleepStreakSleepMinutesForDay(history = [], dateKey) {
  return Math.round((Array.isArray(history) ? history : []).reduce((totalMs, entry) => {
    if (!pauseSleepStreakIsSleepEntry(entry)) return totalMs;
    const window = pauseSleepStreakEntryWindow(entry);
    if (!window) return totalMs;
    if (manilaDateKey(window.startAt) !== dateKey) return totalMs;
    return totalMs + window.durationMs;
  }, 0) / 60_000);
}

export function pauseSleepStreakDayResult({ history = [], plan = {}, dateKey }) {
  const normalizedPlan = pauseSleepStreakNormalizePlan(plan);
  const routineWeekday = pauseSleepStreakWeekday(dateKey);
  const workDayKey = addManilaDays(dateKey, -normalizedPlan.routineDayOffset);
  const workWeekday = pauseSleepStreakWeekday(workDayKey);
  const eligible = Boolean(
    normalizedPlan.setupComplete
    && routineWeekday !== null
    && workWeekday !== null
    && normalizedPlan.workDays.includes(workWeekday)
  );
  const recordedSleepMinutes = eligible
    ? pauseSleepStreakSleepMinutesForDay(history, dateKey)
    : 0;
  const requiredMinutes = pauseSleepStreakRequiredMinutes(normalizedPlan.plannedMinutes);
  return {
    dateKey,
    routineWeekday,
    workDayKey,
    workWeekday,
    routineDayOffset: normalizedPlan.routineDayOffset,
    eligible,
    recordedSleepMinutes,
    plannedSleepMinutes: normalizedPlan.plannedMinutes,
    requiredMinutes,
    qualifies: eligible
      && normalizedPlan.plannedMinutes > 0
      && recordedSleepMinutes >= requiredMinutes
  };
}

export function derivePauseSleepRoutineStreak({ pauseState = {}, plan = {}, now = Date.now() } = {}) {
  const normalizedPlan = pauseSleepStreakNormalizePlan(plan);
  const history = Array.isArray(pauseState?.history) ? pauseState.history : [];
  const todayKey = manilaDateKey(now);
  const todayStart = manilaDateKeyToStartMs(todayKey);
  const today = pauseSleepStreakDayResult({ history, plan: normalizedPlan, dateKey: todayKey });

  let streak = 0;
  let countedToday = false;
  let cursorKey = todayKey;
  const evaluated = [];

  if (today.eligible && today.qualifies) {
    streak = 1;
    countedToday = true;
    evaluated.push(today);
    cursorKey = addManilaDays(cursorKey, -1);
  } else {
    // The current routine day stays open until the Manila calendar day is complete.
    // A prior eligible routine day without enough Recorded Sleep resets the streak.
    cursorKey = addManilaDays(cursorKey, -1);
  }

  for (let offset = 0; offset < PAUSE_SLEEP_STREAK_MAX_LOOKBACK_DAYS && cursorKey; offset += 1) {
    const day = pauseSleepStreakDayResult({ history, plan: normalizedPlan, dateKey: cursorKey });
    cursorKey = addManilaDays(cursorKey, -1);
    if (!day.eligible) continue;
    evaluated.push(day);
    if (!day.qualifies) break;
    streak += 1;
  }

  return {
    streak,
    countedToday,
    today,
    plannedSleepMinutes: normalizedPlan.plannedMinutes,
    requiredMinutes: pauseSleepStreakRequiredMinutes(normalizedPlan.plannedMinutes),
    evaluated,
    asOf: Number.isFinite(todayStart) ? Math.max(Number(now) || Date.now(), todayStart) : Number(now) || Date.now()
  };
}

function pauseSleepStreakFormatMinutes(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (!hours) return `${mins}m`;
  if (!mins) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function pauseSleepStreakContext() {
  const pause = window.__PAUSE__?.getState?.();
  if (!pause || pause.authStatus !== 'authenticated') return null;
  const plan = window.__PAUSE_RECOVERY_PLAN__?.getPlan?.() || {};
  return {
    pause,
    plan,
    result: derivePauseSleepRoutineStreak({
      pauseState: pause.pauseState || {},
      plan
    })
  };
}

function pauseSleepStreakEnsureStyles() {
  if (document.querySelector('#pause-sleep-routine-streak-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-sleep-routine-streak-style';
  style.textContent = `
    .pause-sleep-routine-streak {
      margin: 4px 0 18px;
      padding: 18px;
      border: 1px solid rgba(177, 133, 242, .18);
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(67, 38, 111, .12), rgba(16, 10, 31, .28));
    }

    .pause-sleep-routine-streak small {
      display: block;
      color: #8f849a;
      font-size: .61rem;
      font-weight: 680;
      letter-spacing: .13em;
    }

    .pause-sleep-routine-streak strong {
      display: block;
      margin-top: 7px;
      color: #f0e9f6;
      font-size: 1.22rem;
      font-weight: 470;
      line-height: 1.2;
    }

    .pause-sleep-routine-streak p {
      margin: 8px 0 0;
      color: #8f8698;
      font-size: .67rem;
      line-height: 1.5;
    }
  `;
  document.head.appendChild(style);
}

function pauseSleepStreakRender() {
  const panel = document.querySelector('.pause-view-insights');
  const existing = panel?.querySelector('[data-pause-sleep-routine-streak]');
  if (!panel) return;

  const context = pauseSleepStreakContext();
  if (!context?.plan?.setupComplete) {
    existing?.remove();
    return;
  }

  pauseSleepStreakEnsureStyles();
  const { result } = context;
  const card = existing || document.createElement('section');
  card.className = 'pause-sleep-routine-streak';
  card.dataset.pauseSleepRoutineStreak = '';

  const streakLabel = result.streak === 0
    ? 'No active streak yet'
    : result.streak === 1
      ? '1 routine day in a row'
      : `${result.streak} routine days in a row`;
  card.innerHTML = `
    <small>SLEEP ROUTINE STREAK</small>
    <strong>${streakLabel}</strong>
    <p>Recorded Sleep only · ${pauseSleepStreakFormatMinutes(PAUSE_SLEEP_STREAK_MIN_MINUTES)} minimum · 90% of Planned Sleep</p>
  `;

  if (!existing) {
    const anchor = panel.querySelector('.pause-rhythm-hero');
    if (anchor) anchor.insertAdjacentElement('beforebegin', card);
    else panel.querySelector('.system-panel-header')?.insertAdjacentElement('afterend', card);
  }
}

let pauseSleepStreakQueued = false;
function pauseSleepStreakQueueRender() {
  if (pauseSleepStreakQueued) return;
  pauseSleepStreakQueued = true;
  queueMicrotask(() => {
    pauseSleepStreakQueued = false;
    pauseSleepStreakRender();
  });
}

export function initializePauseSleepRoutineStreak() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const observer = new MutationObserver(pauseSleepStreakQueueRender);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('pause:state-changed', pauseSleepStreakQueueRender);
  window.addEventListener('focus', pauseSleepStreakQueueRender);
  pauseSleepStreakQueueRender();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  initializePauseSleepRoutineStreak();
}

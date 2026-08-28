import {
  addManilaDays,
  formatManilaDate,
  manilaDateKey,
  manilaDateKeyToStartMs,
  manilaHour,
  manilaWeekday
} from './manilaTime.js';

export const PAUSE_STORAGE_KEY = 'pause-state-v1';

let pauseStorageAccountId = null;

export const DEFAULT_RESTS = [
  'Sleep',
  'Nap',
  'Close My Eyes',
  'Lie Down / Do Nothing',
  'Take a Walk',
  'Listen to Music',
  'Scroll / Social Media',
  'Play a Game',
  'Watch Something',
  'Meditate / Breathe',
  'Pray / Quiet Time',
  'Take a Break'
];

function emptyState() {
  return { version: 1, customRests: [], history: [], active: null };
}

function activeStorageKey() {
  return pauseStorageAccountId
    ? `${PAUSE_STORAGE_KEY}:account:${pauseStorageAccountId}`
    : PAUSE_STORAGE_KEY;
}

function normalizePauseState(parsed = {}) {
  const active = parsed.active && parsed.active.label && parsed.active.startAt
    ? {
        ...parsed.active,
        plannedMinutes: parsed.active.plannedMinutes ?? null,
        endAt: parsed.active.endAt ?? null
      }
    : null;
  return {
    version: 1,
    customRests: Array.isArray(parsed.customRests) ? parsed.customRests.filter(Boolean).slice(0, 40) : [],
    history: Array.isArray(parsed.history) ? parsed.history.slice(0, 500) : [],
    active
  };
}

export function setPauseStorageAccount(accountId) {
  const clean = String(accountId ?? '').trim();
  pauseStorageAccountId = clean || null;
  return activeStorageKey();
}

export function loadPauseState({ fallbackToLegacy = false } = {}) {
  try {
    let raw = localStorage.getItem(activeStorageKey());
    if (!raw && pauseStorageAccountId && fallbackToLegacy) {
      raw = localStorage.getItem(PAUSE_STORAGE_KEY);
    }
    if (!raw) return emptyState();
    return normalizePauseState(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

export function savePauseState(state, { notify = true } = {}) {
  const normalized = normalizePauseState(state);
  try {
    localStorage.setItem(activeStorageKey(), JSON.stringify(normalized));
  } catch {}
  if (notify && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pause:state-changed', { detail: normalized }));
  }
  return normalized;
}

export function addCustomRest(state, label) {
  const clean = String(label || '').trim().replace(/\s+/g, ' ').slice(0, 48);
  if (!clean) return state;
  const alreadyExists = [...DEFAULT_RESTS, ...state.customRests].some((item) => item.toLowerCase() === clean.toLowerCase());
  if (alreadyExists) return state;
  return savePauseState({ ...state, customRests: [...state.customRests, clean] });
}

export function removeCustomRest(state, label) {
  return savePauseState({
    ...state,
    customRests: state.customRests.filter((item) => item !== label)
  });
}

export function startRest(state, label = 'Rest', durationMinutes = null) {
  const cleanLabel = String(label || 'Rest').trim().slice(0, 48) || 'Rest';
  const parsedMinutes = Number(durationMinutes);
  const hasPlannedDuration = Number.isFinite(parsedMinutes) && parsedMinutes > 0;
  const minutes = hasPlannedDuration ? Math.max(1, Math.min(720, Math.round(parsedMinutes))) : null;
  const startAt = Date.now();

  return savePauseState({
    ...state,
    active: {
      id: `rest-${startAt}`,
      label: cleanLabel,
      plannedMinutes: minutes,
      startAt,
      endAt: minutes ? startAt + minutes * 60_000 : null
    }
  });
}

export function remainingMs(state, now = Date.now()) {
  if (!state.active?.endAt) return 0;
  return Math.max(0, Number(state.active.endAt) - now);
}

export function elapsedMs(state, now = Date.now()) {
  if (!state.active?.startAt) return 0;
  return Math.max(0, now - Number(state.active.startAt));
}

export function finishRest(state, reason = 'ended', now = Date.now()) {
  const active = state.active;
  if (!active) return state;
  const endedAt = Math.max(Number(active.startAt), now);
  const durationMs = Math.max(0, endedAt - Number(active.startAt));
  const entry = {
    id: active.id,
    label: active.label,
    plannedMinutes: active.plannedMinutes ?? null,
    startAt: active.startAt,
    endedAt,
    durationMs,
    reason
  };
  return savePauseState({
    ...state,
    active: null,
    history: [entry, ...state.history].slice(0, 500)
  });
}

export function completeExpiredRest(state, now = Date.now()) {
  if (!state.active?.endAt || remainingMs(state, now) > 0) return { state, completed: false };
  return { state: finishRest(state, 'timer-complete', Number(state.active.endAt)), completed: true };
}

export function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatDuration(ms) {
  const minutes = Math.max(0, Math.round(Number(ms || 0) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function uniqueRestDays(entries) {
  return new Set(entries.map((entry) => manilaDateKey(entry.startAt || entry.endedAt))).size;
}

function timeOfDay(timestamp) {
  const hour = manilaHour(timestamp);
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 22) return 'Evening';
  return 'Late night';
}

function validHistoryEntries(state) {
  return (Array.isArray(state.history) ? state.history : []).filter((entry) => {
    const stamp = Number(entry.startAt || entry.endedAt);
    const duration = Number(entry.durationMs);
    return Number.isFinite(stamp) && Number.isFinite(duration) && duration >= 0;
  });
}

function buildWeekdayPattern(history, now) {
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayKey = manilaDateKey(now);
  const rollingStartKey = addManilaDays(todayKey, -27);
  const rollingStartMs = manilaDateKeyToStartMs(rollingStartKey);

  const eligibleHistory = history.filter((entry) => Number(entry.startAt || entry.endedAt) <= now);
  if (!eligibleHistory.length) {
    return {
      ready: false,
      daysObserved: 0,
      restDaysObserved: 0,
      sessions: 0,
      ranked: [],
      strongest: null,
      weakest: null
    };
  }

  const firstStamp = Math.min(...eligibleHistory.map((entry) => Number(entry.startAt || entry.endedAt)));
  const firstDayKey = manilaDateKey(firstStamp);
  const observedStartKey = firstDayKey > rollingStartKey ? firstDayKey : rollingStartKey;
  const observedStartMs = manilaDateKeyToStartMs(observedStartKey);

  const buckets = WEEKDAYS.map((label, weekday) => ({
    weekday,
    label,
    occurrences: 0,
    totalMs: 0,
    sessions: 0,
    restDayKeys: new Set()
  }));

  let daysObserved = 0;
  for (
    let cursorKey = observedStartKey;
    cursorKey && cursorKey <= todayKey;
    cursorKey = addManilaDays(cursorKey, 1)
  ) {
    const cursorStart = manilaDateKeyToStartMs(cursorKey);
    buckets[manilaWeekday(cursorStart)].occurrences += 1;
    daysObserved += 1;
  }

  const patternEntries = eligibleHistory.filter((entry) => {
    const stamp = Number(entry.startAt || entry.endedAt);
    return stamp >= Math.max(observedStartMs, rollingStartMs) && stamp <= now;
  });

  patternEntries.forEach((entry) => {
    const stamp = Number(entry.startAt || entry.endedAt);
    const bucket = buckets[manilaWeekday(stamp)];
    bucket.totalMs += Number(entry.durationMs || 0);
    bucket.sessions += 1;
    bucket.restDayKeys.add(manilaDateKey(stamp));
  });

  const ranked = buckets
    .map((bucket) => ({
      weekday: bucket.weekday,
      label: bucket.label,
      occurrences: bucket.occurrences,
      totalMs: bucket.totalMs,
      sessions: bucket.sessions,
      restDays: bucket.restDayKeys.size,
      averageMs: bucket.occurrences ? bucket.totalMs / bucket.occurrences : 0
    }))
    .sort((a, b) => b.averageMs - a.averageMs || b.totalMs - a.totalMs || a.weekday - b.weekday)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const restDaysObserved = uniqueRestDays(patternEntries);
  const ready = daysObserved >= 14 && restDaysObserved >= 4 && patternEntries.length >= 5;

  return {
    ready,
    daysObserved,
    restDaysObserved,
    sessions: patternEntries.length,
    ranked,
    strongest: ready ? ranked[0] : null,
    weakest: ready ? ranked[ranked.length - 1] : null
  };
}

export function restInsights(state, now = Date.now()) {
  const history = validHistoryEntries(state);

  // Analytics are based on seven MANILA CALENDAR DAYS, including today.
  // The app's calendar stays stable even when the device is in another timezone.
  const todayKey = manilaDateKey(now);
  const currentStartKey = addManilaDays(todayKey, -6);
  const previousStartKey = addManilaDays(currentStartKey, -7);

  const currentStartMs = manilaDateKeyToStartMs(currentStartKey);
  const previousStartMs = manilaDateKeyToStartMs(previousStartKey);

  const recent = history.filter((entry) => {
    const stamp = Number(entry.startAt || entry.endedAt);
    return stamp >= currentStartMs && stamp <= now;
  });

  const previous = history.filter((entry) => {
    const stamp = Number(entry.startAt || entry.endedAt);
    return stamp >= previousStartMs && stamp < currentStartMs;
  });

  const totalMs = recent.reduce((sum, entry) => sum + Number(entry.durationMs || 0), 0);
  const previousTotalMs = previous.reduce((sum, entry) => sum + Number(entry.durationMs || 0), 0);
  const restDays = uniqueRestDays(recent);
  const previousRestDays = uniqueRestDays(previous);
  const longestMs = recent.reduce((longest, entry) => Math.max(longest, Number(entry.durationMs || 0)), 0);

  const byTime = new Map();
  recent.forEach((entry) => {
    const label = timeOfDay(entry.startAt || entry.endedAt);
    byTime.set(label, (byTime.get(label) || 0) + 1);
  });
  const mostCommonTime = [...byTime.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  // The recent timeline stays chronological by relevance: Today → Yesterday → earlier days.
  // Ranking by strongest weekday is a separate learned pattern below it.
  const daily = [];
  for (let offset = 0; offset <= 6; offset += 1) {
    const key = addManilaDays(todayKey, -offset);
    const dayEntries = recent.filter((entry) => manilaDateKey(entry.startAt || entry.endedAt) === key);
    const dayTotalMs = dayEntries.reduce((sum, entry) => sum + Number(entry.durationMs || 0), 0);
    const dayStartMs = manilaDateKeyToStartMs(key);

    daily.push({
      key,
      label: offset === 0
        ? 'Today'
        : offset === 1
          ? 'Yesterday'
          : formatManilaDate(dayStartMs, { weekday: 'short' }),
      dateLabel: formatManilaDate(dayStartMs, { month: 'short', day: 'numeric' }),
      totalMs: dayTotalMs,
      sessions: dayEntries.length
    });
  }

  return {
    sessions: recent.length,
    totalMs,
    averageMs: recent.length ? totalMs / recent.length : 0,
    longestMs,
    restDays,
    previousRestDays,
    restDayChange: restDays - previousRestDays,
    previousTotalMs,
    totalMsChange: totalMs - previousTotalMs,
    mostCommonTime,
    daily,
    weekdayPattern: buildWeekdayPattern(history, now)
  };
}

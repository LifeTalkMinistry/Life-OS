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

function timeOfDay(timestamp) {
  const hour = manilaHour(timestamp);
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 22) return 'Evening';
  return 'Late night';
}

function sessionBounds(entry) {
  const start = Number(entry?.startAt ?? entry?.endedAt);
  if (!Number.isFinite(start)) return null;

  const explicitEnd = Number(entry?.endedAt);
  const duration = Math.max(0, Number(entry?.durationMs || 0));
  const end = Number.isFinite(explicitEnd) && explicitEnd >= start
    ? explicitEnd
    : start + duration;

  if (!Number.isFinite(end) || end < start) return null;
  return { start, end, durationMs: Math.max(0, end - start) };
}

function validHistoryEntries(state) {
  return (Array.isArray(state?.history) ? state.history : []).filter((entry) => sessionBounds(entry));
}

function entriesOverlappingWindow(history, start, end) {
  return history.filter((entry) => {
    const bounds = sessionBounds(entry);
    if (!bounds) return false;
    if (bounds.start === bounds.end) return bounds.start >= start && bounds.start < end;
    return bounds.end > start && bounds.start < end;
  });
}

export function restAuditForDay(state, dayKey, now = Date.now()) {
  const dayStart = manilaDateKeyToStartMs(dayKey);
  const nextDayKey = addManilaDays(dayKey, 1);
  const dayEnd = manilaDateKeyToStartMs(nextDayKey);

  if (!Number.isFinite(dayStart) || !Number.isFinite(dayEnd)) {
    return { dayKey, totalMs: 0, sessions: 0, entries: [] };
  }

  const effectiveEnd = Math.min(dayEnd, Number(now));
  if (effectiveEnd < dayStart) {
    return { dayKey, totalMs: 0, sessions: 0, entries: [] };
  }

  const entries = validHistoryEntries(state)
    .map((entry) => {
      const bounds = sessionBounds(entry);
      const creditedStartAt = Math.max(bounds.start, dayStart);
      const creditedEndAt = Math.min(bounds.end, effectiveEnd);
      const isZeroDurationInsideDay = bounds.start === bounds.end
        && bounds.start >= dayStart
        && bounds.start < effectiveEnd;
      const creditedMs = Math.max(0, creditedEndAt - creditedStartAt);

      if (creditedMs <= 0 && !isZeroDurationInsideDay) return null;

      return {
        id: entry.id || `rest-${bounds.start}-${bounds.end}`,
        label: String(entry.label || 'Rest'),
        reason: entry.reason || null,
        plannedMinutes: entry.plannedMinutes ?? null,
        startAt: bounds.start,
        endedAt: bounds.end,
        sessionDurationMs: bounds.durationMs,
        creditedStartAt,
        creditedEndAt: isZeroDurationInsideDay ? bounds.start : creditedEndAt,
        creditedMs,
        crossesIntoDay: bounds.start < dayStart,
        crossesOutOfDay: bounds.end > dayEnd,
        splitAcrossDays: bounds.start < dayStart || bounds.end > dayEnd
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.creditedStartAt - a.creditedStartAt || b.startAt - a.startAt);

  return {
    dayKey,
    startAt: dayStart,
    endAt: dayEnd,
    totalMs: entries.reduce((sum, entry) => sum + entry.creditedMs, 0),
    sessions: entries.length,
    entries
  };
}

function buildWeekdayPattern(state, history, now) {
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayKey = manilaDateKey(now);
  const rollingStartKey = addManilaDays(todayKey, -27);
  const rollingStartMs = manilaDateKeyToStartMs(rollingStartKey);

  const eligibleHistory = entriesOverlappingWindow(history, rollingStartMs, now + 1);
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

  const firstStamp = Math.min(...eligibleHistory.map((entry) => sessionBounds(entry).start));
  const firstDayKey = manilaDateKey(firstStamp);
  const observedStartKey = firstDayKey > rollingStartKey ? firstDayKey : rollingStartKey;

  const buckets = WEEKDAYS.map((label, weekday) => ({
    weekday,
    label,
    occurrences: 0,
    totalMs: 0,
    sessions: 0,
    restDays: 0
  }));

  let daysObserved = 0;
  let restDaysObserved = 0;
  for (
    let cursorKey = observedStartKey;
    cursorKey && cursorKey <= todayKey;
    cursorKey = addManilaDays(cursorKey, 1)
  ) {
    const cursorStart = manilaDateKeyToStartMs(cursorKey);
    const bucket = buckets[manilaWeekday(cursorStart)];
    const audit = restAuditForDay(state, cursorKey, now);
    bucket.occurrences += 1;
    bucket.totalMs += audit.totalMs;
    bucket.sessions += audit.sessions;
    if (audit.sessions > 0) {
      bucket.restDays += 1;
      restDaysObserved += 1;
    }
    daysObserved += 1;
  }

  const ranked = buckets
    .map((bucket) => ({
      ...bucket,
      averageMs: bucket.occurrences ? bucket.totalMs / bucket.occurrences : 0
    }))
    .sort((a, b) => b.averageMs - a.averageMs || b.totalMs - a.totalMs || a.weekday - b.weekday)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const ready = daysObserved >= 14 && restDaysObserved >= 4 && eligibleHistory.length >= 5;

  return {
    ready,
    daysObserved,
    restDaysObserved,
    sessions: eligibleHistory.length,
    ranked,
    strongest: ready ? ranked[0] : null,
    weakest: ready ? ranked[ranked.length - 1] : null
  };
}

export function restInsights(state, now = Date.now()) {
  const history = validHistoryEntries(state);

  // Analytics are based on seven MANILA CALENDAR DAYS, including today.
  // Every visible daily total comes from the same per-day audit used by PAUSE Score.
  const todayKey = manilaDateKey(now);
  const currentStartKey = addManilaDays(todayKey, -6);
  const previousStartKey = addManilaDays(currentStartKey, -7);
  const previousEndKey = addManilaDays(currentStartKey, -1);

  const currentStartMs = manilaDateKeyToStartMs(currentStartKey);
  const previousStartMs = manilaDateKeyToStartMs(previousStartKey);
  const currentWindowEnd = Number(now) + 1;

  const recent = entriesOverlappingWindow(history, currentStartMs, currentWindowEnd);
  const previous = entriesOverlappingWindow(history, previousStartMs, currentStartMs);

  const daily = [];
  for (let offset = 0; offset <= 6; offset += 1) {
    const key = addManilaDays(todayKey, -offset);
    const audit = restAuditForDay(state, key, now);
    const dayStartMs = manilaDateKeyToStartMs(key);
    const weekdayLabel = formatManilaDate(dayStartMs, { weekday: 'short' });
    const baseDateLabel = formatManilaDate(dayStartMs, { month: 'short', day: 'numeric' });
    const relativeLabel = offset === 0
      ? 'Today'
      : offset === 1
        ? 'Yesterday'
        : null;

    daily.push({
      key,
      dateKey: key,
      label: weekdayLabel,
      weekdayLabel,
      relativeLabel,
      dateLabel: relativeLabel ? `${baseDateLabel} · ${relativeLabel}` : baseDateLabel,
      totalMs: audit.totalMs,
      sessions: audit.sessions
    });
  }

  const previousDaily = [];
  for (
    let cursorKey = previousStartKey;
    cursorKey && cursorKey <= previousEndKey;
    cursorKey = addManilaDays(cursorKey, 1)
  ) {
    previousDaily.push(restAuditForDay(state, cursorKey, now));
  }

  const totalMs = daily.reduce((sum, day) => sum + day.totalMs, 0);
  const previousTotalMs = previousDaily.reduce((sum, day) => sum + day.totalMs, 0);
  const restDays = daily.filter((day) => day.sessions > 0).length;
  const previousRestDays = previousDaily.filter((day) => day.sessions > 0).length;

  const recentCreditedDurations = recent.map((entry) => {
    const bounds = sessionBounds(entry);
    return Math.max(0, Math.min(bounds.end, now) - Math.max(bounds.start, currentStartMs));
  });
  const longestMs = recentCreditedDurations.reduce((longest, duration) => Math.max(longest, duration), 0);

  const byTime = new Map();
  recent.forEach((entry) => {
    const bounds = sessionBounds(entry);
    const label = timeOfDay(bounds.start);
    byTime.set(label, (byTime.get(label) || 0) + 1);
  });
  const mostCommonTime = [...byTime.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

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
    weekdayPattern: buildWeekdayPattern(state, history, now)
  };
}

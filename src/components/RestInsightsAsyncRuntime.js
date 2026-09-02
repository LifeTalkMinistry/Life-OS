import {
  addManilaDays,
  formatManilaDate,
  manilaDateKey,
  manilaDateKeyToStartMs,
  manilaHour,
  manilaWeekday
} from '../manilaTime.js';

const REST_INSIGHTS_HISTORY_LIMIT = 500;
const REST_INSIGHTS_PATTERN_DAYS = 28;

function safeSessionBounds(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const start = Number(entry.startAt ?? entry.endedAt);
  if (!Number.isFinite(start)) return null;
  const explicitEnd = Number(entry.endedAt);
  const duration = Math.max(0, Number(entry.durationMs || entry.sessionDurationMs || 0));
  const end = Number.isFinite(explicitEnd) && explicitEnd >= start
    ? explicitEnd
    : start + duration;
  if (!Number.isFinite(end) || end < start) return null;
  return { start, end, durationMs: Math.max(0, end - start) };
}

export function boundedRestHistory(state) {
  return (Array.isArray(state?.history) ? state.history : [])
    .filter((entry) => safeSessionBounds(entry))
    .slice(0, REST_INSIGHTS_HISTORY_LIMIT);
}

function overlapMs(start, end, rangeStart, rangeEnd) {
  return Math.max(0, Math.min(end, rangeEnd) - Math.max(start, rangeStart));
}

function overlapsWindow(bounds, start, end) {
  if (!bounds) return false;
  if (bounds.start === bounds.end) return bounds.start >= start && bounds.start < end;
  return bounds.end > start && bounds.start < end;
}

function timeOfDay(timestamp) {
  const hour = manilaHour(timestamp);
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 22) return 'Evening';
  return 'Late night';
}

function buildDaySkeleton(todayKey) {
  const days = new Map();
  for (let offset = REST_INSIGHTS_PATTERN_DAYS - 1; offset >= 0; offset -= 1) {
    const key = addManilaDays(todayKey, -offset);
    days.set(key, { key, totalMs: 0, sessions: 0 });
  }
  return days;
}

function addEntryToDayBuckets(entry, bounds, dayBuckets, windowStartKey, todayKey, now) {
  const windowStart = manilaDateKeyToStartMs(windowStartKey);
  const windowEnd = Number(now) + 1;
  if (!overlapsWindow(bounds, windowStart, windowEnd)) return;

  let firstKey = manilaDateKey(Math.max(bounds.start, windowStart));
  let lastKey = manilaDateKey(Math.min(bounds.end, Number(now)));
  if (bounds.start === bounds.end) lastKey = firstKey;
  if (firstKey < windowStartKey) firstKey = windowStartKey;
  if (lastKey > todayKey) lastKey = todayKey;

  for (let key = firstKey; key && key <= lastKey; key = addManilaDays(key, 1)) {
    const bucket = dayBuckets.get(key);
    if (!bucket) continue;
    const dayStart = manilaDateKeyToStartMs(key);
    const nextKey = addManilaDays(key, 1);
    const dayEnd = manilaDateKeyToStartMs(nextKey);
    const effectiveEnd = Math.min(dayEnd, Number(now) + 1);
    const creditedMs = overlapMs(bounds.start, bounds.end, dayStart, effectiveEnd);
    const zeroDurationInside = bounds.start === bounds.end
      && bounds.start >= dayStart
      && bounds.start < effectiveEnd;
    if (creditedMs <= 0 && !zeroDurationInside) continue;
    bucket.totalMs += creditedMs;
    bucket.sessions += 1;
  }
}

function buildWeekdayPattern(history, dayBuckets, todayKey, windowStartKey, now) {
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const windowStartMs = manilaDateKeyToStartMs(windowStartKey);
  const windowEnd = Number(now) + 1;
  const eligible = history
    .map((entry) => ({ entry, bounds: safeSessionBounds(entry) }))
    .filter(({ bounds }) => overlapsWindow(bounds, windowStartMs, windowEnd));

  if (!eligible.length) {
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

  const firstStamp = Math.min(...eligible.map(({ bounds }) => bounds.start));
  const firstDayKey = manilaDateKey(firstStamp);
  const observedStartKey = firstDayKey > windowStartKey ? firstDayKey : windowStartKey;
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
  for (let key = observedStartKey; key && key <= todayKey; key = addManilaDays(key, 1)) {
    const dayStart = manilaDateKeyToStartMs(key);
    const bucket = buckets[manilaWeekday(dayStart)];
    const day = dayBuckets.get(key) || { totalMs: 0, sessions: 0 };
    bucket.occurrences += 1;
    bucket.totalMs += day.totalMs;
    bucket.sessions += day.sessions;
    if (day.sessions > 0) {
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

  const ready = daysObserved >= 14 && restDaysObserved >= 4 && eligible.length >= 5;
  return {
    ready,
    daysObserved,
    restDaysObserved,
    sessions: eligible.length,
    ranked,
    strongest: ready ? ranked[0] : null,
    weakest: ready ? ranked[ranked.length - 1] : null
  };
}

export function buildBoundedRestInsights(state, now = Date.now()) {
  const history = boundedRestHistory(state);
  const todayKey = manilaDateKey(now);
  const patternStartKey = addManilaDays(todayKey, -(REST_INSIGHTS_PATTERN_DAYS - 1));
  const dayBuckets = buildDaySkeleton(todayKey);

  history.forEach((entry) => {
    const bounds = safeSessionBounds(entry);
    if (bounds) addEntryToDayBuckets(entry, bounds, dayBuckets, patternStartKey, todayKey, now);
  });

  const daily = [];
  for (let offset = 0; offset <= 6; offset += 1) {
    const key = addManilaDays(todayKey, -offset);
    const bucket = dayBuckets.get(key) || { totalMs: 0, sessions: 0 };
    const dayStartMs = manilaDateKeyToStartMs(key);
    const weekdayLabel = formatManilaDate(dayStartMs, { weekday: 'short' });
    const baseDateLabel = formatManilaDate(dayStartMs, { month: 'short', day: 'numeric' });
    const relativeLabel = offset === 0 ? 'Today' : offset === 1 ? 'Yesterday' : null;
    daily.push({
      key,
      dateKey: key,
      label: weekdayLabel,
      weekdayLabel,
      relativeLabel,
      dateLabel: relativeLabel ? `${baseDateLabel} · ${relativeLabel}` : baseDateLabel,
      totalMs: bucket.totalMs,
      sessions: bucket.sessions
    });
  }

  const previousDaily = [];
  for (let offset = 7; offset <= 13; offset += 1) {
    const key = addManilaDays(todayKey, -offset);
    previousDaily.push(dayBuckets.get(key) || { totalMs: 0, sessions: 0 });
  }

  const currentStartKey = addManilaDays(todayKey, -6);
  const currentStartMs = manilaDateKeyToStartMs(currentStartKey);
  const currentEndMs = Number(now) + 1;
  const recent = history
    .map((entry) => ({ entry, bounds: safeSessionBounds(entry) }))
    .filter(({ bounds }) => overlapsWindow(bounds, currentStartMs, currentEndMs));

  const totalMs = daily.reduce((sum, day) => sum + day.totalMs, 0);
  const previousTotalMs = previousDaily.reduce((sum, day) => sum + day.totalMs, 0);
  const restDays = daily.filter((day) => day.sessions > 0).length;
  const previousRestDays = previousDaily.filter((day) => day.sessions > 0).length;
  const longestMs = recent.reduce(
    (longest, { bounds }) => Math.max(longest, overlapMs(bounds.start, bounds.end, currentStartMs, currentEndMs)),
    0
  );

  const byTime = new Map();
  recent.forEach(({ bounds }) => {
    const label = timeOfDay(bounds.start);
    byTime.set(label, (byTime.get(label) || 0) + 1);
  });

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
    mostCommonTime: [...byTime.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—',
    daily,
    weekdayPattern: buildWeekdayPattern(history, dayBuckets, todayKey, patternStartKey, now)
  };
}

export function buildBoundedRestAuditForDay(state, dayKey, now = Date.now()) {
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

  const entries = boundedRestHistory(state)
    .map((entry) => {
      const bounds = safeSessionBounds(entry);
      if (!bounds) return null;
      const creditedStartAt = Math.max(bounds.start, dayStart);
      const creditedEndAt = Math.min(bounds.end, effectiveEnd);
      const zeroDurationInside = bounds.start === bounds.end
        && bounds.start >= dayStart
        && bounds.start < effectiveEnd;
      const creditedMs = Math.max(0, creditedEndAt - creditedStartAt);
      if (creditedMs <= 0 && !zeroDurationInside) return null;

      return {
        id: entry.id || `rest-${bounds.start}-${bounds.end}`,
        label: String(entry.label || 'Rest'),
        reason: entry.reason || null,
        plannedMinutes: entry.plannedMinutes ?? null,
        timerExpiredAt: entry.timerExpiredAt ?? null,
        startAt: bounds.start,
        endedAt: bounds.end,
        sessionDurationMs: bounds.durationMs,
        creditedStartAt,
        creditedEndAt: zeroDurationInside ? bounds.start : creditedEndAt,
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

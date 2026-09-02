// Runtime adapter used by the production bundle to keep Rest Insights off the
// pointer-release call stack. The normal PausePanel remains the renderer; this
// adapter only provides a bounded, lightweight first-pass analytics result.

export function buildBoundedRestInsights(state, now = Date.now()) {
  const history = (Array.isArray(state?.history) ? state.history : [])
    .filter((entry) => entry && typeof entry === 'object')
    .slice(0, 500);

  const safeState = { ...state, history };
  const todayKey = manilaDateKey(now);
  const daily = [];

  for (let offset = 0; offset <= 6; offset += 1) {
    const key = addManilaDays(todayKey, -offset);
    const audit = restAuditForDay(safeState, key, now);
    const dayStartMs = manilaDateKeyToStartMs(key);
    const weekdayLabel = formatManilaDate(dayStartMs, { weekday: 'short' });
    const baseDateLabel = formatManilaDate(dayStartMs, { month: 'short', day: 'numeric' });
    const relativeLabel = offset === 0 ? 'Today' : offset === 1 ? 'Yesterday' : null;
    daily.push({ key, dateKey: key, label: weekdayLabel, weekdayLabel, relativeLabel, dateLabel: relativeLabel ? `${baseDateLabel} · ${relativeLabel}` : baseDateLabel, totalMs: audit.totalMs, sessions: audit.sessions });
  }

  const previousDaily = [];
  for (let offset = 7; offset <= 13; offset += 1) {
    const key = addManilaDays(todayKey, -offset);
    previousDaily.push(restAuditForDay(safeState, key, now));
  }

  const currentStartMs = manilaDateKeyToStartMs(addManilaDays(todayKey, -6));
  const recent = history.filter((entry) => {
    const start = Number(entry?.startAt ?? entry?.endedAt);
    const explicitEnd = Number(entry?.endedAt);
    const duration = Math.max(0, Number(entry?.durationMs || 0));
    const end = Number.isFinite(explicitEnd) && explicitEnd >= start ? explicitEnd : start + duration;
    return Number.isFinite(start) && Number.isFinite(end) && end >= currentStartMs && start <= now;
  });

  const totalMs = daily.reduce((sum, day) => sum + day.totalMs, 0);
  const previousTotalMs = previousDaily.reduce((sum, day) => sum + day.totalMs, 0);
  const restDays = daily.filter((day) => day.sessions > 0).length;
  const previousRestDays = previousDaily.filter((day) => day.sessions > 0).length;
  const longestMs = recent.reduce((longest, entry) => {
    const start = Number(entry?.startAt ?? entry?.endedAt);
    const explicitEnd = Number(entry?.endedAt);
    const duration = Math.max(0, Number(entry?.durationMs || 0));
    const end = Number.isFinite(explicitEnd) && explicitEnd >= start ? explicitEnd : start + duration;
    return Math.max(longest, Math.max(0, Math.min(end, now) - Math.max(start, currentStartMs)));
  }, 0);

  const byTime = new Map();
  recent.forEach((entry) => {
    const stamp = Number(entry?.startAt ?? entry?.endedAt);
    if (!Number.isFinite(stamp)) return;
    const hour = new Date(stamp + 8 * 60 * 60 * 1000).getUTCHours();
    const label = hour >= 5 && hour < 12 ? 'Morning' : hour >= 12 && hour < 17 ? 'Afternoon' : hour >= 17 && hour < 22 ? 'Evening' : 'Late night';
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
    weekdayPattern: { ready: false, daysObserved: 0, restDaysObserved: restDays, sessions: recent.length, ranked: [], strongest: null, weakest: null }
  };
}

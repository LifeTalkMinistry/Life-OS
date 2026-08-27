export const PAUSE_STORAGE_KEY = 'pause-state-v1';

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

export function loadPauseState() {
  try {
    const raw = localStorage.getItem(PAUSE_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
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
  } catch {
    return emptyState();
  }
}

export function savePauseState(state) {
  try {
    localStorage.setItem(PAUSE_STORAGE_KEY, JSON.stringify(state));
  } catch {}
  return state;
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

export function restInsights(state, now = Date.now()) {
  const since = now - 7 * 24 * 60 * 60 * 1000;
  const recent = state.history.filter((entry) => Number(entry.endedAt) >= since);
  const totalMs = recent.reduce((sum, entry) => sum + Number(entry.durationMs || 0), 0);
  const byType = new Map();
  recent.forEach((entry) => byType.set(entry.label, (byType.get(entry.label) || 0) + Number(entry.durationMs || 0)));
  const top = [...byType.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  return {
    sessions: recent.length,
    totalMs,
    averageMs: recent.length ? totalMs / recent.length : 0,
    top
  };
}

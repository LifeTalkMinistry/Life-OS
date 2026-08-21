import { demoActivities, initialFocusId } from '../data/activities.js';

const cloneActivities = (activities) => activities.map((activity) => ({ ...activity }));

export function createInitialLifeState() {
  return {
    activities: cloneActivities(demoActivities),
    currentId: initialFocusId,
    urgentResumeId: null,
    history: []
  };
}

export function currentActivity(state) {
  return state.activities.find((activity) => activity.id === state.currentId) ?? state.activities[0];
}

export function parseMinutes(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function format24(minutes) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function formatClock(time) {
  const minutes = parseMinutes(time);
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function nextFlexibleOrMajorActivity(state, afterId) {
  const index = state.activities.findIndex((activity) => activity.id === afterId);
  return state.activities.slice(index + 1).find((activity) => activity.id !== 'urgent')
    ?? state.activities.find((activity) => activity.id !== afterId && activity.id !== 'urgent')
    ?? state.activities[0];
}

export function completeCurrent(state) {
  const current = currentActivity(state);

  if (current.id === 'urgent' && state.urgentResumeId) {
    return {
      ...state,
      activities: state.activities.filter((activity) => activity.id !== 'urgent'),
      currentId: state.urgentResumeId,
      urgentResumeId: null,
      history: [...state.history, { type: 'completed', id: 'urgent' }]
    };
  }

  const next = nextFlexibleOrMajorActivity(state, current.id);
  return {
    ...state,
    currentId: next.id,
    history: [...state.history, { type: 'completed', id: current.id }]
  };
}

export function extendCurrent(state, extraMinutes) {
  const current = currentActivity(state);
  const currentIndex = state.activities.findIndex((activity) => activity.id === current.id);
  const newEnd = parseMinutes(current.end) + extraMinutes;
  let cursorEnd = newEnd;

  const activities = state.activities.map((activity, index) => {
    if (index === currentIndex) {
      return { ...activity, end: format24(newEnd) };
    }

    if (index <= currentIndex || activity.kind === 'fixed') {
      return activity;
    }

    const start = parseMinutes(activity.start);
    const end = parseMinutes(activity.end);
    if (start >= cursorEnd) return activity;

    const duration = Math.max(1, end - start);
    const shifted = {
      ...activity,
      start: format24(cursorEnd),
      end: format24(cursorEnd + duration),
      timeLabel: clockShort(format24(cursorEnd))
    };
    cursorEnd += duration;
    return shifted;
  });

  return {
    ...state,
    activities,
    history: [...state.history, { type: 'extended', id: current.id, minutes: extraMinutes }]
  };
}

export function deferCurrent(state, action) {
  const current = currentActivity(state);
  const next = nextFlexibleOrMajorActivity(state, current.id);
  let activities = state.activities;

  if (action === 'later') {
    activities = state.activities.map((activity) =>
      activity.id === current.id
        ? { ...activity, start: '20:45', end: '21:45', timeLabel: '8:45' }
        : activity
    );
  }

  if (action === 'another-day' || action === 'skip') {
    activities = state.activities.filter((activity) => activity.id !== current.id);
  }

  return {
    ...state,
    activities,
    currentId: next.id,
    history: [...state.history, { type: 'deferred', id: current.id, action }]
  };
}

export function addUrgentMatter(state, durationMinutes) {
  const now = new Date();
  const startMinutes = now.getHours() * 60 + now.getMinutes();
  const resolvedDuration = durationMinutes ?? 60;
  const endMinutes = startMinutes + resolvedDuration;
  const current = currentActivity(state);

  const urgent = {
    id: 'urgent',
    title: 'URGENT\nMATTER',
    shortTitle: 'Urgent Matter',
    start: format24(startMinutes),
    end: format24(endMinutes),
    timeLabel: clockShort(format24(startMinutes)),
    objective: 'Handle the interruption that cannot wait.',
    why: 'Reality changed, so LIFE OS temporarily protects this urgent matter.',
    recommendedMinutes: resolvedDuration,
    kind: 'urgent'
  };

  return {
    ...state,
    activities: [urgent, ...state.activities.filter((activity) => activity.id !== 'urgent')],
    currentId: urgent.id,
    urgentResumeId: current.id,
    history: [...state.history, { type: 'urgent', minutes: durationMinutes ?? null }]
  };
}

export function clockShort(time) {
  const minutes = parseMinutes(time);
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const hour12 = hour24 % 12 || 12;
  return minute ? `${hour12}:${String(minute).padStart(2, '0')}` : `${hour12}:00`;
}

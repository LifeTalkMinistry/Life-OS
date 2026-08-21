import { demoActivities, initialFocusId } from '../data/activities.js';
import { fixedKindLabel, normalizeLifeProfile } from './lifeProfile.js';

const cloneActivities = (activities) => activities.map((activity) => ({ ...activity }));

export function createInitialLifeState() {
  return {
    activities: cloneActivities(demoActivities),
    currentId: initialFocusId,
    urgentResumeId: null,
    history: []
  };
}


function dayIsFixed(profile, day) {
  return profile.fixedDays.includes(day);
}

function isActiveRange(nowMinutes, startMinutes, endMinutes) {
  if (startMinutes === endMinutes) return false;
  if (startMinutes < endMinutes) return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

function fixedScheduleIsActive(profile, date) {
  if (!profile.hasFixedSchedule) return false;
  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  const start = parseMinutes(profile.fixedStart);
  const end = parseMinutes(profile.fixedEnd);
  if (start < end) return dayIsFixed(profile, date.getDay()) && isActiveRange(nowMinutes, start, end);
  if (nowMinutes >= start) return dayIsFixed(profile, date.getDay());
  if (nowMinutes < end) return dayIsFixed(profile, (date.getDay() + 6) % 7);
  return false;
}

function sleepIsActive(profile, date) {
  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  return isActiveRange(nowMinutes, parseMinutes(profile.sleepStart), parseMinutes(profile.sleepEnd));
}

function upcomingStartToday(profile, date, startTime, allowedToday = true) {
  if (!allowedToday) return null;
  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  const start = parseMinutes(startTime);
  return start > nowMinutes ? start : null;
}

function profileFocusTitle(value) {
  const cleaned = String(value || 'Personal focus').trim().toUpperCase();
  if (cleaned.length <= 18) return cleaned;
  const midpoint = Math.floor(cleaned.length / 2);
  let split = cleaned.lastIndexOf(' ', midpoint);
  if (split < 8) split = cleaned.indexOf(' ', midpoint);
  return split > 0 ? `${cleaned.slice(0, split)}\n${cleaned.slice(split + 1)}` : cleaned;
}

export function createLifeStateFromProfile(rawProfile, date = new Date()) {
  const profile = normalizeLifeProfile(rawProfile);
  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  const fixedActive = fixedScheduleIsActive(profile, date);
  const sleepActive = sleepIsActive(profile, date);

  const upcomingFixed = profile.hasFixedSchedule
    ? upcomingStartToday(profile, date, profile.fixedStart, dayIsFixed(profile, date.getDay()))
    : null;
  const upcomingSleep = upcomingStartToday(profile, date, profile.sleepStart, true);
  const boundaries = [upcomingFixed, upcomingSleep].filter((value) => value !== null && value > nowMinutes);
  const requestedEnd = nowMinutes + profile.focusMinutes;
  const safeFocusEnd = boundaries.length ? Math.min(requestedEnd, ...boundaries) : requestedEnd;

  const focus = {
    id: 'current-focus',
    title: profileFocusTitle(profile.currentFocus),
    shortTitle: profile.currentFocus || 'Personal Focus',
    start: format24(nowMinutes),
    end: format24(safeFocusEnd),
    timeLabel: clockShort(format24(nowMinutes)),
    objective: `Move ${profile.currentFocus || 'your current focus'} forward.`,
    why: 'This is the direction you said matters most right now, while your fixed reality stays protected.',
    recommendedMinutes: Math.max(1, safeFocusEnd - nowMinutes),
    kind: 'flexible'
  };

  const activities = [focus];

  if (profile.hasFixedSchedule) {
    const fixedLabel = fixedKindLabel(profile.fixedKind);
    activities.push({
      id: 'fixed-schedule',
      title: fixedLabel.replace(' / ', '\n/ '),
      shortTitle: fixedLabel.replace(' / ', ' / '),
      start: profile.fixedStart,
      end: profile.fixedEnd,
      timeLabel: clockShort(profile.fixedStart),
      objective: `Honor your fixed ${fixedLabel.toLowerCase()} commitment.`,
      why: 'This is part of your fixed reality and LIFE OS does not casually move it.',
      recommendedMinutes: Math.max(1, (parseMinutes(profile.fixedEnd) - parseMinutes(profile.fixedStart) + 1440) % 1440),
      kind: 'fixed'
    });
  }

  activities.push({
    id: 'sleep',
    title: 'SLEEP',
    shortTitle: 'Sleep',
    start: profile.sleepStart,
    end: profile.sleepEnd,
    timeLabel: clockShort(profile.sleepStart),
    objective: 'Protect recovery and usable energy.',
    why: 'Sleep is protected as a biological requirement before optional activity expands.',
    recommendedMinutes: Math.max(1, (parseMinutes(profile.sleepEnd) - parseMinutes(profile.sleepStart) + 1440) % 1440),
    kind: 'fixed'
  });

  let currentId = focus.id;
  if (fixedActive) currentId = 'fixed-schedule';
  else if (sleepActive) currentId = 'sleep';

  return {
    activities,
    currentId,
    urgentResumeId: null,
    history: [],
    profile
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

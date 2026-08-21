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

function scheduledActivityIsActive(activity, date) {
  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  const start = parseMinutes(activity.start);
  const end = parseMinutes(activity.end);
  if (start < end) return activity.days.includes(date.getDay()) && isActiveRange(nowMinutes, start, end);
  if (nowMinutes >= start) return activity.days.includes(date.getDay());
  if (nowMinutes < end) return activity.days.includes((date.getDay() + 6) % 7);
  return false;
}

function activityTouchesToday(activity, date) {
  if (activity.days.includes(date.getDay())) return true;
  const start = parseMinutes(activity.start);
  const end = parseMinutes(activity.end);
  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  return start > end && nowMinutes < end && activity.days.includes((date.getDay() + 6) % 7);
}

function displayTitle(value) {
  const cleaned = String(value || 'Activity').trim().toUpperCase();
  if (cleaned.length <= 18) return cleaned;
  const midpoint = Math.floor(cleaned.length / 2);
  let split = cleaned.lastIndexOf(' ', midpoint);
  if (split < 8) split = cleaned.indexOf(' ', midpoint);
  return split > 0 ? `${cleaned.slice(0, split)}\n${cleaned.slice(split + 1)}` : cleaned;
}

function durationMinutes(start, end) {
  return Math.max(1, (parseMinutes(end) - parseMinutes(start) + 1440) % 1440);
}

function createScheduledActivity(activity) {
  return {
    id: activity.id,
    title: displayTitle(activity.name),
    shortTitle: activity.name,
    start: activity.start,
    end: activity.end,
    timeLabel: clockShort(activity.start),
    objective: `Stay with ${activity.name} during this block.`,
    why: 'This is the activity you assigned to this time in your Life Map.',
    recommendedMinutes: durationMinutes(activity.start, activity.end),
    kind: 'scheduled',
    schedule: activity
  };
}

function createFixedActivity(profile) {
  const fixedLabel = fixedKindLabel(profile.fixedKind);
  return {
    id: 'fixed-schedule',
    title: fixedLabel.replace(' / ', '\n/ '),
    shortTitle: fixedLabel.replace(' / ', ' / '),
    start: profile.fixedStart,
    end: profile.fixedEnd,
    timeLabel: clockShort(profile.fixedStart),
    objective: `Honor your fixed ${fixedLabel.toLowerCase()} commitment.`,
    why: profile.fixedGuidanceMode === 'breakdown'
      ? 'No more specific activity is mapped for this part of your fixed schedule.'
      : 'This is fixed time, so LIFE OS treats it as one protected block.',
    recommendedMinutes: durationMinutes(profile.fixedStart, profile.fixedEnd),
    kind: 'fixed'
  };
}

function createSleepActivity(profile) {
  return {
    id: 'sleep',
    title: 'SLEEP',
    shortTitle: 'Sleep',
    start: profile.sleepStart,
    end: profile.sleepEnd,
    timeLabel: clockShort(profile.sleepStart),
    objective: 'Protect recovery and usable energy.',
    why: 'Sleep stays protected before LIFE OS guides the rest of your activity.',
    recommendedMinutes: durationMinutes(profile.sleepStart, profile.sleepEnd),
    kind: 'fixed'
  };
}

function createOpenActivity(date) {
  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  return {
    id: 'open-time',
    title: 'OPEN TIME',
    shortTitle: 'Open Time',
    start: format24(nowMinutes),
    end: format24(nowMinutes + 60),
    timeLabel: clockShort(format24(nowMinutes)),
    objective: 'No activity is assigned to this block.',
    why: 'Your Life Map has no scheduled activity for this time.',
    recommendedMinutes: 60,
    kind: 'open'
  };
}

export function createLifeStateFromProfile(rawProfile, date = new Date()) {
  const profile = normalizeLifeProfile(rawProfile);
  const customActivities = profile.activities
    .filter((activity) => activityTouchesToday(activity, date))
    .map(createScheduledActivity)
    .sort((a, b) => parseMinutes(a.start) - parseMinutes(b.start));
  const activeCustom = customActivities.find((activity) => scheduledActivityIsActive(activity.schedule, date));
  const sleep = createSleepActivity(profile);
  const fixed = profile.hasFixedSchedule ? createFixedActivity(profile) : null;
  const open = createOpenActivity(date);
  const fixedActive = fixedScheduleIsActive(profile, date);
  const sleepActive = sleepIsActive(profile, date);

  const activities = [...customActivities];
  if (fixed && (dayIsFixed(profile, date.getDay()) || fixedActive)) activities.push(fixed);
  activities.push(sleep);
  activities.sort((a, b) => parseMinutes(a.start) - parseMinutes(b.start));

  let current = open;
  if (sleepActive) current = sleep;
  else if (profile.fixedGuidanceMode === 'outside' && fixedActive && fixed) current = fixed;
  else if (activeCustom) current = activeCustom;
  else if (fixedActive && fixed) current = fixed;

  if (current.id === open.id) activities.unshift(open);

  return {
    activities,
    currentId: current.id,
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

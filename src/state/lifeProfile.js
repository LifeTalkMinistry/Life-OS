import { activityIconIds } from '../activity-icons.js';

export const LIFE_PROFILE_STORAGE_KEY = 'life-os-v1-profile';

const PROFILE_ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const MINUTES_PER_DAY = 1440;
const MINUTES_PER_WEEK = MINUTES_PER_DAY * 7;
const ACTIVITY_ICONS = activityIconIds;

function normalizeDays(value, fallback = []) {
  if (!Array.isArray(value)) return [...fallback];
  return [...new Set(value.map(Number).filter((day) => day >= 0 && day <= 6))];
}

function normalizeTime(value, fallback = '') {
  const text = String(value ?? '');
  const match = /^(\d{2}):(\d{2})$/.exec(text);
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? text : fallback;
}

function normalizeActivityIcon(value) {
  return ACTIVITY_ICONS.includes(value) ? value : 'general';
}

function normalizeActivities(value) {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 56).map((activity, index) => {
    const name = String(activity?.name ?? '').trim().slice(0, 48);
    const days = normalizeDays(activity?.days);
    const start = normalizeTime(activity?.start);
    const end = normalizeTime(activity?.end);
    if (!name || !days.length || !start || !end || start === end) return null;

    return {
      id: String(activity?.id || `activity-${index + 1}`),
      name,
      icon: normalizeActivityIcon(activity?.icon),
      days,
      start,
      end
    };
  }).filter(Boolean);
}

function toMinutes(time) {
  const [hour, minute] = String(time || '').split(':').map(Number);
  return hour * 60 + minute;
}

function intervalForDay(day, start, end) {
  const startMinute = day * MINUTES_PER_DAY + toMinutes(start);
  let endMinute = day * MINUTES_PER_DAY + toMinutes(end);
  if (endMinute <= startMinute) endMinute += MINUTES_PER_DAY;
  return [startMinute, endMinute];
}

function overlaps([startA, endA], [startB, endB]) {
  return startA < endB && startB < endA;
}

function recurringIntervals(days, start, end, label, id = null) {
  const intervals = [];
  for (const day of days) {
    const base = intervalForDay(day, start, end);
    for (const offset of [-MINUTES_PER_WEEK, 0, MINUTES_PER_WEEK]) {
      intervals.push({
        start: base[0] + offset,
        end: base[1] + offset,
        label,
        id
      });
    }
  }
  return intervals;
}

export function findTimeConflict(rawProfile, day, start, end, ignoreActivityId = null) {
  const profile = normalizeLifeProfile(rawProfile);
  const numericDay = Number(day);
  if (!Number.isInteger(numericDay) || numericDay < 0 || numericDay > 6 || !start || !end || start === end) return null;

  const candidate = intervalForDay(numericDay, start, end);
  const occupied = [];

  occupied.push(...recurringIntervals(PROFILE_ALL_DAYS, profile.sleepStart, profile.sleepEnd, 'Sleep'));

  if (profile.hasFixedSchedule && profile.fixedGuidanceMode !== 'breakdown') {
    occupied.push(...recurringIntervals(
      profile.fixedDays,
      profile.fixedStart,
      profile.fixedEnd,
      fixedKindLabel(profile.fixedKind)
    ));
  }

  for (const activity of profile.activities) {
    if (activity.id === ignoreActivityId) continue;
    occupied.push(...recurringIntervals(activity.days, activity.start, activity.end, activity.name, activity.id));
  }

  const conflict = occupied.find((interval) => overlaps(candidate, [interval.start, interval.end]));
  return conflict ? { label: conflict.label, id: conflict.id } : null;
}

export function createEmptyLifeProfile() {
  return {
    version: 1,
    setupComplete: false,
    hasFixedSchedule: null,
    fixedKind: 'work',
    fixedDays: [1, 2, 3, 4, 5],
    fixedStart: '09:00',
    fixedEnd: '17:00',
    sleepStart: '23:00',
    sleepEnd: '07:00',
    fixedGuidanceMode: 'outside',
    activities: []
  };
}

export function normalizeLifeProfile(value = {}) {
  const base = createEmptyLifeProfile();
  const hasFixedSchedule = value.hasFixedSchedule === true || value.hasFixedSchedule === false
    ? value.hasFixedSchedule
    : null;

  return {
    version: 1,
    setupComplete: value.setupComplete === true,
    hasFixedSchedule,
    fixedKind: ['work', 'school', 'both'].includes(value.fixedKind) ? value.fixedKind : base.fixedKind,
    fixedDays: normalizeDays(value.fixedDays, base.fixedDays),
    fixedStart: normalizeTime(value.fixedStart, base.fixedStart),
    fixedEnd: normalizeTime(value.fixedEnd, base.fixedEnd),
    sleepStart: normalizeTime(value.sleepStart, base.sleepStart),
    sleepEnd: normalizeTime(value.sleepEnd, base.sleepEnd),
    fixedGuidanceMode: ['outside', 'breakdown'].includes(value.fixedGuidanceMode)
      ? value.fixedGuidanceMode
      : base.fixedGuidanceMode,
    activities: normalizeActivities(value.activities)
  };
}

export function isLifeProfileComplete(profile) {
  const value = normalizeLifeProfile(profile);
  const fixedReady = value.hasFixedSchedule === false
    || (value.hasFixedSchedule === true && value.fixedDays.length > 0 && value.fixedStart && value.fixedEnd);

  return value.setupComplete
    && fixedReady
    && Boolean(value.sleepStart && value.sleepEnd)
    && value.activities.length > 0;
}

export function fixedKindLabel(kind) {
  if (kind === 'school') return 'SCHOOL';
  if (kind === 'both') return 'WORK / SCHOOL';
  return 'WORK';
}

export const activityIcons = ACTIVITY_ICONS;
export const allDays = PROFILE_ALL_DAYS;

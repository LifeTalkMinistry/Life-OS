export const LIFE_PROFILE_STORAGE_KEY = 'life-os-v1-profile';

export const priorityOptions = [
  { id: 'faith', label: 'Faith' },
  { id: 'family', label: 'Family' },
  { id: 'health', label: 'Health' },
  { id: 'learning', label: 'Learning' },
  { id: 'business', label: 'Side project' },
  { id: 'creative', label: 'Creative' }
];

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
    priorities: [],
    nonNegotiables: [],
    currentFocus: '',
    focusMinutes: 60
  };
}

export function normalizeLifeProfile(value = {}) {
  const base = createEmptyLifeProfile();
  const fixedDays = Array.isArray(value.fixedDays)
    ? [...new Set(value.fixedDays.map(Number).filter((day) => day >= 0 && day <= 6))]
    : base.fixedDays;
  const priorities = Array.isArray(value.priorities)
    ? value.priorities.filter((id) => priorityOptions.some((item) => item.id === id)).slice(0, 4)
    : [];
  const nonNegotiables = Array.isArray(value.nonNegotiables)
    ? value.nonNegotiables.filter((id) => priorities.includes(id)).slice(0, 2)
    : [];

  return {
    ...base,
    ...value,
    version: 1,
    hasFixedSchedule: value.hasFixedSchedule === true || value.hasFixedSchedule === false
      ? value.hasFixedSchedule
      : null,
    fixedKind: ['work', 'school', 'both'].includes(value.fixedKind) ? value.fixedKind : base.fixedKind,
    fixedDays,
    priorities,
    nonNegotiables,
    currentFocus: String(value.currentFocus ?? '').trim().slice(0, 48),
    focusMinutes: [30, 60, 90].includes(Number(value.focusMinutes)) ? Number(value.focusMinutes) : 60,
    setupComplete: value.setupComplete === true
  };
}

export function isLifeProfileComplete(profile) {
  const value = normalizeLifeProfile(profile);
  const fixedReady = value.hasFixedSchedule === false
    || (value.hasFixedSchedule === true && value.fixedDays.length > 0 && value.fixedStart && value.fixedEnd);

  return value.setupComplete
    && fixedReady
    && Boolean(value.sleepStart && value.sleepEnd)
    && value.priorities.length > 0
    && Boolean(value.currentFocus);
}

export function fixedKindLabel(kind) {
  if (kind === 'school') return 'SCHOOL';
  if (kind === 'both') return 'WORK / SCHOOL';
  return 'WORK';
}

export function priorityLabel(id) {
  return priorityOptions.find((item) => item.id === id)?.label ?? id;
}

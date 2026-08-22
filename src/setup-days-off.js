/* Day-off sleep + transition model for LIFE OS V1.
 *
 * V1 keeps fixed work/school reality and day-off recovery in one setup flow:
 * - fixed days keep the normal sleepStart/sleepEnd schedule
 * - non-fixed days get their own dayOffSleepStart/dayOffSleepEnd schedule
 * - after an overnight final shift, the first day off begins at home arrival
 * - later day-off cycles begin from the day-off wake time
 *
 * This file is intentionally namespaced because the production build
 * concatenates modules into one script.
 */
const DAYOFFV1_ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DAYOFFV1_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAYOFFV1_DAY_NAMES = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday'
};
const DAYOFFV1_MINUTES_PER_DAY = 1440;
const DAYOFFV1_MINUTES_PER_WEEK = 10080;
const dayOffV1Bypass = new WeakSet();

function dayOffV1ValidTime(value, fallback = '') {
  const text = String(value ?? '');
  const match = /^(\d{2}):(\d{2})$/.exec(text);
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? text : fallback;
}

function dayOffV1Minutes(time) {
  const [hour, minute] = String(time || '00:00').split(':').map(Number);
  return (hour * 60) + minute;
}

function dayOffV1OffDays(profile) {
  if (!profile?.hasFixedSchedule) return [];
  const fixed = Array.isArray(profile.fixedDays) ? profile.fixedDays.map(Number) : [];
  return DAYOFFV1_ALL_DAYS.filter((day) => !fixed.includes(day));
}

function dayOffV1DayList(days) {
  const names = DAYOFFV1_DAY_ORDER
    .filter((day) => days.includes(day))
    .map((day) => DAYOFFV1_DAY_NAMES[day]);

  if (names.length <= 1) return names[0] || '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function dayOffV1IsOffDay(profile, day) {
  return dayOffV1OffDays(profile).includes(Number(day));
}

function dayOffV1SleepTimesForDay(profile, day) {
  const isOff = dayOffV1IsOffDay(profile, day);
  return {
    start: isOff
      ? dayOffV1ValidTime(profile?.dayOffSleepStart, profile?.sleepStart || '23:00')
      : profile?.sleepStart,
    end: isOff
      ? dayOffV1ValidTime(profile?.dayOffSleepEnd, profile?.sleepEnd || '07:00')
      : profile?.sleepEnd,
    isOff
  };
}

function dayOffV1FixedCrossesMidnight(profile) {
  if (!profile?.hasFixedSchedule || !profile.fixedStart || !profile.fixedEnd) return false;
  return dayOffV1Minutes(profile.fixedStart) >= dayOffV1Minutes(profile.fixedEnd);
}

function dayOffV1HomeAnchor(profile) {
  return (profile?.activities || []).find((activity) => activity.id === 'anchor-home-arrival') || null;
}

function dayOffV1TransitionFromWork(profile, day) {
  if (!dayOffV1IsOffDay(profile, day) || !dayOffV1FixedCrossesMidnight(profile)) return null;
  const previousDay = (Number(day) + 6) % 7;
  if (!profile.fixedDays?.includes(previousDay)) return null;
  const home = dayOffV1HomeAnchor(profile);
  return home?.end || null;
}

function dayOffV1RestrictPreSleepAnchor(profile) {
  if (!profile?.hasFixedSchedule) return;
  const anchor = (profile.activities || []).find((activity) => activity.id === 'anchor-pre-sleep');
  if (!anchor) return;
  anchor.days = [...profile.fixedDays];
}

/* Preserve the two sleep schedules through the existing V1 profile normalizer
 * in the self-contained production bundle. Existing profiles fall back to the
 * workday sleep schedule until the user sets day-off sleep explicitly. */
const DAYOFFV1_ORIGINAL_NORMALIZE = typeof normalizeLifeProfile === 'function' ? normalizeLifeProfile : null;
if (DAYOFFV1_ORIGINAL_NORMALIZE) {
  normalizeLifeProfile = function dayOffV1NormalizeLifeProfile(value = {}) {
    const normalized = DAYOFFV1_ORIGINAL_NORMALIZE(value);
    normalized.dayOffSleepStart = dayOffV1ValidTime(value?.dayOffSleepStart, normalized.sleepStart);
    normalized.dayOffSleepEnd = dayOffV1ValidTime(value?.dayOffSleepEnd, normalized.sleepEnd);
    return normalized;
  };
}

const DAYOFFV1_ORIGINAL_EMPTY_PROFILE = typeof createEmptyLifeProfile === 'function' ? createEmptyLifeProfile : null;
if (DAYOFFV1_ORIGINAL_EMPTY_PROFILE) {
  createEmptyLifeProfile = function dayOffV1CreateEmptyLifeProfile() {
    const profile = DAYOFFV1_ORIGINAL_EMPTY_PROFILE();
    return {
      ...profile,
      dayOffSleepStart: profile.sleepStart,
      dayOffSleepEnd: profile.sleepEnd
    };
  };
}

/* Recover persisted day-off sleep fields on reload. The old normalizer runs
 * before this patch is installed, so read the raw saved profile once. */
if (typeof lifeProfile !== 'undefined' && DAYOFFV1_ORIGINAL_NORMALIZE) {
  let dayOffV1RawProfile = null;
  try {
    const raw = localStorage.getItem(typeof LIFE_PROFILE_STORAGE_KEY === 'string' ? LIFE_PROFILE_STORAGE_KEY : 'life-os-v1-profile');
    dayOffV1RawProfile = raw ? JSON.parse(raw) : null;
  } catch {}

  lifeProfile = normalizeLifeProfile({
    ...lifeProfile,
    dayOffSleepStart: dayOffV1RawProfile?.dayOffSleepStart ?? lifeProfile.sleepStart,
    dayOffSleepEnd: dayOffV1RawProfile?.dayOffSleepEnd ?? lifeProfile.sleepEnd
  });
  if (typeof hasCompletedSetup !== 'undefined' && typeof isLifeProfileComplete === 'function') {
    hasCompletedSetup = isLifeProfileComplete(lifeProfile);
  }
}

function dayOffV1Interval(day, start, end) {
  const startMinute = (Number(day) * DAYOFFV1_MINUTES_PER_DAY) + dayOffV1Minutes(start);
  let endMinute = (Number(day) * DAYOFFV1_MINUTES_PER_DAY) + dayOffV1Minutes(end);
  if (endMinute <= startMinute) endMinute += DAYOFFV1_MINUTES_PER_DAY;
  return [startMinute, endMinute];
}

function dayOffV1Overlap(a, b) {
  return a[0] < b[1] && b[0] < a[1];
}

function dayOffV1RecurringIntervals(days, start, end, label, id = null) {
  const intervals = [];
  if (!start || !end || start === end) return intervals;
  for (const day of days) {
    const base = dayOffV1Interval(day, start, end);
    for (const offset of [-DAYOFFV1_MINUTES_PER_WEEK, 0, DAYOFFV1_MINUTES_PER_WEEK]) {
      intervals.push({
        start: base[0] + offset,
        end: base[1] + offset,
        label,
        id,
        scheduleDay: day,
        scheduleStart: start,
        scheduleEnd: end
      });
    }
  }
  return intervals;
}

function dayOffV1SleepIntervals(profile) {
  const offDays = dayOffV1OffDays(profile);
  if (!profile?.hasFixedSchedule || !offDays.length) {
    return dayOffV1RecurringIntervals(DAYOFFV1_ALL_DAYS, profile.sleepStart, profile.sleepEnd, 'Sleep');
  }

  return [
    ...dayOffV1RecurringIntervals(profile.fixedDays, profile.sleepStart, profile.sleepEnd, 'Sleep'),
    ...dayOffV1RecurringIntervals(
      offDays,
      dayOffV1ValidTime(profile.dayOffSleepStart, profile.sleepStart),
      dayOffV1ValidTime(profile.dayOffSleepEnd, profile.sleepEnd),
      'Sleep'
    )
  ];
}

/* Make overlap protection understand that workdays and days off can have
 * different sleep blocks. */
function dayOffV1FindTimeConflict(rawProfile, day, start, end, ignoreActivityId = null) {
  const profile = typeof normalizeLifeProfile === 'function' ? normalizeLifeProfile(rawProfile) : rawProfile;
  const numericDay = Number(day);
  if (!Number.isInteger(numericDay) || numericDay < 0 || numericDay > 6 || !start || !end || start === end) return null;

  const candidate = dayOffV1Interval(numericDay, start, end);
  const occupied = [...dayOffV1SleepIntervals(profile)];

  if (profile.hasFixedSchedule && profile.fixedGuidanceMode !== 'breakdown') {
    const label = typeof fixedKindLabel === 'function' ? fixedKindLabel(profile.fixedKind) : 'WORK / SCHOOL';
    occupied.push(...dayOffV1RecurringIntervals(profile.fixedDays, profile.fixedStart, profile.fixedEnd, label));
  }

  for (const activity of profile.activities || []) {
    if (activity.id === ignoreActivityId) continue;
    occupied.push(...dayOffV1RecurringIntervals(activity.days || [], activity.start, activity.end, activity.name, activity.id));
  }

  const conflict = occupied.find((interval) => dayOffV1Overlap(candidate, [interval.start, interval.end]));
  return conflict ? { label: conflict.label, id: conflict.id } : null;
}

if (typeof findTimeConflict === 'function') {
  findTimeConflict = dayOffV1FindTimeConflict;
}

function dayOffV1ActiveSleepInterval(profile, date) {
  const nowWeekMinute = (date.getDay() * DAYOFFV1_MINUTES_PER_DAY) + (date.getHours() * 60) + date.getMinutes();
  return dayOffV1SleepIntervals(profile).find((interval) => nowWeekMinute >= interval.start && nowWeekMinute < interval.end) || null;
}

function dayOffV1SleepActivity(profile, date) {
  const active = dayOffV1ActiveSleepInterval(profile, date);
  const schedule = active
    ? { start: active.scheduleStart, end: active.scheduleEnd }
    : dayOffV1SleepTimesForDay(profile, date.getDay());
  const start = schedule.start;
  const end = schedule.end;
  const duration = Math.max(1, (dayOffV1Minutes(end) - dayOffV1Minutes(start) + DAYOFFV1_MINUTES_PER_DAY) % DAYOFFV1_MINUTES_PER_DAY);
  return {
    id: 'sleep',
    title: 'SLEEP',
    shortTitle: 'Sleep',
    start,
    end,
    timeLabel: typeof clockShort === 'function' ? clockShort(start) : start,
    objective: 'Protect recovery and usable energy.',
    why: 'Sleep stays protected before LIFE OS guides the rest of your activity.',
    recommendedMinutes: duration,
    kind: 'fixed'
  };
}

/* Rebuild the live V1 state with the sleep schedule that belongs to the
 * current calendar day (or the previous day when an overnight sleep is still
 * active). */
const DAYOFFV1_ORIGINAL_CREATE_STATE = typeof createLifeStateFromProfile === 'function' ? createLifeStateFromProfile : null;
if (DAYOFFV1_ORIGINAL_CREATE_STATE
  && typeof activityTouchesToday === 'function'
  && typeof createScheduledActivity === 'function'
  && typeof scheduledActivityIsActive === 'function'
  && typeof createFixedActivity === 'function'
  && typeof createOpenActivity === 'function'
  && typeof fixedScheduleIsActive === 'function') {
  createLifeStateFromProfile = function dayOffV1CreateLifeStateFromProfile(rawProfile, date = new Date()) {
    const profile = normalizeLifeProfile(rawProfile);
    const customActivities = profile.activities
      .filter((activity) => activityTouchesToday(activity, date))
      .map(createScheduledActivity)
      .sort((a, b) => dayOffV1Minutes(a.start) - dayOffV1Minutes(b.start));
    const activeCustom = customActivities.find((activity) => scheduledActivityIsActive(activity.schedule, date));
    const sleep = dayOffV1SleepActivity(profile, date);
    const fixed = profile.hasFixedSchedule ? createFixedActivity(profile) : null;
    const open = createOpenActivity(date);
    const fixedActive = fixedScheduleIsActive(profile, date);
    const sleepActive = Boolean(dayOffV1ActiveSleepInterval(profile, date));

    const activities = [...customActivities];
    if (fixed && ((profile.fixedDays || []).includes(date.getDay()) || fixedActive)) activities.push(fixed);
    activities.push(sleep);
    activities.sort((a, b) => dayOffV1Minutes(a.start) - dayOffV1Minutes(b.start));

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
  };

  if (typeof lifeState !== 'undefined' && typeof lifeProfile !== 'undefined' && typeof hasCompletedSetup !== 'undefined' && hasCompletedSetup) {
    lifeState = createLifeStateFromProfile(lifeProfile);
  }
}

/* In the production bundle, replace the activity-day cursor so the first
 * overnight day off begins when the user gets home from the final shift.
 * Other day-off cycles begin at the day-off wake time. */
const DAYOFFV1_ORIGINAL_ACTIVITY_CURSOR = typeof activityCursorForDay === 'function' ? activityCursorForDay : null;
if (DAYOFFV1_ORIGINAL_ACTIVITY_CURSOR) {
  activityCursorForDay = function dayOffV1ActivityCursorForDay(day) {
    if (!dayOffV1IsOffDay(lifeProfile, day)) return DAYOFFV1_ORIGINAL_ACTIVITY_CURSOR(day);

    const transition = dayOffV1TransitionFromWork(lifeProfile, day);
    let cursor = transition || dayOffV1SleepTimesForDay(lifeProfile, day).end;
    const custom = (lifeProfile.activities || [])
      .filter((activity) => !isAnchorActivity(activity) && activity.days.includes(day))
      .sort((a, b) => a.start.localeCompare(b.start));

    let changed = true;
    while (changed) {
      changed = false;
      const next = custom.find((activity) => activity.start === cursor);
      if (next) {
        cursor = next.end;
        changed = true;
      }
    }
    return cursor;
  };
}

/* The core day builder uses sleepStart as its natural stopping boundary.
 * Feed it the day-off sleep time only for non-fixed days and hide the workday
 * pre-sleep anchor from those days. */
const DAYOFFV1_ORIGINAL_ACTIVITIES_CONTENT = typeof activitiesContent === 'function' ? activitiesContent : null;
if (DAYOFFV1_ORIGINAL_ACTIVITIES_CONTENT) {
  activitiesContent = function dayOffV1ActivitiesContent(profile, draft, activityDay) {
    if (!dayOffV1IsOffDay(profile, activityDay)) return DAYOFFV1_ORIGINAL_ACTIVITIES_CONTENT(profile, draft, activityDay);
    const sleep = dayOffV1SleepTimesForDay(profile, activityDay);
    const adapted = {
      ...profile,
      sleepStart: sleep.start,
      sleepEnd: sleep.end,
      activities: (profile.activities || []).filter((activity) => activity.id !== 'anchor-pre-sleep')
    };
    return DAYOFFV1_ORIGINAL_ACTIVITIES_CONTENT(adapted, draft, activityDay);
  };
}

/* Keep onboarding orbit and list summaries aligned with the separate day-off
 * sleep schedule in the production bundle. */
const DAYOFFV1_ORIGINAL_BLOCKS_FOR_DAY = typeof blocksForDay === 'function' ? blocksForDay : null;
if (DAYOFFV1_ORIGINAL_BLOCKS_FOR_DAY) {
  blocksForDay = function dayOffV1BlocksForDay(profile, day) {
    const sleep = dayOffV1SleepTimesForDay(profile, day);
    const adapted = {
      ...profile,
      sleepStart: sleep.start,
      sleepEnd: sleep.end,
      activities: dayOffV1IsOffDay(profile, day)
        ? (profile.activities || []).filter((activity) => activity.id !== 'anchor-pre-sleep')
        : profile.activities
    };
    return DAYOFFV1_ORIGINAL_BLOCKS_FOR_DAY(adapted, day);
  };
}

const DAYOFFV1_ORIGINAL_STATE_KEY = typeof stateKey === 'function' ? stateKey : null;
if (DAYOFFV1_ORIGINAL_STATE_KEY) {
  stateKey = function dayOffV1StateKey(profile, day) {
    const sleep = dayOffV1SleepTimesForDay(profile, day);
    return DAYOFFV1_ORIGINAL_STATE_KEY({ ...profile, sleepStart: sleep.start, sleepEnd: sleep.end }, day);
  };
}

const DAYOFFV1_ORIGINAL_SUMMARY_BLOCKS = typeof summaryBlocksForDay === 'function' ? summaryBlocksForDay : null;
if (DAYOFFV1_ORIGINAL_SUMMARY_BLOCKS) {
  summaryBlocksForDay = function dayOffV1SummaryBlocksForDay(profile, day) {
    const sleep = dayOffV1SleepTimesForDay(profile, day);
    const adapted = {
      ...profile,
      sleepStart: sleep.start,
      sleepEnd: sleep.end,
      activities: dayOffV1IsOffDay(profile, day)
        ? (profile.activities || []).filter((activity) => activity.id !== 'anchor-pre-sleep')
        : profile.activities
    };
    return DAYOFFV1_ORIGINAL_SUMMARY_BLOCKS(adapted, day);
  };
}

const DAYOFFV1_ORIGINAL_SUMMARY_KEY = typeof summaryStateKey === 'function' ? summaryStateKey : null;
if (DAYOFFV1_ORIGINAL_SUMMARY_KEY) {
  summaryStateKey = function dayOffV1SummaryStateKey(profile, day) {
    const sleep = dayOffV1SleepTimesForDay(profile, day);
    return DAYOFFV1_ORIGINAL_SUMMARY_KEY({ ...profile, sleepStart: sleep.start, sleepEnd: sleep.end }, day);
  };
}

function dayOffV1CloseSleepSetup(orb, overlay) {
  orb.classList.remove('has-day-off-sleep');
  overlay.remove();
}

function dayOffV1OpenSleepSetup(originalButton, profile) {
  document.querySelector('.setup-day-off-sleep')?.remove();
  const orb = originalButton.closest('.orb');
  if (!orb) return;

  dayOffV1RestrictPreSleepAnchor(profile);
  const offDays = dayOffV1OffDays(profile);
  if (!offDays.length) {
    dayOffV1Bypass.add(originalButton);
    originalButton.click();
    return;
  }

  const currentStart = dayOffV1ValidTime(profile.dayOffSleepStart, profile.sleepStart);
  const currentEnd = dayOffV1ValidTime(profile.dayOffSleepEnd, profile.sleepEnd);
  const overlay = document.createElement('div');
  overlay.className = 'setup-day-off-sleep';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Set day off sleep');
  overlay.innerHTML = `
    <div class="setup-day-off-sleep-content">
      <p class="setup-day-off-sleep-eyebrow">DAYS OFF</p>
      <h2>When do you usually sleep on your days off?</h2>
      <p class="setup-day-off-sleep-days">${dayOffV1DayList(offDays)}</p>
      <div class="setup-day-off-sleep-times">
        <label><span>Sleep</span><input type="time" data-day-off-sleep-start value="${currentStart}"></label>
        <label><span>Wake</span><input type="time" data-day-off-sleep-end value="${currentEnd}"></label>
      </div>
      <button type="button" class="setup-day-off-sleep-primary" data-day-off-sleep-continue>Continue</button>
      <button type="button" class="setup-day-off-sleep-back" data-day-off-sleep-back>Back</button>
    </div>
  `;

  const startInput = overlay.querySelector('[data-day-off-sleep-start]');
  const endInput = overlay.querySelector('[data-day-off-sleep-end]');
  const continueButton = overlay.querySelector('[data-day-off-sleep-continue]');

  const refresh = () => {
    const start = startInput?.value || '';
    const end = endInput?.value || '';
    if (continueButton) continueButton.disabled = !start || !end || start === end;
  };
  startInput?.addEventListener('input', refresh);
  endInput?.addEventListener('input', refresh);
  startInput?.addEventListener('change', refresh);
  endInput?.addEventListener('change', refresh);

  continueButton?.addEventListener('click', () => {
    const start = startInput?.value || '';
    const end = endInput?.value || '';
    if (!start || !end || start === end) return;
    profile.dayOffSleepStart = start;
    profile.dayOffSleepEnd = end;
    dayOffV1CloseSleepSetup(orb, overlay);
    dayOffV1Bypass.add(originalButton);
    originalButton.click();
  });

  overlay.querySelector('[data-day-off-sleep-back]')?.addEventListener('click', () => {
    dayOffV1CloseSleepSetup(orb, overlay);
  });

  orb.classList.add('has-day-off-sleep');
  orb.appendChild(overlay);
  refresh();
  startInput?.focus();
}

/* The old separate day-off confirmation is gone. The actual day-off sleep
 * question is now the confirmation and appears immediately after home-arrival
 * is defined, before activity mapping begins. */
document.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  if (!button || button.dataset.setupAction !== 'home-arrival-continue') return;
  if (dayOffV1Bypass.has(button)) {
    dayOffV1Bypass.delete(button);
    return;
  }

  const state = window.__LIFE_OS__?.getState?.();
  if (!state || state.screen !== 'setup') return;
  const profile = state.lifeProfile;
  if (!profile?.hasFixedSchedule || !dayOffV1OffDays(profile).length) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  dayOffV1OpenSleepSetup(button, profile);
}, true);

function dayOffV1ApplySetupCopy() {
  const state = window.__LIFE_OS__?.getState?.();
  if (!state || state.screen !== 'setup') return;
  const profile = state.lifeProfile;
  if (!profile) return;

  /* Clarify that the first sleep question belongs to fixed/work days. */
  if (state.setupStep === 'sleep' && profile.hasFixedSchedule && dayOffV1OffDays(profile).length) {
    const eyebrow = document.querySelector('.setup-step-sleep .setup-eyebrow');
    const question = document.querySelector('.setup-step-sleep .setup-question');
    if (eyebrow) eyebrow.textContent = 'FIXED DAYS · RECOVERY';
    if (question) question.textContent = 'When do you usually sleep on your fixed days?';
  }

  /* Once Prepare for sleep exists, keep it on fixed days only. Day-off setup
   * intentionally asks only for the actual sleep/wake block. */
  if (state.setupStep === 'home-arrival' || state.setupStep === 'activities') {
    dayOffV1RestrictPreSleepAnchor(profile);
  }

  if (state.setupStep !== 'activities' || !dayOffV1IsOffDay(profile, state.setupActivityDay)) return;

  const day = Number(state.setupActivityDay);
  const custom = (profile.activities || []).filter((activity) =>
    activity.id !== 'anchor-pre-fixed'
    && activity.id !== 'anchor-pre-sleep'
    && activity.id !== 'anchor-home-arrival'
    && activity.days?.includes(day)
  );

  /* Source-module fallback: the production bundle replaces activityCursorForDay
   * directly. In module mode, mutate the live draft object before the first
   * activity is saved so the visible cursor still begins in the right place. */
  if (!custom.length && state.setupActivityDraft) {
    const desired = dayOffV1TransitionFromWork(profile, day) || dayOffV1SleepTimesForDay(profile, day).end;
    const oldDefault = profile.sleepEnd;
    if (state.setupActivityDraft.start === oldDefault && desired && desired !== oldDefault) {
      state.setupActivityDraft.start = desired;
    }
  }

  const builder = document.querySelector('.setup-step-activities .setup-day-builder');
  if (!builder) return;

  /* Do not offer "Same as Friday" when Friday is a fixed workday and Saturday
   * is a day off. Copy remains available when both days share the same type. */
  const targetIndex = DAYOFFV1_DAY_ORDER.indexOf(day);
  if (targetIndex > 0) {
    const sourceDay = DAYOFFV1_DAY_ORDER[targetIndex - 1];
    const sourceIsOff = dayOffV1IsOffDay(profile, sourceDay);
    const targetIsOff = dayOffV1IsOffDay(profile, day);
    if (sourceIsOff !== targetIsOff) builder.querySelector('[data-copy-previous-day]')?.remove();
  }

  const sleep = dayOffV1SleepTimesForDay(profile, day);
  const draftStart = state.setupActivityDraft?.start;
  const question = builder.querySelector('.setup-question');
  const transition = dayOffV1TransitionFromWork(profile, day);

  if (draftStart === sleep.start && !builder.classList.contains('setup-day-complete')) {
    builder.classList.add('setup-day-complete');
    const eyebrow = builder.querySelector('.setup-eyebrow');
    if (eyebrow) eyebrow.textContent = (DAYOFFV1_DAY_NAMES[day] || 'DAY').toUpperCase();
    if (question) question.textContent = `${DAYOFFV1_DAY_NAMES[day] || 'Day'} is mapped.`;
    builder.querySelector('.setup-activity-name-row')?.remove();
    builder.querySelector('[data-copy-previous-day]')?.remove();
    builder.querySelector('[data-finish-current-day]')?.remove();
    const continueButton = builder.querySelector('[data-setup-action="activity-name-continue"]');
    if (continueButton) {
      continueButton.dataset.setupAction = 'activity-day-next';
      continueButton.disabled = false;
      continueButton.textContent = day === 0 ? 'Review week' : `${DAYOFFV1_DAY_NAMES[day]} looks good`;
    }
    return;
  }

  if (!question) return;
  if (transition && draftStart === transition) {
    question.textContent = `You're off now. What do you do after getting home?`;
    builder.classList.add('is-day-off');
    return;
  }
  if (draftStart === sleep.end) {
    question.textContent = `It's your day off. What do you usually do after waking up?`;
    builder.classList.add('is-day-off');
  }
}

let dayOffV1Frame = null;
function dayOffV1QueueSetupCopy() {
  if (dayOffV1Frame !== null) cancelAnimationFrame(dayOffV1Frame);
  dayOffV1Frame = requestAnimationFrame(() => {
    dayOffV1Frame = null;
    dayOffV1ApplySetupCopy();
  });
}

const dayOffV1App = document.querySelector('#app');
if (dayOffV1App) {
  const dayOffV1Observer = new MutationObserver(dayOffV1QueueSetupCopy);
  dayOffV1Observer.observe(dayOffV1App, { childList: true, subtree: true });
  dayOffV1QueueSetupCopy();
}

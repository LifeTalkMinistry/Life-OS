import test from 'node:test';
import assert from 'node:assert/strict';

import {
  derivePauseSleepRoutineStreak,
  pauseSleepStreakDayResult,
  pauseSleepStreakRequiredMinutes,
  pauseSleepStreakSleepMinutesForDay
} from '../src/sleepRoutineStreak.js';
import { manilaDateKeyToStartMs } from '../src/manilaTime.js';

const MINUTE = 60_000;

function plan(overrides = {}) {
  return {
    setupComplete: true,
    workDays: [1, 2, 3, 4, 5],
    recoveryMinutes: 420,
    ...overrides
  };
}

function session(dateKey, startMinute, durationMinutes, overrides = {}) {
  const startAt = manilaDateKeyToStartMs(dateKey) + startMinute * MINUTE;
  return {
    label: 'Sleep',
    startAt,
    endedAt: startAt + durationMinutes * MINUTE,
    durationMs: durationMinutes * MINUTE,
    ...overrides
  };
}

function nowOn(dateKey, minute = 18 * 60) {
  return manilaDateKeyToStartMs(dateKey) + minute * MINUTE;
}

test('requires both the six-hour floor and 90% of Planned Sleep', () => {
  assert.equal(pauseSleepStreakRequiredMinutes(420), 378);
  assert.equal(pauseSleepStreakRequiredMinutes(480), 432);
  assert.equal(pauseSleepStreakRequiredMinutes(330), 360);
});

test('a routine day qualifies at 90% but not one minute below it', () => {
  const dateKey = '2026-09-07'; // Monday
  const enough = pauseSleepStreakDayResult({
    history: [session(dateKey, 600, 378)],
    plan: plan(),
    dateKey
  });
  const short = pauseSleepStreakDayResult({
    history: [session(dateKey, 600, 377)],
    plan: plan(),
    dateKey
  });

  assert.equal(enough.requiredMinutes, 378);
  assert.equal(enough.qualifies, true);
  assert.equal(short.qualifies, false);
});

test('a planned Sleep shorter than six hours cannot qualify below the six-hour floor', () => {
  const dateKey = '2026-09-07';
  const fullShortPlan = pauseSleepStreakDayResult({
    history: [session(dateKey, 600, 330)],
    plan: plan({ recoveryMinutes: 330 }),
    dateKey
  });

  assert.equal(fullShortPlan.requiredMinutes, 360);
  assert.equal(fullShortPlan.recordedSleepMinutes, 330);
  assert.equal(fullShortPlan.qualifies, false);
});

test('multiple explicit Sleep sessions combine while generic Rest contributes nothing', () => {
  const dateKey = '2026-09-07';
  const history = [
    session(dateKey, 600, 240),
    session(dateKey, 1000, 150),
    session(dateKey, 120, 180, { label: 'Rest' }),
    session(dateKey, 300, 180, { label: 'Sleep', sessionType: 'rest' })
  ];

  assert.equal(pauseSleepStreakSleepMinutesForDay(history, dateKey), 390);
  assert.equal(pauseSleepStreakDayResult({ history, plan: plan(), dateKey }).qualifies, true);
});

test('non-routine days are neutral and do not break the streak', () => {
  const history = [
    session('2026-09-09', 600, 390), // Wed
    session('2026-09-10', 600, 390), // Thu
    session('2026-09-11', 600, 390)  // Fri
  ];

  const result = derivePauseSleepRoutineStreak({
    pauseState: { history },
    plan: plan(),
    now: nowOn('2026-09-12') // Saturday, non-routine day
  });

  assert.equal(result.streak, 3);
  assert.equal(result.today.eligible, false);
});

test('a past eligible routine day without enough Recorded Sleep resets the streak', () => {
  const history = [
    session('2026-09-09', 600, 390), // Wed qualifies
    session('2026-09-10', 600, 300), // Thu misses
    session('2026-09-11', 600, 390)  // Fri qualifies
  ];

  const result = derivePauseSleepRoutineStreak({
    pauseState: { history },
    plan: plan(),
    now: nowOn('2026-09-12')
  });

  assert.equal(result.streak, 1);
});

test('the current routine day can qualify immediately but is not reset before the day is complete', () => {
  const monday = session('2026-09-07', 600, 390);
  const pending = derivePauseSleepRoutineStreak({
    pauseState: { history: [monday] },
    plan: plan(),
    now: nowOn('2026-09-08', 8 * 60)
  });

  assert.equal(pending.today.eligible, true);
  assert.equal(pending.today.qualifies, false);
  assert.equal(pending.streak, 1);

  const qualified = derivePauseSleepRoutineStreak({
    pauseState: { history: [monday, session('2026-09-08', 600, 390)] },
    plan: plan(),
    now: nowOn('2026-09-08')
  });

  assert.equal(qualified.today.qualifies, true);
  assert.equal(qualified.streak, 2);
});

test('historical Sleep corrections automatically recalculate the derived streak', () => {
  const tuesday = session('2026-09-08', 600, 390);
  const beforeCorrection = derivePauseSleepRoutineStreak({
    pauseState: {
      history: [
        session('2026-09-07', 600, 350),
        tuesday
      ]
    },
    plan: plan(),
    now: nowOn('2026-09-09', 8 * 60)
  });

  assert.equal(beforeCorrection.streak, 1);

  const afterCorrection = derivePauseSleepRoutineStreak({
    pauseState: {
      history: [
        session('2026-09-07', 600, 390, { manuallyEdited: true }),
        tuesday
      ]
    },
    plan: plan(),
    now: nowOn('2026-09-09', 8 * 60)
  });

  assert.equal(afterCorrection.streak, 2);
});

test('night-shift workdays map to the following Sleep Routine calendar day', () => {
  const nightPlan = plan({
    shiftStart: '22:00',
    shiftEnd: '08:00',
    commuteMinutes: 60,
    windDownMinutes: 60,
    sleepStart: '10:00'
  });

  const tuesdaySleep = pauseSleepStreakDayResult({
    history: [session('2026-09-08', 600, 390)],
    plan: nightPlan,
    dateKey: '2026-09-08'
  });
  const mondayCalendarDay = pauseSleepStreakDayResult({
    history: [session('2026-09-07', 600, 390)],
    plan: nightPlan,
    dateKey: '2026-09-07'
  });
  const saturdaySleep = pauseSleepStreakDayResult({
    history: [session('2026-09-12', 600, 390)],
    plan: nightPlan,
    dateKey: '2026-09-12'
  });

  assert.equal(tuesdaySleep.routineDayOffset, 1);
  assert.equal(tuesdaySleep.workWeekday, 1); // Monday workday
  assert.equal(tuesdaySleep.eligible, true);
  assert.equal(tuesdaySleep.qualifies, true);
  assert.equal(mondayCalendarDay.eligible, false); // Sunday workday would be required
  assert.equal(saturdaySleep.workWeekday, 5); // Friday workday
  assert.equal(saturdaySleep.eligible, true);
});

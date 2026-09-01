import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveRecoveryThiefPrompt,
  normalizeRecoveryThiefStore
} from '../src/recoveryThiefLog.js';

function nightShiftPlan(overrides = {}) {
  return {
    setupComplete: true,
    workDays: [1, 2, 3, 4, 5],
    shiftStart: '22:00',
    shiftEnd: '08:00',
    sleepStart: '09:15',
    ...overrides
  };
}

test('sleep delay prompt anchors to the declared next-day sleep start', () => {
  const prompt = deriveRecoveryThiefPrompt(
    nightShiftPlan({ workDays: [1] }),
    {},
    new Date(2026, 8, 1, 9, 30, 0)
  );

  assert.ok(prompt);
  assert.equal(prompt.cycleKey, '2026-08-31:22:00:09:15');
  assert.equal(prompt.observedDelayMinutes, 15);
  assert.equal(new Date(prompt.plannedSleepStartAt).getHours(), 9);
  assert.equal(new Date(prompt.plannedSleepStartAt).getMinutes(), 15);
});

test('sleep delay prompt stays quiet before the 15-minute grace period', () => {
  const prompt = deriveRecoveryThiefPrompt(
    nightShiftPlan({ workDays: [1] }),
    {},
    new Date(2026, 8, 1, 9, 29, 0)
  );

  assert.equal(prompt, null);
});

test('sleep delay prompt does not interrogate the user hours later', () => {
  const prompt = deriveRecoveryThiefPrompt(
    nightShiftPlan({ workDays: [1] }),
    {},
    new Date(2026, 8, 1, 11, 16, 0)
  );

  assert.equal(prompt, null);
});

test('a logged cycle is not prompted again', () => {
  const store = normalizeRecoveryThiefStore({
    logs: [{
      id: 'thief-1',
      cycleKey: '2026-08-31:22:00:09:15',
      thief: 'Scrolling',
      plannedSleepStartAt: new Date(2026, 8, 1, 9, 15, 0).getTime(),
      observedAt: new Date(2026, 8, 1, 9, 45, 0).getTime(),
      observedDelayMinutes: 30
    }]
  });

  assert.equal(
    deriveRecoveryThiefPrompt(
      nightShiftPlan({ workDays: [1] }),
      store,
      new Date(2026, 8, 1, 9, 45, 0)
    ),
    null
  );
});

test('skipping dismisses only that sleep cycle', () => {
  const store = normalizeRecoveryThiefStore({
    dismissedCycles: ['2026-08-31:22:00:09:15']
  });

  assert.equal(
    deriveRecoveryThiefPrompt(
      nightShiftPlan({ workDays: [1, 2] }),
      store,
      new Date(2026, 8, 1, 9, 45, 0)
    ),
    null
  );

  const nextDay = deriveRecoveryThiefPrompt(
    nightShiftPlan({ workDays: [1, 2] }),
    store,
    new Date(2026, 8, 2, 9, 45, 0)
  );
  assert.ok(nextDay);
  assert.equal(nextDay.cycleKey, '2026-09-01:22:00:09:15');
});

test('day shifts can anchor sleep to the following calendar day', () => {
  const prompt = deriveRecoveryThiefPrompt({
    setupComplete: true,
    workDays: [1],
    shiftStart: '09:00',
    shiftEnd: '17:00',
    sleepStart: '01:00'
  }, {}, new Date(2026, 8, 1, 1, 20, 0));

  assert.ok(prompt);
  assert.equal(prompt.cycleKey, '2026-08-31:09:00:01:00');
  assert.equal(prompt.observedDelayMinutes, 20);
});

test('sleep delay prompt requires a completed Sleep Routine setup', () => {
  assert.equal(
    deriveRecoveryThiefPrompt({
      setupComplete: false,
      workDays: [1],
      shiftStart: '22:00',
      shiftEnd: '08:00',
      sleepStart: '09:15'
    }, {}, new Date(2026, 8, 1, 9, 45, 0)),
    null
  );
});

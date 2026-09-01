import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyRecoveryPlan,
  deriveRecoveryTimeline,
  normalizeRecoveryPlan
} from '../src/recoveryPlan.js';

test('recovery plan defaults support a night-shift routine', () => {
  const plan = createEmptyRecoveryPlan();
  assert.equal(plan.shiftStart, '22:00');
  assert.equal(plan.shiftEnd, '08:00');
  assert.equal(plan.commuteMinutes, 60);
  assert.equal(plan.windDownMinutes, 45);
  assert.equal(plan.recoveryMinutes, 480);
  assert.equal(plan.setupComplete, false);
});

test('recovery timeline derives home, sleep, and wake anchors from the user plan', () => {
  const timeline = deriveRecoveryTimeline({
    setupComplete: true,
    workDays: [1, 2, 3, 4, 5],
    shiftStart: '22:00',
    shiftEnd: '08:00',
    commuteMinutes: 60,
    windDownMinutes: 45,
    recoveryMinutes: 480
  });

  assert.deepEqual(timeline, {
    shiftEnd: '08:00',
    homeAt: '09:00',
    recoveryStart: '09:45',
    wakeAt: '17:45'
  });
});

test('recovery plan normalization clamps unsafe or invalid values', () => {
  const plan = normalizeRecoveryPlan({
    setupComplete: true,
    workDays: [1, 1, 8, -1],
    shiftStart: '25:00',
    shiftEnd: '25:00',
    commuteMinutes: 999,
    windDownMinutes: -20,
    recoveryMinutes: 9999
  });

  assert.deepEqual(plan.workDays, [1]);
  assert.equal(plan.shiftStart, '22:00');
  assert.equal(plan.shiftEnd, '08:00');
  assert.equal(plan.commuteMinutes, 240);
  assert.equal(plan.windDownMinutes, 0);
  assert.equal(plan.recoveryMinutes, 720);
  assert.equal(plan.setupComplete, true);
});
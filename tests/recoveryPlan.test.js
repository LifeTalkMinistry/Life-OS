import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyRecoveryPlan,
  deriveNudgeMoments,
  deriveRecoveryTimeline,
  normalizeRecoveryPlan
} from '../src/recoveryPlan.js';

test('recovery plan defaults support a quiet night-shift routine', () => {
  const plan = createEmptyRecoveryPlan();
  assert.equal(plan.version, 2);
  assert.equal(plan.shiftStart, '22:00');
  assert.equal(plan.shiftEnd, '08:00');
  assert.equal(plan.commuteMinutes, 60);
  assert.equal(plan.windDownMinutes, 45);
  assert.equal(plan.recoveryMinutes, 480);
  assert.equal(plan.setupComplete, false);
  assert.equal(plan.nudgeConsentComplete, false);
  assert.deepEqual(plan.nudges, {
    shiftEnd: false,
    commuteEnd: false,
    windDownReminder: false,
    recoveryStart: false,
    wakeTarget: false
  });
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

test('recovery plan derives exact consented nudge moments from the same routine anchors', () => {
  const moments = deriveNudgeMoments({
    setupComplete: true,
    workDays: [1, 2, 3, 4, 5],
    shiftStart: '22:00',
    shiftEnd: '08:00',
    commuteMinutes: 60,
    windDownMinutes: 45,
    recoveryMinutes: 480
  });

  assert.deepEqual(moments, {
    shiftEnd: '08:00',
    commuteEnd: '09:00',
    windDownReminder: '09:30',
    recoveryStart: '09:45',
    wakeTarget: '17:45'
  });
});

test('legacy completed plans stay complete but require explicit nudge consent once', () => {
  const plan = normalizeRecoveryPlan({
    version: 1,
    setupComplete: true,
    workDays: [1, 2, 3, 4, 5],
    shiftStart: '22:00',
    shiftEnd: '08:00',
    commuteMinutes: 60,
    windDownMinutes: 45,
    recoveryMinutes: 480
  });

  assert.equal(plan.version, 2);
  assert.equal(plan.setupComplete, true);
  assert.equal(plan.nudgeConsentComplete, false);
  assert.deepEqual(plan.nudges, {
    shiftEnd: false,
    commuteEnd: false,
    windDownReminder: false,
    recoveryStart: false,
    wakeTarget: false
  });
});

test('nudge consent allows zero choices and keeps only strict supported booleans', () => {
  const plan = normalizeRecoveryPlan({
    setupComplete: true,
    nudgeConsentComplete: true,
    workDays: [1],
    shiftStart: '09:00',
    shiftEnd: '17:00',
    nudges: {
      shiftEnd: false,
      commuteEnd: 'yes',
      windDownReminder: false,
      recoveryStart: 1,
      wakeTarget: false,
      unknown: true
    }
  });

  assert.equal(plan.setupComplete, true);
  assert.equal(plan.nudgeConsentComplete, true);
  assert.deepEqual(plan.nudges, {
    shiftEnd: false,
    commuteEnd: false,
    windDownReminder: false,
    recoveryStart: false,
    wakeTarget: false
  });
});

test('zero wind-down disables the wind-down reminder even if stale data selected it', () => {
  const plan = normalizeRecoveryPlan({
    setupComplete: true,
    nudgeConsentComplete: true,
    workDays: [1],
    shiftStart: '09:00',
    shiftEnd: '17:00',
    windDownMinutes: 0,
    nudges: {
      windDownReminder: true
    }
  });

  assert.equal(plan.nudges.windDownReminder, false);
});

test('recovery plan normalization clamps unsafe or invalid values', () => {
  const plan = normalizeRecoveryPlan({
    setupComplete: true,
    nudgeConsentComplete: true,
    workDays: [1, 1, 8, -1],
    shiftStart: '25:00',
    shiftEnd: '25:00',
    commuteMinutes: 999,
    windDownMinutes: -20,
    recoveryMinutes: 9999,
    nudges: {
      shiftEnd: true,
      commuteEnd: true,
      windDownReminder: true,
      recoveryStart: true,
      wakeTarget: true
    }
  });

  assert.deepEqual(plan.workDays, [1]);
  assert.equal(plan.shiftStart, '22:00');
  assert.equal(plan.shiftEnd, '08:00');
  assert.equal(plan.commuteMinutes, 240);
  assert.equal(plan.windDownMinutes, 0);
  assert.equal(plan.recoveryMinutes, 720);
  assert.equal(plan.setupComplete, true);
  assert.equal(plan.nudgeConsentComplete, true);
  assert.equal(plan.nudges.windDownReminder, false);
  assert.equal(plan.nudges.shiftEnd, true);
});

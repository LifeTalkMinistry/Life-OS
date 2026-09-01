import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveRecoveryBriefingStatus } from '../src/recoveryBriefing.js';

function nightShiftPlan(overrides = {}) {
  return {
    setupComplete: true,
    nudgeConsentComplete: true,
    workDays: [1, 2, 3, 4, 5],
    shiftStart: '22:00',
    shiftEnd: '08:00',
    commuteMinutes: 60,
    windDownMinutes: 45,
    recoveryMinutes: 480,
    ...overrides
  };
}

test('recovery briefing recognizes the overnight work phase', () => {
  const status = deriveRecoveryBriefingStatus(
    nightShiftPlan({ workDays: [1] }),
    new Date(2026, 7, 31, 23, 0, 0)
  );

  assert.equal(status.phase, 'work');
  assert.equal(status.title, 'Your shift is in progress.');
  assert.match(status.label, /PROTECTED RECOVERY/);
});

test('recovery briefing recognizes the next-day commute window', () => {
  const status = deriveRecoveryBriefingStatus(
    nightShiftPlan({ workDays: [1] }),
    new Date(2026, 8, 1, 8, 30, 0)
  );

  assert.equal(status.phase, 'commute');
  assert.equal(status.value, '30m');
  assert.equal(status.label, 'LEFT IN COMMUTE WINDOW');
});

test('recovery briefing recognizes wind-down before protected recovery', () => {
  const status = deriveRecoveryBriefingStatus(
    nightShiftPlan({ workDays: [1] }),
    new Date(2026, 8, 1, 9, 20, 0)
  );

  assert.equal(status.phase, 'winddown');
  assert.equal(status.value, '25m');
  assert.equal(status.label, 'UNTIL PROTECTED RECOVERY');
});

test('recovery briefing shows remaining protected recovery without claiming actual sleep', () => {
  const status = deriveRecoveryBriefingStatus(
    nightShiftPlan({ workDays: [1] }),
    new Date(2026, 8, 1, 10, 0, 0)
  );

  assert.equal(status.phase, 'recovery');
  assert.equal(status.value, '7h 45m');
  assert.equal(status.title, 'Protected recovery is active.');
  assert.match(status.detail, /Wake target:/);
});

test('outside the current routine, briefing points to the next protected recovery', () => {
  const status = deriveRecoveryBriefingStatus(
    nightShiftPlan(),
    new Date(2026, 8, 1, 18, 0, 0)
  );

  assert.equal(status.phase, 'next');
  assert.equal(status.label, 'NEXT PROTECTED RECOVERY');
  assert.match(status.title, /next recovery/i);
});

test('briefing stays absent until a Recovery Plan exists', () => {
  assert.equal(
    deriveRecoveryBriefingStatus({ setupComplete: false }, new Date(2026, 8, 1, 8, 0, 0)),
    null
  );
});
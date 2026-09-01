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

test('routine agenda recognizes the overnight work phase', () => {
  const status = deriveRecoveryBriefingStatus(
    nightShiftPlan({ workDays: [1] }),
    new Date(2026, 7, 31, 23, 0, 0)
  );

  assert.equal(status.phase, 'work');
  assert.equal(status.agenda, 'WORK');
  assert.equal(status.value, '9h');
  assert.equal(status.suffix, 'left');
  assert.match(status.next, /Commute/);
});

test('routine agenda recognizes the next-day commute window', () => {
  const status = deriveRecoveryBriefingStatus(
    nightShiftPlan({ workDays: [1] }),
    new Date(2026, 8, 1, 8, 30, 0)
  );

  assert.equal(status.phase, 'commute');
  assert.equal(status.agenda, 'COMMUTE');
  assert.equal(status.value, '30m');
  assert.equal(status.next, 'Next · Wind-down — 9:00 AM');
});

test('routine agenda recognizes wind-down before sleep routine', () => {
  const status = deriveRecoveryBriefingStatus(
    nightShiftPlan({ workDays: [1] }),
    new Date(2026, 8, 1, 9, 20, 0)
  );

  assert.equal(status.phase, 'winddown');
  assert.equal(status.agenda, 'WIND-DOWN');
  assert.equal(status.value, '25m');
  assert.equal(status.next, 'Next · Sleep Routine — 9:45 AM');
});

test('routine agenda names the sleep block without protected-recovery language', () => {
  const status = deriveRecoveryBriefingStatus(
    nightShiftPlan({ workDays: [1] }),
    new Date(2026, 8, 1, 10, 0, 0)
  );

  assert.equal(status.phase, 'recovery');
  assert.equal(status.agenda, 'SLEEP ROUTINE');
  assert.equal(status.value, '7h 45m');
  assert.equal(status.next, 'Next · Wake — 5:45 PM');
  assert.equal(JSON.stringify(status).includes('Protected'), false);
});

test('outside the current routine, agenda points to the next sleep routine', () => {
  const status = deriveRecoveryBriefingStatus(
    nightShiftPlan(),
    new Date(2026, 8, 1, 18, 0, 0)
  );

  assert.equal(status.phase, 'next');
  assert.equal(status.agenda, 'NEXT SLEEP ROUTINE');
  assert.equal(status.suffix, 'away');
  assert.match(status.next, /^Starts · /);
});

test('briefing stays absent until a Recovery Plan exists', () => {
  assert.equal(
    deriveRecoveryBriefingStatus({ setupComplete: false }, new Date(2026, 8, 1, 8, 0, 0)),
    null
  );
});

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
    sleepStart: '09:45',
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

test('sleep routine changes to remaining sleep opportunity when Sleep has not started', () => {
  const status = deriveRecoveryBriefingStatus(
    nightShiftPlan({ workDays: [1] }),
    new Date(2026, 8, 1, 10, 0, 0),
    { active: null, history: [] }
  );

  assert.equal(status.phase, 'recovery');
  assert.equal(status.agenda, 'NOT SLEEPING YET');
  assert.equal(status.value, '7h 45m');
  assert.equal(status.message, 'available if you sleep now');
  assert.equal(status.next, 'Wake Target · 5:45 PM');
  assert.equal(status.action, 'start-sleep');
  assert.equal(status.actionLabel, 'Start Sleep');
});

test('active Sleep keeps the normal Sleep Routine state', () => {
  const status = deriveRecoveryBriefingStatus(
    nightShiftPlan({ workDays: [1] }),
    new Date(2026, 8, 1, 10, 0, 0),
    {
      active: {
        label: 'Sleep',
        startAt: new Date(2026, 8, 1, 9, 50, 0).getTime()
      },
      history: []
    }
  );

  assert.equal(status.agenda, 'SLEEP ROUTINE');
  assert.equal(status.actionLabel, 'Continue');
});

test('declared sleep start stays fixed even when commute plus wind-down would end earlier', () => {
  const plan = nightShiftPlan({
    workDays: [1],
    commuteMinutes: 45,
    windDownMinutes: 30,
    sleepStart: '10:00',
    recoveryMinutes: 420
  });

  const personal = deriveRecoveryBriefingStatus(plan, new Date(2026, 8, 1, 9, 0, 0));
  assert.equal(personal.phase, 'personal');
  assert.equal(personal.agenda, 'YOUR TIME');
  assert.equal(personal.value, '30m');
  assert.equal(personal.next, 'Next · Wind-down — 9:30 AM');

  const windDown = deriveRecoveryBriefingStatus(plan, new Date(2026, 8, 1, 9, 40, 0));
  assert.equal(windDown.phase, 'winddown');
  assert.equal(windDown.value, '20m');
  assert.equal(windDown.next, 'Next · Sleep Routine — 10:00 AM');

  const sleep = deriveRecoveryBriefingStatus(plan, new Date(2026, 8, 1, 10, 10, 0));
  assert.equal(sleep.phase, 'recovery');
  assert.equal(sleep.next, 'Next · Wake — 5:00 PM');
});

test('legacy plan without an explicit sleep start keeps its previous calculated schedule', () => {
  const status = deriveRecoveryBriefingStatus(
    nightShiftPlan({ workDays: [1], sleepStart: undefined }),
    new Date(2026, 8, 1, 9, 20, 0)
  );

  assert.equal(status.phase, 'winddown');
  assert.equal(status.next, 'Next · Sleep Routine — 9:45 AM');
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

test('briefing stays absent until a Sleep Routine exists', () => {
  assert.equal(
    deriveRecoveryBriefingStatus({ setupComplete: false }, new Date(2026, 8, 1, 8, 0, 0)),
    null
  );
});

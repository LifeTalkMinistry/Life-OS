import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveSleepRoutineSchedule } from '../src/sleepRoutineSchedule.js';

test('declared sleep start anchors wind-down and wake independently of commute math', () => {
  const schedule = deriveSleepRoutineSchedule({
    setupComplete: true,
    workDays: [1],
    shiftStart: '22:00',
    shiftEnd: '08:00',
    commuteMinutes: 45,
    windDownMinutes: 30,
    recoveryMinutes: 420,
    sleepStart: '10:00',
    nudges: {}
  });

  assert.deepEqual(schedule, {
    shiftEnd: '08:00',
    homeAt: '08:45',
    windDownStart: '09:30',
    recoveryStart: '10:00',
    wakeAt: '17:00'
  });
});

test('legacy routine without sleepStart preserves its previous calculated anchor', () => {
  const schedule = deriveSleepRoutineSchedule({
    setupComplete: true,
    workDays: [1],
    shiftStart: '22:00',
    shiftEnd: '08:00',
    commuteMinutes: 60,
    windDownMinutes: 45,
    recoveryMinutes: 480,
    nudges: {}
  });

  assert.equal(schedule.homeAt, '09:00');
  assert.equal(schedule.windDownStart, '09:00');
  assert.equal(schedule.recoveryStart, '09:45');
  assert.equal(schedule.wakeAt, '17:45');
});

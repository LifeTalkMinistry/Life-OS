import test from 'node:test';
import assert from 'node:assert/strict';
import {
  derivePauseWeeklyReport,
  normalizePauseWeeklyReportStore,
  pauseWeeklyLatestCompletedWeek
} from '../src/weeklyReport.js';
import { manilaDateKeyToStartMs } from '../src/manilaTime.js';

function atManila(key, hour, minute = 0) {
  return manilaDateKeyToStartMs(key) + (hour * 60 + minute) * 60_000;
}

test('latest completed report is the previous Monday through Sunday', () => {
  const now = atManila('2026-09-01', 15);
  const week = pauseWeeklyLatestCompletedWeek(now);
  assert.equal(week.startKey, '2026-08-24');
  assert.equal(week.endKey, '2026-08-30');
});

test('weekly report keeps generic rest separate from sleep-specific records', () => {
  const report = derivePauseWeeklyReport({
    weekStartKey: '2026-08-24',
    plan: {
      setupComplete: true,
      workDays: [1, 2, 3, 4, 5],
      recoveryMinutes: 420,
      sleepStart: '09:30'
    },
    pauseState: {
      history: [
        {
          id: 'rest-1',
          label: 'Rest',
          startAt: atManila('2026-08-24', 10),
          endedAt: atManila('2026-08-24', 11),
          durationMs: 60 * 60_000
        },
        {
          id: 'sleep-1',
          label: 'Sleep',
          startAt: atManila('2026-08-25', 9, 30),
          endedAt: atManila('2026-08-25', 16, 30),
          durationMs: 7 * 60 * 60_000
        }
      ]
    },
    thiefLogs: []
  });

  assert.ok(report);
  assert.equal(report.plannedSleepDays, 5);
  assert.equal(report.plannedSleepMs, 35 * 60 * 60_000);
  assert.equal(report.totalRestMs, 8 * 60 * 60_000);
  assert.equal(report.recordedSleepMs, 7 * 60 * 60_000);
  assert.equal(report.restDays, 2);
  assert.equal(report.sleepRecordDays, 1);
});

test('weekly report summarizes only sleep-delay logs inside the report week', () => {
  const report = derivePauseWeeklyReport({
    weekStartKey: '2026-08-24',
    plan: {
      setupComplete: true,
      workDays: [1, 2, 3, 4, 5],
      recoveryMinutes: 420,
      sleepStart: '09:30'
    },
    pauseState: { history: [] },
    thiefLogs: [
      { thief: 'Scrolling', plannedSleepStartAt: atManila('2026-08-24', 9, 30), observedDelayMinutes: 20 },
      { thief: 'Scrolling', plannedSleepStartAt: atManila('2026-08-26', 9, 30), observedDelayMinutes: 40 },
      { thief: 'Overtime', plannedSleepStartAt: atManila('2026-08-28', 9, 30), observedDelayMinutes: 30 },
      { thief: 'Gaming', plannedSleepStartAt: atManila('2026-08-31', 9, 30), observedDelayMinutes: 60 }
    ]
  });

  assert.equal(report.delayLogs, 3);
  assert.equal(report.averageDelayMinutes, 30);
  assert.deepEqual(report.thieves[0], { label: 'Scrolling', count: 2 });
  assert.equal(report.thieves.some((item) => item.label === 'Gaming'), false);
});

test('rest crossing Manila midnight is credited to both calendar days without double counting', () => {
  const startAt = atManila('2026-08-24', 23);
  const endedAt = atManila('2026-08-25', 1);
  const report = derivePauseWeeklyReport({
    weekStartKey: '2026-08-24',
    pauseState: {
      history: [{ id: 'cross', label: 'Rest', startAt, endedAt, durationMs: endedAt - startAt }]
    },
    plan: {},
    thiefLogs: []
  });

  assert.equal(report.totalRestMs, 2 * 60 * 60_000);
  assert.equal(report.days[0].totalMs, 60 * 60_000);
  assert.equal(report.days[1].totalMs, 60 * 60_000);
});

test('weekly report store preserves ignored reports and optional notes', () => {
  const store = normalizePauseWeeklyReportStore({
    trackingStartedAt: atManila('2026-08-01', 0),
    records: [{
      weekStartKey: '2026-08-24',
      generatedAt: atManila('2026-08-31', 8),
      ignoredAt: atManila('2026-08-31', 9),
      note: 'Mandatory overtime this week.',
      planSnapshot: {
        setupComplete: true,
        workDays: [1, 2, 3, 4, 5],
        recoveryMinutes: 420,
        sleepStart: '09:30'
      }
    }]
  });

  assert.equal(store.records.length, 1);
  assert.ok(store.records[0].ignoredAt);
  assert.equal(store.records[0].note, 'Mandatory overtime this week.');
  assert.equal(store.records[0].planSnapshot.recoveryMinutes, 420);
});

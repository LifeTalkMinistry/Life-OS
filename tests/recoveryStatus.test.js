import test from 'node:test';
import assert from 'node:assert/strict';
import { manilaDateKeyToStartMs } from '../src/manilaTime.js';
import {
  RECOVERY_DAILY_TARGET_MS,
  buildRecoverySummary,
  recoveryRangeForDays
} from '../src/recoveryStatusCard.js';

function restEntry(id, dayKey, hours, minutes = 0) {
  const startAt = manilaDateKeyToStartMs(dayKey) + 60 * 60 * 1000;
  const durationMs = (hours * 60 + minutes) * 60 * 1000;
  return {
    id,
    label: 'Rest',
    startAt,
    endedAt: startAt + durationMs,
    durationMs,
    reason: 'ended'
  };
}

test('recovery status defaults to the most recent rolling 7 Manila days', () => {
  const now = Date.parse('2026-08-30T08:45:00Z'); // Aug 30, 4:45 PM Manila
  assert.deepEqual(recoveryRangeForDays(7, now), {
    startKey: '2026-08-24',
    endKey: '2026-08-30'
  });

  assert.deepEqual(recoveryRangeForDays(3, now), {
    startKey: '2026-08-28',
    endKey: '2026-08-30'
  });
});

test('7-day recovery status reports the exact shortfall against 7 hours per day once 7 days are available', () => {
  const now = Date.parse('2026-08-30T15:59:00Z');
  const state = {
    history: [
      restEntry('d1', '2026-08-24', 7),
      restEntry('d2', '2026-08-25', 7),
      restEntry('d3', '2026-08-26', 7),
      restEntry('d4', '2026-08-27', 7),
      restEntry('d5', '2026-08-28', 6),
      restEntry('d6', '2026-08-29', 6),
      restEntry('d7', '2026-08-30', 5, 20)
    ]
  };

  const summary = buildRecoverySummary(state, '2026-08-24', '2026-08-30', now);
  assert.equal(summary.days, 7);
  assert.equal(summary.observedStartKey, '2026-08-24');
  assert.equal(summary.totalMs, (45 * 60 + 20) * 60 * 1000);
  assert.equal(summary.targetMs, 49 * 60 * 60 * 1000);
  assert.equal(summary.differenceMs, -(3 * 60 + 40) * 60 * 1000);
  assert.equal(RECOVERY_DAILY_TARGET_MS, 7 * 60 * 60 * 1000);
});

test('a new user is not charged for days before their first recorded rest', () => {
  const now = Date.parse('2026-08-30T10:00:00Z'); // Aug 30 Manila
  const state = {
    history: [
      restEntry('fri', '2026-08-28', 6, 33),
      restEntry('sat', '2026-08-29', 4, 39),
      restEntry('sun', '2026-08-30', 6, 39)
    ]
  };

  const summary = buildRecoverySummary(state, '2026-08-24', '2026-08-30', now);

  assert.equal(summary.startKey, '2026-08-24');
  assert.equal(summary.endKey, '2026-08-30');
  assert.equal(summary.observedStartKey, '2026-08-28');
  assert.equal(summary.days, 3);
  assert.equal(summary.totalMs, (17 * 60 + 51) * 60 * 1000);
  assert.equal(summary.targetMs, 21 * 60 * 60 * 1000);
  assert.equal(summary.differenceMs, -(3 * 60 + 9) * 60 * 1000);
  assert.equal(Math.round(summary.progressPct), 85);
});

test('zero-rest days count after tracking has started', () => {
  const now = Date.parse('2026-08-30T10:00:00Z');
  const state = {
    history: [
      restEntry('fri', '2026-08-28', 7),
      restEntry('sun', '2026-08-30', 7)
    ]
  };

  const summary = buildRecoverySummary(state, '2026-08-24', '2026-08-30', now);

  assert.equal(summary.observedStartKey, '2026-08-28');
  assert.equal(summary.days, 3);
  assert.equal(summary.totalMs, 14 * 60 * 60 * 1000);
  assert.equal(summary.targetMs, 21 * 60 * 60 * 1000);
  assert.equal(summary.differenceMs, -7 * 60 * 60 * 1000);
});

test('a range before any recorded history has no recovery target yet', () => {
  const now = Date.parse('2026-12-31T15:00:00Z');
  const summary = buildRecoverySummary({ history: [] }, '2026-01-01', '2026-12-31', now);

  assert.equal(summary.days, 0);
  assert.equal(summary.targetMs, 0);
  assert.equal(summary.totalMs, 0);
  assert.equal(summary.differenceMs, 0);
});

test('custom recovery status still supports a full non-leap year when the user has full-year history', () => {
  const now = Date.parse('2026-12-31T15:00:00Z');
  const state = { history: [restEntry('jan1', '2026-01-01', 7)] };
  const summary = buildRecoverySummary(state, '2026-01-01', '2026-12-31', now);

  assert.equal(summary.days, 365);
  assert.equal(summary.targetMs, 2555 * 60 * 60 * 1000);
  assert.equal(summary.totalMs, 7 * 60 * 60 * 1000);
  assert.equal(summary.differenceMs, summary.totalMs - summary.targetMs);
});

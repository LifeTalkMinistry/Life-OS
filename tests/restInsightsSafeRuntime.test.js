import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBoundedRestAuditForDay,
  buildBoundedRestInsights,
  boundedRestHistory
} from '../src/components/RestInsightsAsyncRuntime.js';
import { manilaDateKeyToStartMs } from '../src/manilaTime.js';

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

function session(dateKey, startHour, durationHours, overrides = {}) {
  const startAt = manilaDateKeyToStartMs(dateKey) + startHour * HOUR;
  return {
    id: `${dateKey}-${startHour}-${durationHours}`,
    label: 'Rest',
    startAt,
    endedAt: startAt + durationHours * HOUR,
    durationMs: durationHours * HOUR,
    ...overrides
  };
}

test('recovered Rest Insights keeps the original seven-day metric model on a bounded history set', () => {
  const now = manilaDateKeyToStartMs('2026-09-02') + 20 * HOUR;
  const state = {
    history: [
      session('2026-09-02', 10, 2),
      session('2026-09-01', 9, 1),
      session('2026-08-30', 8, 3),
      session('2026-08-20', 8, 4)
    ]
  };

  const insights = buildBoundedRestInsights(state, now);
  assert.equal(insights.sessions, 3);
  assert.equal(insights.totalMs, 6 * HOUR);
  assert.equal(insights.averageMs, 2 * HOUR);
  assert.equal(insights.longestMs, 3 * HOUR);
  assert.equal(insights.restDays, 3);
  assert.equal(insights.daily.length, 7);
  assert.equal(insights.daily[0].dateKey, '2026-09-02');
});

test('daily audit safely splits a Rest that crosses Manila midnight', () => {
  const startAt = manilaDateKeyToStartMs('2026-09-01') + 23 * HOUR + 30 * MINUTE;
  const state = {
    history: [{
      id: 'cross-midnight',
      label: 'Sleep',
      startAt,
      endedAt: startAt + 2 * HOUR,
      durationMs: 2 * HOUR,
      reason: 'ended'
    }]
  };
  const now = manilaDateKeyToStartMs('2026-09-02') + 12 * HOUR;

  const septemberFirst = buildBoundedRestAuditForDay(state, '2026-09-01', now);
  const septemberSecond = buildBoundedRestAuditForDay(state, '2026-09-02', now);

  assert.equal(septemberFirst.totalMs, 30 * MINUTE);
  assert.equal(septemberSecond.totalMs, 90 * MINUTE);
  assert.equal(septemberFirst.entries[0].splitAcrossDays, true);
  assert.equal(septemberSecond.entries[0].splitAcrossDays, true);
});

test('weekday learning becomes ready from enough bounded observed history', () => {
  const now = manilaDateKeyToStartMs('2026-09-02') + 20 * HOUR;
  const history = [];
  for (let offset = 0; offset < 16; offset += 1) {
    const stamp = manilaDateKeyToStartMs('2026-08-18') + offset * 24 * HOUR;
    const keyDate = new Date(stamp + 8 * HOUR);
    const key = `${keyDate.getUTCFullYear()}-${String(keyDate.getUTCMonth() + 1).padStart(2, '0')}-${String(keyDate.getUTCDate()).padStart(2, '0')}`;
    if (offset % 2 === 0) history.push(session(key, 9, 1 + (offset % 3)));
  }

  const insights = buildBoundedRestInsights({ history }, now);
  assert.equal(insights.weekdayPattern.ready, true);
  assert.equal(insights.weekdayPattern.ranked.length, 7);
  assert.ok(insights.weekdayPattern.strongest);
});

test('history processing is explicitly capped at 500 entries', () => {
  const start = manilaDateKeyToStartMs('2026-09-02');
  const history = Array.from({ length: 620 }, (_, index) => ({
    id: `entry-${index}`,
    label: 'Rest',
    startAt: start + index * MINUTE,
    endedAt: start + (index + 1) * MINUTE,
    durationMs: MINUTE
  }));

  assert.equal(boundedRestHistory({ history }).length, 500);
});

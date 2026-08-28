import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addManilaDays,
  manilaDateKey,
  manilaDateKeyToStartMs,
  manilaMonthStartKey
} from '../src/manilaTime.js';
import { calculatePauseScore } from '../src/components/PauseScore.js';
import { restAuditForDay, restInsights } from '../src/restState.js';

test('Manila calendar flips at 16:00 UTC', () => {
  assert.equal(manilaDateKey(Date.parse('2026-08-27T15:59:59Z')), '2026-08-27');
  assert.equal(manilaDateKey(Date.parse('2026-08-27T16:00:00Z')), '2026-08-28');
});

test('Manila day helpers stay independent of device timezone', () => {
  assert.equal(manilaDateKeyToStartMs('2026-08-28'), Date.parse('2026-08-27T16:00:00Z'));
  assert.equal(addManilaDays('2026-08-28', -1), '2026-08-27');
  assert.equal(addManilaDays('2026-08-31', 1), '2026-09-01');
  assert.equal(manilaMonthStartKey(Date.parse('2026-08-31T23:00:00Z')), '2026-09-01');
});

test('daily PAUSE score uses Manila midnight', () => {
  const state = {
    history: [{
      startAt: Date.parse('2026-08-27T15:30:00Z'),
      endedAt: Date.parse('2026-08-27T16:30:00Z'),
      durationMs: 60 * 60 * 1000
    }]
  };

  const now = Date.parse('2026-08-27T17:00:00Z'); // Aug 28, 1:00 AM in Manila
  const result = calculatePauseScore(state, 'daily', null, now);

  assert.equal(result.days.length, 1);
  assert.equal(result.days[0].key, '2026-08-28');
  assert.equal(result.days[0].restMs, 30 * 60 * 1000);
  assert.equal(result.score, 13);
});

test('a cross-midnight rest is audited into both Manila dates', () => {
  const state = {
    history: [{
      id: 'cross-midnight',
      label: 'Sleep',
      startAt: Date.parse('2026-08-27T15:30:00Z'), // Aug 27 11:30 PM Manila
      endedAt: Date.parse('2026-08-27T17:00:00Z'), // Aug 28 1:00 AM Manila
      durationMs: 90 * 60 * 1000,
      reason: 'ended'
    }]
  };
  const now = Date.parse('2026-08-27T18:00:00Z');

  const aug27 = restAuditForDay(state, '2026-08-27', now);
  const aug28 = restAuditForDay(state, '2026-08-28', now);

  assert.equal(aug27.totalMs, 30 * 60 * 1000);
  assert.equal(aug28.totalMs, 60 * 60 * 1000);
  assert.equal(aug27.sessions, 1);
  assert.equal(aug28.sessions, 1);
  assert.equal(aug27.entries[0].splitAcrossDays, true);
  assert.equal(aug28.entries[0].splitAcrossDays, true);
});

test('7-day rhythm rows equal their per-day audit totals', () => {
  const now = Date.parse('2026-08-29T03:00:00Z');
  const state = {
    history: [
      {
        id: 'yesterday-rest',
        label: 'Rest',
        startAt: Date.parse('2026-08-28T02:00:00Z'),
        endedAt: Date.parse('2026-08-28T04:00:00Z'),
        durationMs: 2 * 60 * 60 * 1000
      },
      {
        id: 'cross-rest',
        label: 'Sleep',
        startAt: Date.parse('2026-08-28T15:30:00Z'),
        endedAt: Date.parse('2026-08-28T16:30:00Z'),
        durationMs: 60 * 60 * 1000
      }
    ]
  };

  const insights = restInsights(state, now);
  insights.daily.forEach((day) => {
    assert.equal(day.totalMs, restAuditForDay(state, day.key, now).totalMs);
  });
  assert.equal(insights.totalMs, insights.daily.reduce((sum, day) => sum + day.totalMs, 0));
});

test('relative labels never replace the actual Manila calendar day', () => {
  const now = Date.parse('2026-08-29T03:00:00Z'); // Aug 29, 11:00 AM Manila
  const insights = restInsights({ history: [] }, now);

  assert.equal(insights.daily[0].key, '2026-08-29');
  assert.equal(insights.daily[0].label, 'Sat');
  assert.equal(insights.daily[0].relativeLabel, 'Today');
  assert.equal(insights.daily[0].dateLabel, 'Aug 29 · Today');

  assert.equal(insights.daily[1].key, '2026-08-28');
  assert.equal(insights.daily[1].label, 'Fri');
  assert.equal(insights.daily[1].relativeLabel, 'Yesterday');
  assert.equal(insights.daily[1].dateLabel, 'Aug 28 · Yesterday');
});

test('rest insights assign completed rests to the actual Manila calendar date', () => {
  const now = Date.parse('2026-08-27T17:00:00Z');
  const state = {
    history: [{
      startAt: Date.parse('2026-08-27T16:15:00Z'),
      endedAt: Date.parse('2026-08-27T16:45:00Z'),
      durationMs: 30 * 60 * 1000
    }]
  };

  const insights = restInsights(state, now);
  assert.equal(insights.daily[0].key, '2026-08-28');
  assert.equal(insights.daily[0].label, 'Fri');
  assert.equal(insights.daily[0].relativeLabel, 'Today');
  assert.equal(insights.daily[0].sessions, 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addManilaDays,
  manilaDateKey,
  manilaDateKeyToStartMs,
  manilaMonthStartKey
} from '../src/manilaTime.js';
import { calculatePauseScore } from '../src/components/PauseScore.js';
import { restInsights } from '../src/restState.js';

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

test('rest insights label today by Manila calendar date', () => {
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
  assert.equal(insights.daily[0].label, 'Today');
  assert.equal(insights.daily[0].sessions, 1);
});

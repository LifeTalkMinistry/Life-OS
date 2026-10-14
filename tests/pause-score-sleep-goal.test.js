import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePauseScore,
  configuredSleepGoalMinutes,
  scoreForRestMs
} from '../src/components/PauseScore.js';

const MINUTE_MS = 60_000;

test('selected sleep goal is exactly 100 percent, with no 100 percent cap', () => {
  assert.equal(scoreForRestMs(420 * MINUTE_MS, 420), 100);
  assert.equal(scoreForRestMs(440 * MINUTE_MS, 420), 105);
  assert.equal(scoreForRestMs(480 * MINUTE_MS, 420), 114);
  assert.equal(scoreForRestMs(0, 420), 0);
});

test('a different chosen goal changes the baseline', () => {
  assert.equal(scoreForRestMs(450 * MINUTE_MS, 450), 100);
  assert.equal(scoreForRestMs(440 * MINUTE_MS, 450), 98);
  assert.equal(scoreForRestMs(480 * MINUTE_MS, 480), 100);
  assert.equal(scoreForRestMs(-MINUTE_MS, 420), 0);
  assert.equal(scoreForRestMs(420 * MINUTE_MS, 0), 0);
});

test('uses completed Sleep Routine goal, not an arbitrary 8-hour threshold', () => {
  const originalWindow = globalThis.window;
  try {
    globalThis.window = {
      __PAUSE_RECOVERY_PLAN__: {
        getPlan: () => ({ setupComplete: true, recoveryMinutes: 420 })
      }
    };
    assert.equal(configuredSleepGoalMinutes(), 420);
    assert.equal(scoreForRestMs(440 * MINUTE_MS), 105);

    // October 14: a completed Manila-local sleep from 3:12 PM to 10:32 PM.
    const startAt = Date.parse('2026-10-14T15:12:00+08:00');
    const endedAt = Date.parse('2026-10-14T22:32:00+08:00');
    const score = calculatePauseScore(
      { history: [{ id: 'sleep-1', label: 'Sleep', startAt, endedAt }] },
      'daily',
      null,
      Date.parse('2026-10-14T22:35:00+08:00')
    );
    assert.equal(score.goalMinutes, 420);
    assert.equal(score.days[0].restMs, 440 * MINUTE_MS);
    assert.equal(score.score, 105);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test('falls back to 8 hours while no completed routine is available', () => {
  const originalWindow = globalThis.window;
  try {
    globalThis.window = {
      __PAUSE_RECOVERY_PLAN__: {
        getPlan: () => ({ setupComplete: false, recoveryMinutes: 420 })
      }
    };
    assert.equal(configuredSleepGoalMinutes(), 480);
    assert.equal(scoreForRestMs(480 * MINUTE_MS), 100);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

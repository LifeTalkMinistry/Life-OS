import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isLifeProfileComplete,
  normalizeLifeProfile
} from '../src/state/lifeProfile.js';
import {
  createLifeStateFromProfile,
  currentActivity
} from '../src/state/lifeState.js';

test('completed Life Setup survives JSON persistence and rebuilds a live Orb state', () => {
  const original = normalizeLifeProfile({
    setupComplete: true,
    hasFixedSchedule: false,
    sleepStart: '23:00',
    sleepEnd: '07:00',
    activities: [
      {
        id: 'activity-test',
        name: 'Test activity',
        icon: 'general',
        days: [1],
        start: '10:00',
        end: '11:00'
      }
    ]
  });

  const stored = JSON.stringify(original);
  const restored = normalizeLifeProfile(JSON.parse(stored));

  assert.equal(isLifeProfileComplete(restored), true);

  const state = createLifeStateFromProfile(restored, new Date('2026-08-24T10:30:00'));
  const current = currentActivity(state);

  assert.ok(state.activities.length > 0);
  assert.ok(current);
  assert.equal(current.id, 'activity-test');
  assert.equal(current.shortTitle, 'Test activity');
});

test('completed setup with unmapped current time still rebuilds OPEN TIME instead of an empty state', () => {
  const restored = normalizeLifeProfile(JSON.parse(JSON.stringify({
    setupComplete: true,
    hasFixedSchedule: false,
    sleepStart: '23:00',
    sleepEnd: '07:00',
    activities: []
  })));

  assert.equal(isLifeProfileComplete(restored), true);

  const state = createLifeStateFromProfile(restored, new Date('2026-08-24T14:30:00'));
  const current = currentActivity(state);

  assert.ok(state.activities.length > 0);
  assert.ok(current);
  assert.equal(current.id, 'open-time');
  assert.equal(current.title, 'OPEN TIME');
});

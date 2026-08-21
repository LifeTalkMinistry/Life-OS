import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyLifeProfile,
  isLifeProfileComplete,
  normalizeLifeProfile
} from '../src/state/lifeProfile.js';

test('new life profile starts incomplete', () => {
  assert.equal(isLifeProfileComplete(createEmptyLifeProfile()), false);
});

test('completed V1 profile requires reality, sleep, and at least one timed activity', () => {
  const profile = normalizeLifeProfile({
    setupComplete: true,
    hasFixedSchedule: false,
    sleepStart: '13:00',
    sleepEnd: '21:00',
    activities: [
      {
        id: 'devotion',
        name: 'Daily Devotion',
        days: [0, 1, 2, 3, 4, 5, 6],
        start: '10:00',
        end: '10:30'
      }
    ]
  });
  assert.equal(isLifeProfileComplete(profile), true);
  assert.equal(profile.activities[0].name, 'Daily Devotion');
});

test('profile normalization drops invalid activities and cleans days', () => {
  const profile = normalizeLifeProfile({
    activities: [
      { id: 'learning', name: 'Learning', days: [1, 1, 8, -1, 3], start: '18:00', end: '19:00' },
      { id: 'bad', name: '', days: [1], start: '18:00', end: '19:00' }
    ]
  });
  assert.equal(profile.activities.length, 1);
  assert.deepEqual(profile.activities[0].days, [1, 3]);
});

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

test('completed profile requires reality, priorities, sleep, and current focus', () => {
  const profile = normalizeLifeProfile({
    setupComplete: true,
    hasFixedSchedule: false,
    sleepStart: '13:00',
    sleepEnd: '21:00',
    priorities: ['faith', 'health'],
    nonNegotiables: ['faith'],
    currentFocus: 'Recruit beta users',
    focusMinutes: 90
  });
  assert.equal(isLifeProfileComplete(profile), true);
  assert.deepEqual(profile.nonNegotiables, ['faith']);
});

test('profile normalization limits selected areas and protected priorities', () => {
  const profile = normalizeLifeProfile({
    priorities: ['faith', 'family', 'health', 'learning', 'business', 'fake'],
    nonNegotiables: ['faith', 'family', 'health']
  });
  assert.equal(profile.priorities.length, 4);
  assert.equal(profile.nonNegotiables.length, 2);
});

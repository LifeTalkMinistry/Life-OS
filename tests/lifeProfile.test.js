import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyLifeProfile,
  findTimeConflict,
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
        icon: 'faith',
        days: [0, 1, 2, 3, 4, 5, 6],
        start: '10:00',
        end: '10:30'
      }
    ]
  });
  assert.equal(isLifeProfileComplete(profile), true);
  assert.equal(profile.activities[0].name, 'Daily Devotion');
  assert.equal(profile.activities[0].icon, 'faith');
});

test('profile normalization drops invalid activities, cleans days, and defaults invalid icons', () => {
  const profile = normalizeLifeProfile({
    activities: [
      { id: 'learning', name: 'Learning', icon: 'not-an-icon', days: [1, 1, 8, -1, 3], start: '18:00', end: '19:00' },
      { id: 'bad', name: '', days: [1], start: '18:00', end: '19:00' }
    ]
  });
  assert.equal(profile.activities.length, 1);
  assert.deepEqual(profile.activities[0].days, [1, 3]);
  assert.equal(profile.activities[0].icon, 'general');
});

test('activity time cannot overlap another activity on the same day', () => {
  const profile = normalizeLifeProfile({
    hasFixedSchedule: false,
    sleepStart: '23:00',
    sleepEnd: '07:00',
    activities: [
      { id: 'devotion', name: 'Daily Devotion', days: [1], start: '10:00', end: '10:30' }
    ]
  });

  assert.equal(findTimeConflict(profile, 1, '10:15', '11:00')?.label, 'Daily Devotion');
  assert.equal(findTimeConflict(profile, 1, '10:30', '11:00'), null);
});

test('sleep and outside-only fixed time are protected from overlap', () => {
  const profile = normalizeLifeProfile({
    hasFixedSchedule: true,
    fixedKind: 'work',
    fixedDays: [1, 2, 3, 4, 5],
    fixedStart: '09:00',
    fixedEnd: '17:00',
    fixedGuidanceMode: 'outside',
    sleepStart: '23:00',
    sleepEnd: '07:00'
  });

  assert.equal(findTimeConflict(profile, 1, '09:30', '10:00')?.label, 'WORK');
  assert.equal(findTimeConflict(profile, 1, '23:30', '23:45')?.label, 'Sleep');
  assert.equal(findTimeConflict(profile, 1, '17:00', '18:00'), null);
});

test('fixed time may be mapped when fixed schedule breakdown is enabled', () => {
  const profile = normalizeLifeProfile({
    hasFixedSchedule: true,
    fixedDays: [1],
    fixedStart: '09:00',
    fixedEnd: '17:00',
    fixedGuidanceMode: 'breakdown',
    sleepStart: '23:00',
    sleepEnd: '07:00'
  });

  assert.equal(findTimeConflict(profile, 1, '09:30', '10:00'), null);
});

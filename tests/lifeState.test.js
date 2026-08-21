import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addUrgentMatter,
  completeCurrent,
  createInitialLifeState,
  currentActivity,
  deferCurrent,
  extendCurrent,
  formatClock
} from '../src/state/lifeState.js';

test('initial state points to CLARA Outreach', () => {
  const state = createInitialLifeState();
  assert.equal(currentActivity(state).shortTitle, 'CLARA Outreach');
  assert.equal(formatClock(currentActivity(state).end), '5:00 PM');
});

test('completing current focus moves to Workout', () => {
  const state = completeCurrent(createInitialLifeState());
  assert.equal(currentActivity(state).shortTitle, 'Workout');
});

test('more time updates current end time', () => {
  const state = extendCurrent(createInitialLifeState(), 30);
  assert.equal(formatClock(currentActivity(state).end), '5:30 PM');
});

test('skipping current focus recalculates to next activity', () => {
  const state = deferCurrent(createInitialLifeState(), 'skip');
  assert.equal(currentActivity(state).shortTitle, 'Workout');
  assert.equal(state.activities.some((activity) => activity.id === 'clara-outreach'), false);
});

test('urgent matter becomes current and completion resumes interrupted focus', () => {
  let state = addUrgentMatter(createInitialLifeState(), 30);
  assert.equal(currentActivity(state).shortTitle, 'Urgent Matter');
  state = completeCurrent(state);
  assert.equal(currentActivity(state).shortTitle, 'CLARA Outreach');
});

import { createLifeStateFromProfile } from '../src/state/lifeState.js';

const completedProfile = {
  setupComplete: true,
  hasFixedSchedule: false,
  fixedKind: 'work',
  fixedDays: [],
  fixedStart: '09:00',
  fixedEnd: '17:00',
  sleepStart: '23:00',
  sleepEnd: '07:00',
  priorities: ['health'],
  nonNegotiables: ['health'],
  currentFocus: 'Find beta users',
  focusMinutes: 60
};

test('profile-driven state uses the user current focus outside fixed reality', () => {
  const date = new Date(2026, 7, 19, 10, 0, 0);
  const state = createLifeStateFromProfile(completedProfile, date);
  assert.equal(currentActivity(state).shortTitle, 'Find beta users');
  assert.equal(formatClock(currentActivity(state).end), '11:00 AM');
});

test('profile-driven state protects an active fixed work schedule', () => {
  const date = new Date(2026, 7, 19, 10, 0, 0); // Wednesday
  const state = createLifeStateFromProfile({
    ...completedProfile,
    hasFixedSchedule: true,
    fixedDays: [1, 2, 3, 4, 5],
    fixedStart: '09:00',
    fixedEnd: '17:00'
  }, date);
  assert.equal(currentActivity(state).shortTitle, 'WORK');
});

test('profile-driven state supports overnight fixed schedules', () => {
  const date = new Date(2026, 7, 20, 2, 0, 0); // Thursday 2 AM, belongs to Wednesday night shift
  const state = createLifeStateFromProfile({
    ...completedProfile,
    hasFixedSchedule: true,
    fixedDays: [3],
    fixedStart: '23:00',
    fixedEnd: '08:00',
    sleepStart: '13:00',
    sleepEnd: '21:00'
  }, date);
  assert.equal(currentActivity(state).shortTitle, 'WORK');
});

test('profile-driven focus never overruns the next fixed commitment', () => {
  const date = new Date(2026, 7, 19, 10, 55, 0); // Wednesday
  const state = createLifeStateFromProfile({
    ...completedProfile,
    hasFixedSchedule: true,
    fixedDays: [1, 2, 3, 4, 5],
    fixedStart: '11:00',
    fixedEnd: '17:00',
    sleepStart: '23:00',
    sleepEnd: '07:00',
    focusMinutes: 90
  }, date);
  assert.equal(currentActivity(state).shortTitle, 'Find beta users');
  assert.equal(formatClock(currentActivity(state).end), '11:00 AM');
  assert.equal(currentActivity(state).recommendedMinutes, 5);
});

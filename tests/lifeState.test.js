import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addUrgentMatter,
  completeCurrent,
  createInitialLifeState,
  createLifeStateFromProfile,
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

const completedProfile = {
  setupComplete: true,
  hasFixedSchedule: false,
  fixedKind: 'work',
  fixedDays: [1, 2, 3, 4, 5],
  fixedStart: '09:00',
  fixedEnd: '17:00',
  sleepStart: '23:00',
  sleepEnd: '07:00',
  fixedGuidanceMode: 'outside',
  activities: [
    {
      id: 'devotion',
      name: 'Daily Devotion',
      days: [0, 1, 2, 3, 4, 5, 6],
      start: '10:00',
      end: '10:30'
    },
    {
      id: 'content',
      name: 'Content Creation',
      days: [1, 2, 3, 4, 5],
      start: '10:30',
      end: '12:00'
    }
  ]
};

test('profile-driven state runs the activity scheduled for the current time', () => {
  const date = new Date(2026, 7, 19, 10, 15, 0);
  const state = createLifeStateFromProfile(completedProfile, date);
  assert.equal(currentActivity(state).shortTitle, 'Daily Devotion');
  assert.equal(formatClock(currentActivity(state).end), '10:30 AM');
});

test('outside-only mode treats active fixed schedule as one protected block', () => {
  const date = new Date(2026, 7, 19, 10, 15, 0);
  const state = createLifeStateFromProfile({
    ...completedProfile,
    hasFixedSchedule: true,
    fixedStart: '09:00',
    fixedEnd: '17:00'
  }, date);
  assert.equal(currentActivity(state).shortTitle, 'WORK');
});

test('breakdown mode lets a mapped activity run inside fixed hours', () => {
  const date = new Date(2026, 7, 19, 10, 15, 0);
  const state = createLifeStateFromProfile({
    ...completedProfile,
    hasFixedSchedule: true,
    fixedGuidanceMode: 'breakdown',
    fixedStart: '09:00',
    fixedEnd: '17:00'
  }, date);
  assert.equal(currentActivity(state).shortTitle, 'Daily Devotion');
});

test('profile-driven state supports overnight fixed schedules', () => {
  const date = new Date(2026, 7, 20, 2, 0, 0); // Thursday 2 AM belongs to Wednesday night shift
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

test('sleep remains protected over a conflicting scheduled activity', () => {
  const date = new Date(2026, 7, 19, 23, 30, 0);
  const state = createLifeStateFromProfile({
    ...completedProfile,
    activities: [
      { id: 'late', name: 'Late project', days: [3], start: '23:00', end: '23:59' }
    ]
  }, date);
  assert.equal(currentActivity(state).shortTitle, 'Sleep');
});

test('unmapped time is explicitly open time', () => {
  const date = new Date(2026, 7, 19, 14, 0, 0);
  const state = createLifeStateFromProfile(completedProfile, date);
  assert.equal(currentActivity(state).shortTitle, 'Open Time');
});

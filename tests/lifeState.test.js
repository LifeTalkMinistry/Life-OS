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

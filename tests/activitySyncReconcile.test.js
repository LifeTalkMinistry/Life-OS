import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activitySyncStatesEqual,
  normalizeActivitySyncState,
  reconcileActivitySyncStates
} from '../src/sync/activitySyncReconcile.js';

function activity(id, name, createdAt = 1000) {
  return {
    id,
    name,
    targetMode: 'daily',
    targetMinutes: 120,
    passingTargetMinutes: 60,
    spanMode: 'ongoing',
    endDate: null,
    createdAt
  };
}

test('Activity sync merges Activities created on different devices', () => {
  const local = { version: 1, activities: [activity('pc', 'Spanish')], sessions: [], active: null };
  const remote = { version: 1, activities: [activity('phone', 'Basketball')], sessions: [], active: null };
  const merged = reconcileActivitySyncStates(local, remote, { preferLocalActivities: true });

  assert.deepEqual(merged.activities.map((item) => item.id).sort(), ['pc', 'phone']);
});

test('Activity sync deduplicates the same tracked session by activity and start time', () => {
  const local = {
    activities: [activity('spanish', 'Spanish')],
    sessions: [{ id: 'phone-stop', activityId: 'spanish', name: 'Spanish', startAt: 10000, endAt: 70000 }],
    active: null
  };
  const remote = {
    activities: [activity('spanish', 'Spanish')],
    sessions: [{ id: 'pc-stop', activityId: 'spanish', name: 'Spanish', startAt: 10000, endAt: 60000 }],
    active: null
  };

  const merged = reconcileActivitySyncStates(local, remote, { preferLocalActivities: true });
  assert.equal(merged.sessions.length, 1);
  assert.equal(merged.sessions[0].endAt, 70000);
  assert.equal(merged.sessions[0].durationMs, 60000);
});

test('completed Activity session clears the matching remote active timer', () => {
  const local = {
    activities: [activity('spanish', 'Spanish')],
    sessions: [{ id: 'session-1', activityId: 'spanish', name: 'Spanish', startAt: 10000, endAt: 70000 }],
    active: null
  };
  const remote = {
    activities: [activity('spanish', 'Spanish')],
    sessions: [],
    active: { id: 'active-1', activityId: 'spanish', name: 'Spanish', startAt: 10000 }
  };

  const merged = reconcileActivitySyncStates(local, remote, { preferLocalActivities: true });
  assert.equal(merged.active, null);
});

test('deleted Activity ids are not resurrected from the cloud during a dirty merge', () => {
  const local = { activities: [], sessions: [], active: null };
  const remote = {
    activities: [activity('deleted', 'Old Activity')],
    sessions: [{ id: 'session-old', activityId: 'deleted', name: 'Old Activity', startAt: 10000, endAt: 20000 }],
    active: null
  };
  const merged = reconcileActivitySyncStates(local, remote, {
    preferLocalActivities: true,
    deletedActivityIds: ['deleted']
  });

  assert.equal(merged.activities.length, 0);
  assert.equal(merged.sessions.length, 0);
});

test('Activity sync equality normalizes harmless duration differences', () => {
  const left = {
    activities: [activity('spanish', 'Spanish')],
    sessions: [{ id: 'one', activityId: 'spanish', name: 'Spanish', startAt: 10000, endAt: 20000, durationMs: 1 }],
    active: null
  };
  const right = {
    activities: [activity('spanish', 'Spanish')],
    sessions: [{ id: 'one', activityId: 'spanish', name: 'Spanish', startAt: 10000, endAt: 20000, durationMs: 10000 }],
    active: null
  };

  assert.equal(activitySyncStatesEqual(normalizeActivitySyncState(left), right), true);
});

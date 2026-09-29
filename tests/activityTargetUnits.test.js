import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activityDisplayUnit,
  durationToMinutes,
  minutesToDisplay,
  repairKnownActivityTarget
} from '../src/activityTargetDurations.js';
import {
  normalizeActivitySyncState,
  reconcileActivitySyncStates
} from '../src/sync/activitySyncReconcile.js';

test('Activity duration conversion normalizes Hours and Minutes to canonical minutes', () => {
  assert.equal(durationToMinutes(1, 'hours'), 60);
  assert.equal(durationToMinutes(30, 'minutes'), 30);
  assert.equal(durationToMinutes(1.5, 'hours'), 90);
  assert.equal(durationToMinutes(90, 'minutes'), 90);
  assert.equal(durationToMinutes(1, 'minutes'), 1);
  assert.equal(durationToMinutes(0, 'hours'), null);
  assert.equal(durationToMinutes('nope', 'minutes'), null);
});

test('mixed-unit comparisons happen only after canonical conversion', () => {
  const cases = [
    { target: [1, 'hours'], passing: [30, 'minutes'], valid: true, stored: [60, 30] },
    { target: [60, 'minutes'], passing: [30, 'minutes'], valid: true, stored: [60, 30] },
    { target: [1.5, 'hours'], passing: [45, 'minutes'], valid: true, stored: [90, 45] },
    { target: [90, 'minutes'], passing: [1, 'hours'], valid: true, stored: [90, 60] },
    { target: [30, 'minutes'], passing: [1, 'hours'], valid: false, stored: [30, 60] },
    { target: [1, 'hours'], passing: [2, 'hours'], valid: false, stored: [60, 120] }
  ];

  for (const item of cases) {
    const targetMinutes = durationToMinutes(...item.target);
    const passingMinutes = durationToMinutes(...item.passing);
    assert.deepEqual([targetMinutes, passingMinutes], item.stored);
    assert.equal(passingMinutes <= targetMinutes, item.valid);
  }
});

test('display conversion roundtrips canonical minutes without changing storage', () => {
  assert.equal(minutesToDisplay(60, 'hours'), 1);
  assert.equal(minutesToDisplay(30, 'minutes'), 30);
  assert.equal(minutesToDisplay(90, 'minutes'), 90);
  assert.equal(minutesToDisplay(90, 'hours'), 1.5);
  assert.equal(activityDisplayUnit(undefined, 60), 'hours');
  assert.equal(activityDisplayUnit(undefined, 90), 'minutes');
  assert.equal(activityDisplayUnit('minutes', 60), 'minutes');
});

test('Activity sync preserves explicit display-unit metadata and only falls back for presentation', () => {
  const state = normalizeActivitySyncState({
    activities: [
      {
        id: 'spanish',
        name: 'Spanish',
        targetMode: 'daily',
        targetMinutes: 60,
        passingTargetMinutes: 30,
        targetDisplayUnit: 'minutes',
        passingDisplayUnit: 'minutes',
        spanMode: 'ongoing',
        createdAt: 1000
      },
      {
        id: 'older',
        name: 'Older Activity',
        targetMode: 'daily',
        targetMinutes: 120,
        passingTargetMinutes: 45,
        spanMode: 'ongoing',
        createdAt: 900
      }
    ],
    sessions: [],
    active: null
  });

  assert.equal(state.activities[0].targetMinutes, 60);
  assert.equal(state.activities[0].targetDisplayUnit, 'minutes');
  assert.equal(state.activities[0].passingDisplayUnit, 'minutes');
  assert.equal(state.activities[1].targetMinutes, 120);
  assert.equal(state.activities[1].targetDisplayUnit, 'hours');
  assert.equal(state.activities[1].passingDisplayUnit, 'minutes');
});

test('Activity reconcile/cloud roundtrip keeps target display units', () => {
  const activity = {
    id: 'spanish',
    name: 'Spanish',
    targetMode: 'daily',
    targetMinutes: 90,
    passingTargetMinutes: 60,
    targetDisplayUnit: 'minutes',
    passingDisplayUnit: 'hours',
    spanMode: 'ongoing',
    createdAt: 1000,
    updatedAt: 2000
  };
  const merged = reconcileActivitySyncStates(
    { activities: [activity], sessions: [], active: null },
    { activities: [], sessions: [], active: null },
    { preferLocalActivities: true }
  );

  assert.equal(merged.activities[0].targetMinutes, 90);
  assert.equal(merged.activities[0].passingTargetMinutes, 60);
  assert.equal(merged.activities[0].targetDisplayUnit, 'minutes');
  assert.equal(merged.activities[0].passingDisplayUnit, 'hours');
});

test('known corrupted Spanish Activity migrates narrowly and idempotently', () => {
  const corrupted = {
    id: 'practice-spanish-listening',
    name: 'Practice Spanish Listening',
    targetMode: 'daily',
    targetMinutes: 1,
    passingTargetMinutes: 30,
    spanMode: 'ongoing',
    createdAt: 1000
  };

  const repaired = repairKnownActivityTarget(corrupted);
  assert.equal(repaired.targetMinutes, 60);
  assert.equal(repaired.passingTargetMinutes, 30);
  assert.equal(repaired.targetDisplayUnit, 'hours');
  assert.equal(repaired.passingDisplayUnit, 'minutes');
  assert.equal(repairKnownActivityTarget(repaired), repaired);

  const normalized = normalizeActivitySyncState({ activities: [corrupted], sessions: [], active: null });
  assert.equal(normalized.activities[0].targetMinutes, 60);
  assert.equal(normalized.activities[0].passingTargetMinutes, 30);
  assert.equal(normalized.activities[0].targetDisplayUnit, 'hours');
  assert.equal(normalized.activities[0].passingDisplayUnit, 'minutes');
  assert.deepEqual(normalizeActivitySyncState(normalized), normalized);
});

test('known Spanish Activity 60/1800 derivative corruption repairs to 1 hour / 30 minutes', () => {
  const corrupted = {
    id: 'practice-spanish-listening',
    name: 'Practice Spanish Listening',
    targetMode: 'daily',
    targetMinutes: 60,
    passingTargetMinutes: 1800,
    targetDisplayUnit: 'hours',
    passingDisplayUnit: 'minutes',
    spanMode: 'ongoing',
    createdAt: 1000
  };

  const repaired = repairKnownActivityTarget(corrupted);
  assert.equal(repaired.targetMinutes, 60);
  assert.equal(repaired.passingTargetMinutes, 30);
  assert.equal(repaired.targetDisplayUnit, 'hours');
  assert.equal(repaired.passingDisplayUnit, 'minutes');
  assert.equal(repairKnownActivityTarget(repaired), repaired);

  const normalized = normalizeActivitySyncState({ activities: [corrupted], sessions: [], active: null });
  assert.equal(normalized.activities[0].targetMinutes, 60);
  assert.equal(normalized.activities[0].passingTargetMinutes, 30);
  assert.equal(normalized.activities[0].targetDisplayUnit, 'hours');
  assert.equal(normalized.activities[0].passingDisplayUnit, 'minutes');
});

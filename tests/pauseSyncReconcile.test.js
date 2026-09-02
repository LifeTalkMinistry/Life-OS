import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcilePauseStates } from '../src/sync/pauseSyncReconcile.js';

const HOUR = 60 * 60 * 1000;

function completed(id, startAt, durationHours = 1, overrides = {}) {
  return {
    id,
    label: 'Rest',
    startAt,
    endedAt: startAt + durationHours * HOUR,
    durationMs: durationHours * HOUR,
    reason: 'ended',
    ...overrides
  };
}

function active(id, startAt) {
  return {
    id,
    label: 'Rest',
    plannedMinutes: null,
    startAt,
    endAt: null,
    timerExpiredAt: null
  };
}

test('newer phone history clears an old computer Rest that stayed active offline', () => {
  const aug30 = Date.UTC(2026, 7, 30, 11, 14);
  const sep1 = Date.UTC(2026, 8, 1, 10, 0);
  const localComputer = {
    version: 1,
    customRests: [],
    history: [],
    active: active('rest-aug30', aug30)
  };
  const cloudFromPhone = {
    version: 1,
    customRests: [],
    history: [completed('phone-sep1', sep1, 7)],
    active: null
  };

  const result = reconcilePauseStates(localComputer, cloudFromPhone, {
    baseRevision: 4,
    remoteRevision: 9
  });

  assert.equal(result.state.active, null);
  assert.equal(result.state.history.length, 1);
  assert.equal(result.state.history[0].id, 'phone-sep1');
});

test('a stale server active Rest is also cleared when this device has a later completed Rest', () => {
  const aug30 = Date.UTC(2026, 7, 30, 11, 14);
  const sep1 = Date.UTC(2026, 8, 1, 10, 0);
  const localPhone = {
    version: 1,
    customRests: [],
    history: [completed('phone-sep1', sep1, 7)],
    active: null
  };
  const staleCloud = {
    version: 1,
    customRests: [],
    history: [],
    active: active('rest-aug30', aug30)
  };

  const result = reconcilePauseStates(localPhone, staleCloud, {
    baseRevision: 4,
    remoteRevision: 9
  });

  assert.equal(result.state.active, null);
  assert.equal(result.state.history[0].id, 'phone-sep1');
  assert.equal(result.differsFromRemote, true);
});

test('a genuinely newer offline Rest is preserved for upload after reconciliation', () => {
  const serverHistoryStart = Date.UTC(2026, 8, 1, 8, 0);
  const offlineStart = Date.UTC(2026, 8, 2, 8, 0);
  const local = {
    version: 1,
    customRests: [],
    history: [],
    active: active('offline-new', offlineStart)
  };
  const remote = {
    version: 1,
    customRests: [],
    history: [completed('server-old', serverHistoryStart, 1)],
    active: null
  };

  const result = reconcilePauseStates(local, remote, {
    baseRevision: 10,
    remoteRevision: 11
  });

  assert.equal(result.state.active.id, 'offline-new');
  assert.equal(result.state.history[0].id, 'server-old');
  assert.equal(result.differsFromRemote, true);
});

test('ending the cloud active Rest offline wins over that older active marker', () => {
  const start = Date.UTC(2026, 8, 2, 8, 0);
  const local = {
    version: 1,
    customRests: [],
    history: [completed('same-rest', start, 2)],
    active: null
  };
  const remote = {
    version: 1,
    customRests: [],
    history: [],
    active: active('same-rest', start)
  };

  const result = reconcilePauseStates(local, remote, {
    baseRevision: 20,
    remoteRevision: 20
  });

  assert.equal(result.state.active, null);
  assert.equal(result.state.history.length, 1);
  assert.equal(result.state.history[0].id, 'same-rest');
});

test('history from two devices is merged by Rest id instead of one snapshot replacing the other', () => {
  const first = Date.UTC(2026, 8, 1, 8, 0);
  const second = Date.UTC(2026, 8, 2, 8, 0);
  const local = { version: 1, customRests: [], history: [completed('local', second)], active: null };
  const remote = { version: 1, customRests: [], history: [completed('remote', first)], active: null };

  const result = reconcilePauseStates(local, remote, { baseRevision: 2, remoteRevision: 3 });
  assert.deepEqual(result.state.history.map((entry) => entry.id), ['local', 'remote']);
});

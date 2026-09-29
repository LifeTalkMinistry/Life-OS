import { DEFAULT_API_URL, TOKEN_KEY, USER_KEY } from '../auth/backendClient.js';
import {
  activitySyncStatesEqual,
  normalizeActivitySyncState,
  reconcileActivitySyncStates
} from './activitySyncReconcile.js';

(() => {
  const SYNC_PATH = '/api/pause/sync';
  const ACTIVITY_PREFIX = 'pause-activity-commitments-v1';
  const META_PREFIX = 'pause-activity-sync-meta-v1';
  const REST_KEY = 'pause-state-v1';
  const SCORE_KEY = 'pause-score-preference-v1';
  const PUSH_DELAY_MS = 550;
  const POLL_MS = 30_000;

  let applyingCloud = false;
  let syncInFlight = null;
  let pushTimer = null;
  let lastAccountId = '';

  function storage() {
    try { return window.localStorage; } catch { return null; }
  }

  function apiUrl() {
    const configured = String(window.PAUSE_API_URL || '').trim();
    return (configured || DEFAULT_API_URL).replace(/\/+$/, '');
  }

  function credentials() {
    const store = storage();
    if (!store) return null;
    const token = String(store.getItem(TOKEN_KEY) || '').trim();
    if (!token) return null;
    try {
      const user = JSON.parse(store.getItem(USER_KEY) || 'null');
      const id = String(user?.id ?? user?.user_id ?? user?.userId ?? '').trim();
      return id ? { token, accountId: id } : null;
    } catch {
      return null;
    }
  }

  function activityKey(accountId) {
    return `${ACTIVITY_PREFIX}:account:${accountId}`;
  }

  function metaKey(accountId) {
    return `${META_PREFIX}:account:${accountId}`;
  }

  function emptyActivityState() {
    return { version: 1, activities: [], sessions: [], active: null };
  }

  function readLocalActivityState(accountId) {
    try {
      return normalizeActivitySyncState(JSON.parse(storage()?.getItem(activityKey(accountId)) || 'null') || {});
    } catch {
      return emptyActivityState();
    }
  }

  function writeLocalActivityState(accountId, value) {
    const next = normalizeActivitySyncState(value);
    const current = readLocalActivityState(accountId);

    // A cloud poll that returns exactly what this device already has must be a
    // true no-op. Rewriting localStorage and dispatching activities-changed here
    // rebuilds the PAUSE screen for no user-visible reason and can interrupt an
    // ORB pointer sequence that is currently in progress.
    if (activitySyncStatesEqual(current, next)) return current;

    applyingCloud = true;
    try {
      storage()?.setItem(activityKey(accountId), JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('pause:activities-changed', { detail: next }));
    } finally {
      applyingCloud = false;
    }
    return next;
  }

  function readMeta(accountId) {
    try {
      const parsed = JSON.parse(storage()?.getItem(metaKey(accountId)) || '{}');
      return {
        initialized: parsed.initialized === true,
        dirty: parsed.dirty === true,
        lastSyncedActivityIds: Array.isArray(parsed.lastSyncedActivityIds)
          ? parsed.lastSyncedActivityIds.map(String).slice(0, 40)
          : [],
        deletedActivityIds: Array.isArray(parsed.deletedActivityIds)
          ? parsed.deletedActivityIds.map(String).slice(0, 80)
          : [],
        lastSyncedSessionIds: Array.isArray(parsed.lastSyncedSessionIds)
          ? parsed.lastSyncedSessionIds.map(String).slice(0, 500)
          : [],
        deletedSessionIds: Array.isArray(parsed.deletedSessionIds)
          ? parsed.deletedSessionIds.map(String).slice(0, 1000)
          : []
      };
    } catch {
      return {
        initialized: false,
        dirty: false,
        lastSyncedActivityIds: [],
        deletedActivityIds: [],
        lastSyncedSessionIds: [],
        deletedSessionIds: []
      };
    }
  }

  function saveMeta(accountId, meta) {
    try {
      storage()?.setItem(metaKey(accountId), JSON.stringify({
        initialized: meta.initialized === true,
        dirty: meta.dirty === true,
        lastSyncedActivityIds: Array.isArray(meta.lastSyncedActivityIds) ? meta.lastSyncedActivityIds.slice(0, 40) : [],
        deletedActivityIds: Array.isArray(meta.deletedActivityIds) ? meta.deletedActivityIds.slice(0, 80) : [],
        lastSyncedSessionIds: Array.isArray(meta.lastSyncedSessionIds) ? meta.lastSyncedSessionIds.slice(-500) : [],
        deletedSessionIds: Array.isArray(meta.deletedSessionIds) ? meta.deletedSessionIds.slice(-1000) : []
      }));
    } catch {}
  }

  function activityIds(state) {
    return normalizeActivitySyncState(state).activities.map((activity) => String(activity.id));
  }

  function sessionIds(state) {
    return normalizeActivitySyncState(state).sessions.map((session) => String(session.id));
  }

  function hasActivityData(state) {
    const normalized = normalizeActivitySyncState(state);
    return Boolean(normalized.activities.length || normalized.sessions.length || normalized.active);
  }

  function markLocalDirty(accountId) {
    const meta = readMeta(accountId);
    const current = readLocalActivityState(accountId);
    const currentActivityIds = new Set(activityIds(current));
    const currentSessionIds = new Set(sessionIds(current));
    if (meta.initialized) {
      const deletedActivities = new Set(meta.deletedActivityIds);
      meta.lastSyncedActivityIds.forEach((id) => {
        if (!currentActivityIds.has(String(id))) deletedActivities.add(String(id));
      });
      meta.deletedActivityIds = [...deletedActivities].slice(-80);

      const deletedSessions = new Set(meta.deletedSessionIds);
      meta.lastSyncedSessionIds.forEach((id) => {
        if (!currentSessionIds.has(String(id))) deletedSessions.add(String(id));
      });
      meta.deletedSessionIds = [...deletedSessions].slice(-1000);
    }
    meta.dirty = true;
    saveMeta(accountId, meta);
  }

  function markClean(accountId, state) {
    saveMeta(accountId, {
      initialized: true,
      dirty: false,
      lastSyncedActivityIds: activityIds(state),
      deletedActivityIds: [],
      lastSyncedSessionIds: sessionIds(state),
      deletedSessionIds: []
    });
  }

  function defaultRestState() {
    return { version: 1, customRests: [], history: [], active: null };
  }

  function readLocalRestState(accountId) {
    const store = storage();
    if (!store) return defaultRestState();
    try {
      const accountRaw = store.getItem(`${REST_KEY}:account:${accountId}`);
      const parsed = JSON.parse(accountRaw || store.getItem(REST_KEY) || 'null');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : defaultRestState();
    } catch {
      return defaultRestState();
    }
  }

  function readLocalScorePreference(accountId) {
    const store = storage();
    if (!store) return { version: 2, timeframe: 'daily', customRange: null };
    try {
      const accountRaw = store.getItem(`${SCORE_KEY}:account:${accountId}`);
      const parsed = JSON.parse(accountRaw || store.getItem(SCORE_KEY) || 'null');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : { version: 2, timeframe: 'daily', customRange: null };
    } catch {
      return { version: 2, timeframe: 'daily', customRange: null };
    }
  }

  async function parseResponse(response) {
    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }
    if (!response.ok) {
      const error = new Error(payload?.message || `PAUSE Activity sync failed with status ${response.status}.`);
      error.status = response.status;
      error.code = payload?.code || null;
      error.details = payload?.details || null;
      throw error;
    }
    return payload;
  }

  async function request(method, token, body) {
    const response = await fetch(`${apiUrl()}${SYNC_PATH}`, {
      method,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return parseResponse(response);
  }

  async function pullSnapshot(token) {
    return request('GET', token);
  }

  async function pushActivityState(credentialsValue, snapshot, activityState) {
    const state = snapshot?.exists && snapshot?.state
      ? { ...snapshot.state, activityState }
      : { ...readLocalRestState(credentialsValue.accountId), activityState };
    const scorePreference = snapshot?.scorePreference || readLocalScorePreference(credentialsValue.accountId);
    return request('PUT', credentialsValue.token, {
      state,
      scorePreference,
      baseRevision: Math.max(0, Math.trunc(Number(snapshot?.revision) || 0))
    });
  }

  function remoteActivityState(snapshot) {
    return normalizeActivitySyncState(snapshot?.state?.activityState || {});
  }

  async function reconcileAgainstSnapshot(credentialsValue, snapshot) {
    const accountId = credentialsValue.accountId;
    const local = readLocalActivityState(accountId);
    const remote = remoteActivityState(snapshot);
    const meta = readMeta(accountId);

    if (!snapshot?.exists && !hasActivityData(local)) return null;

    if (!meta.initialized) {
      const merged = reconcileActivitySyncStates(local, remote, {
        preferLocalActivities: hasActivityData(local),
        deletedActivityIds: [],
        deletedSessionIds: []
      });
      if (!snapshot?.exists || !activitySyncStatesEqual(merged, remote)) {
        return pushActivityState(credentialsValue, snapshot || { exists: false, revision: 0 }, merged);
      }
      writeLocalActivityState(accountId, merged);
      markClean(accountId, merged);
      return snapshot;
    }

    if (meta.dirty) {
      const merged = reconcileActivitySyncStates(local, remote, {
        preferLocalActivities: true,
        deletedActivityIds: meta.deletedActivityIds,
        deletedSessionIds: meta.deletedSessionIds
      });
      if (!activitySyncStatesEqual(merged, remote)) {
        return pushActivityState(credentialsValue, snapshot, merged);
      }
      writeLocalActivityState(accountId, merged);
      markClean(accountId, merged);
      return snapshot;
    }

    if (!activitySyncStatesEqual(local, remote)) writeLocalActivityState(accountId, remote);
    markClean(accountId, remote);
    return snapshot;
  }

  async function runSync() {
    const auth = credentials();
    if (!auth) return null;
    lastAccountId = auth.accountId;

    let snapshot = await pullSnapshot(auth.token);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await reconcileAgainstSnapshot(auth, snapshot);
        if (result?.exists && result?.state?.activityState) {
          const canonical = remoteActivityState(result);
          writeLocalActivityState(auth.accountId, canonical);
          markClean(auth.accountId, canonical);
        }
        return result;
      } catch (error) {
        if (error?.status !== 409 || error?.code !== 'PAUSE_SYNC_CONFLICT' || attempt === 1) throw error;
        snapshot = error?.details?.snapshot || await pullSnapshot(auth.token);
      }
    }
    return null;
  }

  function syncNow() {
    if (syncInFlight) return syncInFlight;
    syncInFlight = runSync()
      .catch(() => null)
      .finally(() => { syncInFlight = null; });
    return syncInFlight;
  }

  function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => syncNow(), PUSH_DELAY_MS);
  }

  function onActivitiesChanged() {
    if (applyingCloud) return;
    const auth = credentials();
    if (!auth) return;
    markLocalDirty(auth.accountId);
    schedulePush();
  }

  function checkAccount() {
    const auth = credentials();
    const nextAccount = auth?.accountId || '';
    if (!nextAccount || nextAccount === lastAccountId) return;
    lastAccountId = nextAccount;
    syncNow();
  }

  function init() {
    window.addEventListener('pause:activities-changed', onActivitiesChanged);
    window.addEventListener('online', () => syncNow());
    window.addEventListener('focus', () => syncNow());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) syncNow();
    });
    window.addEventListener('storage', (event) => {
      if (event.key === USER_KEY || event.key === TOKEN_KEY) checkAccount();
    });

    setInterval(checkAccount, 1500);
    setInterval(() => {
      if (!document.hidden) syncNow();
    }, POLL_MS);
    setTimeout(checkAccount, 0);
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') init();
})();

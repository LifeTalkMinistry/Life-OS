const activitySyncReconcileRuntime = (() => {
  const ACTIVITY_LIMIT = 40;
  const SESSION_LIMIT = 500;

  function cleanText(value, limit = 96) {
    return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, limit);
  }

  function finiteTimestamp(value) {
    if (value == null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number) : null;
  }

  function normalizeActivity(activity = {}) {
    const id = cleanText(activity.id, 96);
    const name = cleanText(activity.name, 48);
    if (!id || !name) return null;
    const targetMode = ['track', 'daily', 'weekly', 'total'].includes(activity.targetMode)
      ? activity.targetMode
      : 'track';
    const spanMode = ['ongoing', 'until', 'period'].includes(activity.spanMode)
      ? activity.spanMode
      : 'ongoing';
    const targetMinutes = Number(activity.targetMinutes);
    const passingTargetMinutes = Number(activity.passingTargetMinutes);
    return {
      id,
      name,
      targetMode,
      targetMinutes: targetMode === 'track' || !Number.isFinite(targetMinutes) ? null : Math.max(1, Math.round(targetMinutes)),
      passingTargetMinutes: targetMode === 'track' || !Number.isFinite(passingTargetMinutes) ? null : Math.max(1, Math.round(passingTargetMinutes)),
      spanMode,
      endDate: /^\d{4}-\d{2}-\d{2}$/.test(String(activity.endDate || '')) ? String(activity.endDate) : null,
      createdAt: finiteTimestamp(activity.createdAt),
      updatedAt: finiteTimestamp(activity.updatedAt)
    };
  }

  function normalizeSession(session = {}) {
    const id = cleanText(session.id, 96);
    const activityId = cleanText(session.activityId, 96);
    const name = cleanText(session.name || 'Activity', 48) || 'Activity';
    const startAt = finiteTimestamp(session.startAt);
    const endAt = finiteTimestamp(session.endAt);
    if (!id || !activityId || startAt == null || endAt == null) return null;
    const safeEndAt = Math.max(startAt, endAt);
    return {
      id,
      activityId,
      name,
      startAt,
      endAt: safeEndAt,
      durationMs: Math.max(0, safeEndAt - startAt)
    };
  }

  function normalizeActive(active) {
    if (!active || typeof active !== 'object') return null;
    const id = cleanText(active.id, 96);
    const activityId = cleanText(active.activityId, 96);
    const name = cleanText(active.name || 'Activity', 48) || 'Activity';
    const startAt = finiteTimestamp(active.startAt);
    if (!id || !activityId || startAt == null) return null;
    return { id, activityId, name, startAt };
  }

  function normalizeState(value = {}) {
    const activities = [];
    const seenActivities = new Set();
    for (const raw of Array.isArray(value?.activities) ? value.activities : []) {
      const activity = normalizeActivity(raw);
      if (!activity || seenActivities.has(activity.id)) continue;
      seenActivities.add(activity.id);
      activities.push(activity);
      if (activities.length >= ACTIVITY_LIMIT) break;
    }

    const sessionsByFingerprint = new Map();
    for (const raw of Array.isArray(value?.sessions) ? value.sessions : []) {
      const session = normalizeSession(raw);
      if (!session) continue;
      const fingerprint = `${session.activityId}:${session.startAt}`;
      const current = sessionsByFingerprint.get(fingerprint);
      if (!current || session.endAt >= current.endAt) sessionsByFingerprint.set(fingerprint, session);
    }
    const sessions = [...sessionsByFingerprint.values()]
      .sort((left, right) => left.endAt - right.endAt)
      .slice(-SESSION_LIMIT);

    let active = normalizeActive(value?.active);
    if (active && sessions.some((session) => session.activityId === active.activityId && session.startAt === active.startAt)) {
      active = null;
    }

    return { version: 1, activities, sessions, active };
  }

  function activityTimestamp(activity) {
    return Number(activity?.updatedAt || activity?.createdAt || 0);
  }

  function mergeActivities(localState, remoteState, { preferLocalActivities, deletedActivityIds }) {
    const deleted = new Set((deletedActivityIds || []).map(String));
    const byId = new Map();
    remoteState.activities.forEach((activity) => {
      if (!deleted.has(String(activity.id))) byId.set(String(activity.id), activity);
    });
    localState.activities.forEach((activity) => {
      const id = String(activity.id);
      if (deleted.has(id)) return;
      const remote = byId.get(id);
      if (!remote || preferLocalActivities || activityTimestamp(activity) >= activityTimestamp(remote)) {
        byId.set(id, activity);
      }
    });
    return [...byId.values()]
      .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
      .slice(0, ACTIVITY_LIMIT);
  }

  function mergeSessions(localState, remoteState, deletedActivityIds, deletedSessionIds, preferLocalSessions) {
    const deletedActivities = new Set((deletedActivityIds || []).map(String));
    const deletedSessions = new Set((deletedSessionIds || []).map(String));
    const localIds = new Set(localState.sessions.map((session) => String(session.id)));
    const byFingerprint = new Map();

    remoteState.sessions.forEach((session) => {
      if (deletedActivities.has(String(session.activityId)) || deletedSessions.has(String(session.id))) return;
      // A dirty local copy of the same session id represents an edit. Do not keep
      // the old remote fingerprint when startAt was changed locally.
      if (preferLocalSessions && localIds.has(String(session.id))) return;
      const fingerprint = `${session.activityId}:${session.startAt}`;
      const current = byFingerprint.get(fingerprint);
      if (!current || session.endAt >= current.endAt) byFingerprint.set(fingerprint, session);
    });

    localState.sessions.forEach((session) => {
      if (deletedActivities.has(String(session.activityId)) || deletedSessions.has(String(session.id))) return;
      const fingerprint = `${session.activityId}:${session.startAt}`;
      const current = byFingerprint.get(fingerprint);
      if (!current || preferLocalSessions || session.endAt >= current.endAt) byFingerprint.set(fingerprint, session);
    });

    return [...byFingerprint.values()]
      .sort((left, right) => left.endAt - right.endAt)
      .slice(-SESSION_LIMIT);
  }

  function resolveActive(localState, remoteState, sessions, deletedActivityIds, preferLocalActivities) {
    const deleted = new Set((deletedActivityIds || []).map(String));
    const candidates = [localState.active, remoteState.active]
      .filter(Boolean)
      .filter((active) => !deleted.has(String(active.activityId)))
      .filter((active) => !sessions.some((session) => session.activityId === active.activityId && session.startAt === active.startAt));
    if (!candidates.length) return null;
    if (preferLocalActivities && localState.active && candidates.includes(localState.active)) return localState.active;
    return candidates.sort((left, right) => Number(right.startAt) - Number(left.startAt))[0];
  }

  function reconcile(localValue, remoteValue, options = {}) {
    const localState = normalizeState(localValue);
    const remoteState = normalizeState(remoteValue);
    const preferLocalActivities = options.preferLocalActivities === true;
    const deletedActivityIds = Array.isArray(options.deletedActivityIds) ? options.deletedActivityIds : [];
    const deletedSessionIds = Array.isArray(options.deletedSessionIds) ? options.deletedSessionIds : [];
    const activities = mergeActivities(localState, remoteState, { preferLocalActivities, deletedActivityIds });
    const sessions = mergeSessions(localState, remoteState, deletedActivityIds, deletedSessionIds, preferLocalActivities);
    const active = resolveActive(localState, remoteState, sessions, deletedActivityIds, preferLocalActivities);
    return normalizeState({ version: 1, activities, sessions, active });
  }

  function equal(left, right) {
    return JSON.stringify(normalizeState(left)) === JSON.stringify(normalizeState(right));
  }

  return { normalizeState, reconcile, equal };
})();

export function normalizeActivitySyncState(value = {}) {
  return activitySyncReconcileRuntime.normalizeState(value);
}

export function reconcileActivitySyncStates(localValue, remoteValue, options = {}) {
  return activitySyncReconcileRuntime.reconcile(localValue, remoteValue, options);
}

export function activitySyncStatesEqual(left, right) {
  return activitySyncReconcileRuntime.equal(left, right);
}

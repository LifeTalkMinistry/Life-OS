function finiteTimestamp(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function entryKey(entry = {}) {
  const explicit = String(entry.id || '').trim();
  if (explicit) return explicit;
  return [
    finiteTimestamp(entry.startAt),
    finiteTimestamp(entry.endedAt),
    String(entry.label || 'Rest')
  ].join(':');
}

function entryMutationAt(entry = {}) {
  return Math.max(
    finiteTimestamp(entry.editedAt),
    finiteTimestamp(entry.endedAt),
    finiteTimestamp(entry.startAt)
  );
}

function normalizeState(state = {}) {
  return {
    version: 1,
    customRests: Array.isArray(state.customRests) ? state.customRests.filter(Boolean).slice(0, 40) : [],
    history: Array.isArray(state.history) ? state.history.filter(Boolean).slice(0, 500) : [],
    active: state.active && typeof state.active === 'object' ? { ...state.active } : null
  };
}

function mergeCustomRests(remote = [], local = []) {
  const result = [];
  const seen = new Set();
  for (const value of [...remote, ...local]) {
    const clean = String(value || '').trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= 40) break;
  }
  return result;
}

function chooseHistoryEntry(remoteEntry, localEntry) {
  if (!remoteEntry) return localEntry;
  if (!localEntry) return remoteEntry;

  const remoteEdited = finiteTimestamp(remoteEntry.editedAt);
  const localEdited = finiteTimestamp(localEntry.editedAt);
  if (localEdited !== remoteEdited) return localEdited > remoteEdited ? localEntry : remoteEntry;

  const remoteMutation = entryMutationAt(remoteEntry);
  const localMutation = entryMutationAt(localEntry);
  return localMutation > remoteMutation ? localEntry : remoteEntry;
}

function mergeHistory(remoteHistory = [], localHistory = []) {
  const byId = new Map();
  for (const entry of remoteHistory) {
    if (!entry || typeof entry !== 'object') continue;
    byId.set(entryKey(entry), entry);
  }
  for (const entry of localHistory) {
    if (!entry || typeof entry !== 'object') continue;
    const key = entryKey(entry);
    byId.set(key, chooseHistoryEntry(byId.get(key), entry));
  }

  return [...byId.values()]
    .sort((a, b) => entryMutationAt(b) - entryMutationAt(a))
    .slice(0, 500);
}

function hasHistoryId(history, id) {
  const clean = String(id || '').trim();
  return Boolean(clean && history.some((entry) => entryKey(entry) === clean));
}

function latestHistoryActivity(history = []) {
  return history.reduce((latest, entry) => Math.max(latest, entryMutationAt(entry)), 0);
}

function resolveActive(local, remote, mergedHistory, { baseRevision = 0, remoteRevision = 0 } = {}) {
  const localActive = local.active;
  const remoteActive = remote.active;
  const remoteAdvanced = Number(remoteRevision || 0) > Number(baseRevision || 0);
  const latestRemoteHistoryAt = latestHistoryActivity(remote.history);

  if (!localActive && !remoteActive) return null;

  if (localActive && hasHistoryId(remote.history, localActive.id)) {
    return null;
  }

  if (remoteActive && hasHistoryId(local.history, remoteActive.id)) {
    return null;
  }

  if (localActive && remoteActive && String(localActive.id) === String(remoteActive.id)) {
    return { ...remoteActive };
  }

  if (localActive && !remoteActive) {
    const localStartedAt = finiteTimestamp(localActive.startAt);
    if (remoteAdvanced && latestRemoteHistoryAt >= localStartedAt) {
      return null;
    }
    return { ...localActive };
  }

  if (!localActive && remoteActive) {
    return { ...remoteActive };
  }

  const localStartedAt = finiteTimestamp(localActive?.startAt);
  const remoteStartedAt = finiteTimestamp(remoteActive?.startAt);
  const remoteActivityAt = Math.max(remoteStartedAt, latestRemoteHistoryAt);

  if (localStartedAt > remoteActivityAt) {
    return { ...localActive };
  }

  if (hasHistoryId(mergedHistory, localActive?.id)) return { ...remoteActive };
  return { ...remoteActive };
}

export function reconcilePauseStates(localState, remoteState, options = {}) {
  const local = normalizeState(localState);
  const remote = normalizeState(remoteState);
  const history = mergeHistory(remote.history, local.history);
  const state = {
    version: 1,
    customRests: mergeCustomRests(remote.customRests, local.customRests),
    history,
    active: resolveActive(local, remote, history, options)
  };

  return {
    state,
    differsFromRemote: JSON.stringify(state) !== JSON.stringify(remote)
  };
}

export function pauseStatesEqual(left, right) {
  return JSON.stringify(normalizeState(left)) === JSON.stringify(normalizeState(right));
}

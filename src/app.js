import { Brand } from './components/Brand.js';
import { Orb } from './components/Orb.js';
import { OrbArtwork } from './components/OrbArtwork.js';
import { PauseScore } from './components/PauseScore.js';
import { TodayRing } from './components/TodayRing.js';
import { PausePanel } from './components/PausePanel.js';
import { AuthCheckingScreen, LoginScreen } from './auth/LoginScreen.js';
import {
  createPauseBackendAccount,
  friendlyAuthError,
  restorePauseBackendSession,
  signInWithPauseBackend,
  signOutFromPauseBackend
} from './auth/backendClient.js';
import { pullPauseCloudState, pushPauseCloudState } from './sync/pauseSyncClient.js';
import { createOrbGestureController } from './gestures/orbGestures.js';
import {
  completeExpiredRest,
  elapsedMs,
  finishRest,
  formatCountdown,
  formatElapsed,
  loadPauseState,
  remainingMs,
  savePauseState,
  setPauseStorageAccount,
  startRest
} from './restState.js';

const SCORE_PREFERENCE_KEY = 'pause-score-preference-v1';
const LEGACY_OWNER_KEY = 'pause-legacy-owner-v1';
const app = document.querySelector('#app');
let pauseState = loadPauseState();
let authState = {
  status: 'checking',
  session: null,
  error: ''
};
let authMode = 'login';
let screen = 'launch';
let menuOpen = false;
let panelView = null;
let completionVisible = false;
let launchTimer = null;
let completionTimer = null;
let tickTimer = null;
let gestureController = null;
let syncPushTimer = null;
let syncPollTimer = null;
let syncPushInFlight = null;
let syncPullInFlight = null;
let syncDirty = false;
let applyingCloudSnapshot = false;
let lastCloudRevision = 0;

function scorePreferenceStorageKey(accountId = authState.session?.user?.id) {
  const clean = String(accountId ?? '').trim();
  return clean ? `${SCORE_PREFERENCE_KEY}:account:${clean}` : SCORE_PREFERENCE_KEY;
}

function shouldAdoptLegacy(accountId) {
  try {
    const owner = String(localStorage.getItem(LEGACY_OWNER_KEY) || '').trim();
    return !owner || owner === String(accountId);
  } catch {
    return false;
  }
}

function markLegacyOwner(accountId) {
  try {
    if (!localStorage.getItem(LEGACY_OWNER_KEY)) {
      localStorage.setItem(LEGACY_OWNER_KEY, String(accountId));
    }
  } catch {}
}

function normalizeScorePreference(parsed = {}) {
  const timeframe = ['daily', 'weekly', 'monthly', 'custom'].includes(parsed.timeframe)
    ? parsed.timeframe
    : 'weekly';
  const customRange = parsed.customRange && parsed.customRange.start && parsed.customRange.end
    ? parsed.customRange
    : null;
  return { timeframe, customRange };
}

function loadScorePreference({ fallbackToLegacy = false } = {}) {
  try {
    const accountId = authState.session?.user?.id;
    let raw = localStorage.getItem(scorePreferenceStorageKey(accountId));
    if (!raw && accountId && fallbackToLegacy) {
      raw = localStorage.getItem(SCORE_PREFERENCE_KEY);
    }
    return normalizeScorePreference(JSON.parse(raw || '{}'));
  } catch {
    return { timeframe: 'weekly', customRange: null };
  }
}

let scorePreference = loadScorePreference();

function saveScorePreference(next, { notify = true } = {}) {
  scorePreference = normalizeScorePreference(next);
  try {
    localStorage.setItem(scorePreferenceStorageKey(), JSON.stringify(scorePreference));
  } catch {}
  if (notify) queueCloudPush();
}

function applyCloudSnapshot(snapshot) {
  if (!snapshot?.exists || !snapshot.state) return false;
  applyingCloudSnapshot = true;
  try {
    pauseState = savePauseState(snapshot.state, { notify: false });
    saveScorePreference(snapshot.scorePreference || {}, { notify: false });
    lastCloudRevision = Math.max(lastCloudRevision, Number(snapshot.revision || 0));
    syncDirty = false;
  } finally {
    applyingCloudSnapshot = false;
  }
  return true;
}

async function pushCloudNow() {
  if (authState.status !== 'authenticated' || !authState.session?.token || applyingCloudSnapshot) return null;
  if (syncPushInFlight) return syncPushInFlight;

  clearTimeout(syncPushTimer);
  syncPushTimer = null;
  const token = authState.session.token;
  const stateToSend = pauseState;
  const preferenceToSend = scorePreference;

  syncPushInFlight = pushPauseCloudState(token, {
    state: stateToSend,
    scorePreference: preferenceToSend
  })
    .then((snapshot) => {
      lastCloudRevision = Math.max(lastCloudRevision, Number(snapshot?.revision || 0));
      syncDirty = false;
      return snapshot;
    })
    .catch((error) => {
      syncDirty = true;
      if (error?.status === 401 || error?.status === 403) return null;
      return null;
    })
    .finally(() => {
      syncPushInFlight = null;
    });

  return syncPushInFlight;
}

function queueCloudPush() {
  if (authState.status !== 'authenticated' || applyingCloudSnapshot) return;
  syncDirty = true;
  clearTimeout(syncPushTimer);
  syncPushTimer = setTimeout(() => {
    pushCloudNow();
  }, 500);
}

async function pullCloudNow({ force = false } = {}) {
  if (authState.status !== 'authenticated' || !authState.session?.token) return null;
  if (!force && (syncDirty || syncPushInFlight)) return null;
  if (syncPullInFlight) return syncPullInFlight;

  const token = authState.session.token;
  syncPullInFlight = pullPauseCloudState(token)
    .then((snapshot) => {
      const revision = Number(snapshot?.revision || 0);
      if (snapshot?.exists && (force || revision > lastCloudRevision)) {
        applyCloudSnapshot(snapshot);
        if (screen === 'main') {
          checkExpired();
          render();
        }
      }
      return snapshot;
    })
    .catch(() => null)
    .finally(() => {
      syncPullInFlight = null;
    });

  return syncPullInFlight;
}

async function syncNow() {
  if (syncDirty) await pushCloudNow();
  if (!syncDirty) await pullCloudNow();
}

function startSyncPolling() {
  clearInterval(syncPollTimer);
  syncPollTimer = setInterval(() => {
    if (document.hidden || authState.status !== 'authenticated') return;
    syncNow();
  }, 30_000);
}

function stopSyncPolling() {
  clearTimeout(syncPushTimer);
  clearInterval(syncPollTimer);
  syncPushTimer = null;
  syncPollTimer = null;
  syncDirty = false;
  syncPushInFlight = null;
  syncPullInFlight = null;
  lastCloudRevision = 0;
}

async function hydrateAccountState(session) {
  const accountId = session?.user?.id;
  if (!accountId) return;

  setPauseStorageAccount(accountId);
  const fallbackToLegacy = shouldAdoptLegacy(accountId);
  pauseState = loadPauseState({ fallbackToLegacy });
  scorePreference = loadScorePreference({ fallbackToLegacy });

  if (session.offline) {
    if (fallbackToLegacy) markLegacyOwner(accountId);
    return;
  }

  try {
    const snapshot = await pullPauseCloudState(session.token);
    if (snapshot?.exists) {
      applyCloudSnapshot(snapshot);
    } else {
      const saved = await pushPauseCloudState(session.token, {
        state: pauseState,
        scorePreference
      });
      lastCloudRevision = Number(saved?.revision || 0);
      syncDirty = false;
    }
    if (fallbackToLegacy) markLegacyOwner(accountId);
  } catch {
    // PAUSE remains local-first if sync is temporarily unavailable.
  }
}

function checkExpired() {
  const result = completeExpiredRest(pauseState);
  pauseState = result.state;
  if (result.completed) showCompletion();
  return result.completed;
}

function showCompletion() {
  completionVisible = true;
  menuOpen = false;
  panelView = null;
  clearTimeout(completionTimer);
  completionTimer = setTimeout(() => {
    completionVisible = false;
    render();
  }, 1800);
  render();
}

function openInsights() {
  menuOpen = false;
  panelView = 'insights';
  render();
}

function closePanel() {
  panelView = null;
  render();
}

function handleScoreChange({ timeframe, customRange }) {
  saveScorePreference({
    timeframe: ['daily', 'weekly', 'monthly', 'custom'].includes(timeframe) ? timeframe : 'weekly',
    customRange: customRange || scorePreference.customRange || null
  });
  render();
}

function beginImmediateRest() {
  if (pauseState.active) return;
  pauseState = startRest(pauseState, 'Rest');
  panelView = null;
  menuOpen = false;
  completionVisible = false;
  render();
}

function handleMenuSelect(item) {
  if (item === 'insights') openInsights();
}

function handleOrbAction(action) {
  if (action === 'close-menu') {
    menuOpen = false;
    return render();
  }
  if (action === 'end-rest' && pauseState.active) {
    pauseState = finishRest(pauseState, 'ended');
    return showCompletion();
  }
}

function getGestureHandlers() {
  gestureController?.destroy();
  gestureController = createOrbGestureController({
    onSingleTap: () => {
      if (!pauseState.active) beginImmediateRest();
    },
    onDoubleTap: () => {
      if (!pauseState.active) beginImmediateRest();
    },
    onHoldStart: () => {
      if (!pauseState.active) return;
      menuOpen = true;
      panelView = null;
      render();
    },
    onHoldEnd: () => {}
  });
  return {
    pointerDown: () => gestureController.pointerDown(),
    pointerUp: () => gestureController.pointerUp(),
    cancel: () => gestureController.cancel(),
    keyboardTap: () => {
      if (!pauseState.active) beginImmediateRest();
    }
  };
}

function LaunchScreen() {
  const view = document.createElement('section');
  view.className = 'screen launch-screen pause-launch-screen';
  view.innerHTML = `
    <div class="launch-brand">
      <div class="brand-title brand-title-launch pause-brand-title" aria-label="PAUSE">
        <span>P A U S E</span>
      </div>
      <p>Know When to Stop.</p>
    </div>
    <div class="launch-orb" aria-hidden="true"><div class="orb"></div></div>
  `;
  view.querySelector('.launch-orb')?.prepend(OrbArtwork());
  return view;
}

function MainScreen() {
  checkExpired();

  const showHomeControls = !pauseState.active && !completionVisible && !panelView;
  const showInsightsLink = menuOpen || showHomeControls;

  const view = document.createElement('section');
  view.className = `screen main-screen pause-main-screen${showInsightsLink ? ' has-pause-menu' : ''}${pauseState.active ? ' is-resting' : ''}`;
  view.appendChild(Brand());

  if (showHomeControls) {
    view.appendChild(PauseScore({
      state: pauseState,
      timeframe: scorePreference.timeframe,
      customRange: scorePreference.customRange,
      onChange: handleScoreChange
    }));
  }

  const stage = document.createElement('div');
  stage.className = 'orb-stage';

  if (showInsightsLink) stage.appendChild(TodayRing(handleMenuSelect));

  const mode = completionVisible
    ? 'completed'
    : menuOpen && pauseState.active
      ? 'menu'
      : pauseState.active
        ? 'resting'
        : 'idle';

  const orb = Orb({
    state: pauseState,
    mode,
    gestureHandlers: !menuOpen && !completionVisible ? getGestureHandlers() : null,
    onAction: handleOrbAction
  });
  stage.appendChild(orb);
  view.appendChild(stage);

  const hint = document.createElement('p');
  hint.className = 'gesture-hint is-visible pause-hint';
  hint.textContent = menuOpen
    ? 'Rest Insights · Tap orb to return'
    : pauseState.active
      ? 'Resting now · End when you’re ready'
      : 'Tap orb to pause now';
  view.appendChild(hint);

  if (panelView === 'insights') {
    view.appendChild(PausePanel({
      state: pauseState,
      onClose: closePanel
    }));
  }

  return view;
}

function startAuthenticatedApp() {
  clearTimeout(launchTimer);
  screen = 'launch';
  menuOpen = false;
  panelView = null;
  completionVisible = false;
  startSyncPolling();
  render();
  launchTimer = setTimeout(() => {
    if (authState.status !== 'authenticated') return;
    screen = 'main';
    checkExpired();
    render();
  }, 1100);
}

async function handleLogin(credentials) {
  authState.error = '';
  try {
    const session = await signInWithPauseBackend(credentials);
    authState = {
      status: 'authenticated',
      session,
      error: ''
    };
    await hydrateAccountState(session);
    startAuthenticatedApp();
  } catch (error) {
    authState = {
      status: 'signed-out',
      session: null,
      error: friendlyAuthError(error)
    };
    render();
  }
}

async function handleRegister(credentials) {
  authState.error = '';
  try {
    const session = await createPauseBackendAccount(credentials);
    authState = {
      status: 'authenticated',
      session,
      error: ''
    };
    await hydrateAccountState(session);
    startAuthenticatedApp();
  } catch (error) {
    authState = {
      status: 'signed-out',
      session: null,
      error: friendlyAuthError(error)
    };
    render();
  }
}

function changeAuthMode(nextMode) {
  authMode = nextMode === 'signup' ? 'signup' : 'login';
  authState.error = '';
  render();
}

async function signOut() {
  clearTimeout(launchTimer);
  if (syncDirty) await pushCloudNow();
  stopSyncPolling();
  signOutFromPauseBackend();
  setPauseStorageAccount(null);
  authMode = 'login';
  authState = {
    status: 'signed-out',
    session: null,
    error: ''
  };
  pauseState = loadPauseState();
  scorePreference = loadScorePreference();
  screen = 'launch';
  menuOpen = false;
  panelView = null;
  completionVisible = false;
  render();
}

function render() {
  if (authState.status === 'checking') {
    app.replaceChildren(AuthCheckingScreen());
    return;
  }

  if (authState.status !== 'authenticated') {
    app.replaceChildren(LoginScreen({
      mode: authMode,
      onLogin: handleLogin,
      onRegister: handleRegister,
      onModeChange: changeAuthMode,
      error: authState.error
    }));
    return;
  }

  if (screen === 'launch') app.replaceChildren(LaunchScreen());
  else app.replaceChildren(MainScreen());
}

function updateLiveTimer() {
  if (authState.status !== 'authenticated' || !pauseState.active || completionVisible || menuOpen) return;
  const timer = app.querySelector('[data-pause-timer]');
  if (!timer) return;

  const nextValue = pauseState.active.endAt
    ? formatCountdown(remainingMs(pauseState))
    : formatElapsed(elapsedMs(pauseState));

  if (timer.textContent !== nextValue) timer.textContent = nextValue;
}

function onKeydown(event) {
  if (authState.status !== 'authenticated' || event.key !== 'Escape') return;
  if (panelView) return closePanel();
  if (menuOpen) {
    menuOpen = false;
    render();
  }
}

async function bootstrapAuth() {
  authState = {
    status: 'checking',
    session: null,
    error: ''
  };
  render();

  try {
    const session = await restorePauseBackendSession();
    if (!session) {
      authMode = 'login';
      authState = {
        status: 'signed-out',
        session: null,
        error: ''
      };
      render();
      return;
    }

    authState = {
      status: 'authenticated',
      session,
      error: ''
    };
    await hydrateAccountState(session);
    startAuthenticatedApp();
  } catch (error) {
    authMode = 'login';
    authState = {
      status: 'signed-out',
      session: null,
      error: friendlyAuthError(error)
    };
    render();
  }
}

document.addEventListener('keydown', onKeydown);
window.addEventListener('pause:state-changed', (event) => {
  if (event.detail) pauseState = event.detail;
  queueCloudPush();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && authState.status === 'authenticated' && screen === 'main') {
    checkExpired();
    render();
    syncNow();
  }
});
window.addEventListener('focus', () => {
  if (authState.status === 'authenticated' && screen === 'main') {
    checkExpired();
    render();
    syncNow();
  }
});

tickTimer = setInterval(() => {
  if (authState.status !== 'authenticated' || screen !== 'main' || !pauseState.active || completionVisible) return;
  if (checkExpired()) return;
  updateLiveTimer();
}, 250);

window.__PAUSE__ = {
  getState: () => ({
    pauseState,
    authStatus: authState.status,
    authMode,
    user: authState.session?.user || null,
    screen,
    menuOpen,
    panelView,
    completionVisible,
    scorePreference,
    sync: {
      dirty: syncDirty,
      revision: lastCloudRevision
    }
  }),
  openInsights,
  takeRest: () => beginImmediateRest(),
  syncNow,
  signOut
};

bootstrapAuth();
import { Brand } from './components/Brand.js';
import { Orb } from './components/Orb.js';
import { OrbArtwork } from './components/OrbArtwork.js';
import { PauseScore } from './components/PauseScore.js';
import { TodayRing } from './components/TodayRing.js';
import { PausePanel } from './components/PausePanel.js';
import { PauseTimerPicker } from './components/PauseTimerPicker.js';
import { PauseOrbMenu } from './components/PauseOrbMenu.js';
import { PauseSettingsPanel } from './components/PauseSettingsPanel.js';
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
import { manilaDateKey } from './manilaTime.js';
import { playPauseAlarm, primePauseAlarm } from './pauseAlarm.js';
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
  startRest,
  timerOvertimeMs
} from './restState.js';

const SCORE_PREFERENCE_KEY = 'pause-score-preference-v1';
const SCORE_PREFERENCE_VERSION = 2;
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
let renderedManilaDayKey = manilaDateKey();

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
  const requestedTimeframe = ['daily', 'weekly', 'monthly', 'custom'].includes(parsed.timeframe)
    ? parsed.timeframe
    : null;
  const isLegacyPreference = Number(parsed.version || 0) < SCORE_PREFERENCE_VERSION;
  const timeframe = isLegacyPreference && requestedTimeframe === 'weekly'
    ? 'daily'
    : requestedTimeframe || 'daily';
  const customRange = parsed.customRange && parsed.customRange.start && parsed.customRange.end
    ? parsed.customRange
    : null;
  return { version: SCORE_PREFERENCE_VERSION, timeframe, customRange };
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
    return { version: SCORE_PREFERENCE_VERSION, timeframe: 'daily', customRange: null };
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
  if (result.completed) playPauseAlarm();
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

function openTimerPicker() {
  if (pauseState.active) return;
  menuOpen = false;
  panelView = 'timer';
  render();
}

function openSettings() {
  menuOpen = false;
  panelView = 'settings';
  render();
}

function openRecoveryPlan(section = 'plan') {
  menuOpen = false;
  panelView = null;
  render();

  const launch = () => {
    const recovery = window.__PAUSE_RECOVERY_PLAN__;
    if (!recovery) return false;
    if (section === 'nudges' && typeof recovery.openNudges === 'function') {
      return recovery.openNudges();
    }
    return recovery.openSetup?.() || false;
  };

  if (!launch()) setTimeout(launch, 100);
}

function closePanel() {
  panelView = null;
  render();
}

function handleScoreChange({ timeframe, customRange }) {
  saveScorePreference({
    version: SCORE_PREFERENCE_VERSION,
    timeframe: ['daily', 'weekly', 'monthly', 'custom'].includes(timeframe) ? timeframe : 'daily',
    customRange: customRange || scorePreference.customRange || null
  });
  render();
}

function beginRest(durationMinutes = null) {
  if (pauseState.active) return;
  if (durationMinutes) primePauseAlarm();
  pauseState = startRest(pauseState, 'Rest', durationMinutes);
  panelView = null;
  menuOpen = false;
  completionVisible = false;
  render();
}

function beginImmediateRest() {
  beginRest(null);
}

function beginTimedRest(minutes) {
  beginRest(minutes);
}

function handleMenuSelect(item) {
  if (item === 'timer') return openTimerPicker();
  if (item === 'recovery') return openRecoveryPlan('plan');
  if (item === 'nudges') return openRecoveryPlan('nudges');
  if (item === 'insights') return openInsights();
  if (item === 'settings') return openSettings();
}

function handleSettingsSelect(item) {
  if (item === 'recovery') return openRecoveryPlan('plan');
  if (item === 'nudges') return openRecoveryPlan('nudges');
  if (item === 'insights') return openInsights();
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

function openOrbMenu() {
  menuOpen = true;
  panelView = null;
  completionVisible = false;
  render();
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
    onHoldStart: openOrbMenu,
    onHoldEnd: () => {}
  });
  return {
    pointerDown: () => gestureController.pointerDown(),
    pointerUp: () => gestureController.pointerUp(),
    cancel: () => gestureController.cancel(),
    keyboardTap: () => {
      if (!pauseState.active) beginImmediateRest();
    },
    keyboardHold: openOrbMenu
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

  const showHomeControls = !menuOpen && !pauseState.active && !completionVisible && !panelView;
  const showInsightsLink = !menuOpen && showHomeControls;

  const view = document.createElement('section');
  view.className = `screen main-screen pause-main-screen${showInsightsLink ? ' has-pause-menu' : ''}${menuOpen ? ' is-today is-pause-menu' : ''}${pauseState.active ? ' is-resting' : ''}`;
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
  if (menuOpen) {
    stage.appendChild(PauseOrbMenu({
      active: Boolean(pauseState.active),
      onSelect: handleMenuSelect
    }));
  }

  const mode = completionVisible
    ? 'completed'
    : menuOpen
      ? 'menu'
      : pauseState.active
        ? 'resting'
        : 'idle';

  const orb = Orb({
    state: pauseState,
    mode,
    gestureHandlers: !menuOpen && !completionVisible && !panelView ? getGestureHandlers() : null,
    onAction: handleOrbAction
  });
  stage.appendChild(orb);
  view.appendChild(stage);

  const hint = document.createElement('p');
  hint.className = 'gesture-hint is-visible pause-hint';
  hint.textContent = menuOpen
    ? 'Choose an option · Tap orb to return'
    : pauseState.active?.timerExpiredAt
      ? 'Timer done · Rest continues until you end it'
      : pauseState.active
        ? 'Resting now · Hold for more'
        : 'Tap to pause · Hold for more';
  view.appendChild(hint);

  if (panelView === 'insights') {
    view.appendChild(PausePanel({
      state: pauseState,
      onClose: closePanel
    }));
  }

  if (panelView === 'timer') {
    view.appendChild(PauseTimerPicker({
      onSelect: (minutes) => {
        if (minutes) beginTimedRest(minutes);
        else beginImmediateRest();
      },
      onClose: closePanel
    }));
  }

  if (panelView === 'settings') {
    view.appendChild(PauseSettingsPanel({
      email: authState.session?.user?.email || '',
      onClose: closePanel,
      onSelect: handleSettingsSelect,
      onSignOut: signOut
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
  renderedManilaDayKey = manilaDateKey();

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

  const nextValue = pauseState.active.timerExpiredAt
    ? `+${formatElapsed(timerOvertimeMs(pauseState))}`
    : pauseState.active.endAt
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
  if (authState.status !== 'authenticated' || screen !== 'main') return;

  const currentManilaDayKey = manilaDateKey();
  if (currentManilaDayKey !== renderedManilaDayKey) {
    renderedManilaDayKey = currentManilaDayKey;
    render();
    return;
  }

  if (!pauseState.active || completionVisible) return;
  if (checkExpired()) {
    render();
    return;
  }
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
  openTimerPicker,
  openSettings,
  openMenu: openOrbMenu,
  takeRest: () => beginImmediateRest(),
  takeTimedRest: (minutes) => beginTimedRest(Number(minutes)),
  syncNow,
  signOut
};

bootstrapAuth();
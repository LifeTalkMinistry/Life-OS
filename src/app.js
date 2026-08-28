import { Brand } from './components/Brand.js';
import { Orb } from './components/Orb.js';
import { OrbArtwork } from './components/OrbArtwork.js';
import { PauseScore } from './components/PauseScore.js';
import { TodayRing } from './components/TodayRing.js';
import { PausePanel } from './components/PausePanel.js';
import { AuthCheckingScreen, LoginScreen } from './auth/LoginScreen.js';
import {
  friendlyAuthError,
  restorePauseBackendSession,
  signInWithPauseBackend,
  signOutFromPauseBackend
} from './auth/backendClient.js';
import { createOrbGestureController } from './gestures/orbGestures.js';
import {
  completeExpiredRest,
  elapsedMs,
  finishRest,
  formatCountdown,
  formatElapsed,
  loadPauseState,
  remainingMs,
  startRest
} from './restState.js';

const SCORE_PREFERENCE_KEY = 'pause-score-preference-v1';
const app = document.querySelector('#app');
let pauseState = loadPauseState();
let authState = {
  status: 'checking',
  session: null,
  error: ''
};
let screen = 'launch';
let menuOpen = false;
let panelView = null;
let completionVisible = false;
let launchTimer = null;
let completionTimer = null;
let tickTimer = null;
let gestureController = null;

function loadScorePreference() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SCORE_PREFERENCE_KEY) || '{}');
    const timeframe = ['daily', 'weekly', 'monthly', 'custom'].includes(parsed.timeframe)
      ? parsed.timeframe
      : 'weekly';
    const customRange = parsed.customRange && parsed.customRange.start && parsed.customRange.end
      ? parsed.customRange
      : null;
    return { timeframe, customRange };
  } catch {
    return { timeframe: 'weekly', customRange: null };
  }
}

let scorePreference = loadScorePreference();

function saveScorePreference(next) {
  scorePreference = next;
  try {
    localStorage.setItem(SCORE_PREFERENCE_KEY, JSON.stringify(next));
  } catch {}
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

  // Home stays intentionally minimal: PAUSE Score above the ORB, the ORB as
  // the rest action itself, and Rest Insights below it.
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

function signOut() {
  clearTimeout(launchTimer);
  signOutFromPauseBackend();
  authState = {
    status: 'signed-out',
    session: null,
    error: ''
  };
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
      onSubmit: handleLogin,
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

document.addEventListener('keydown', onKeydown);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && authState.status === 'authenticated' && screen === 'main') {
    checkExpired();
    render();
  }
});
window.addEventListener('focus', () => {
  if (authState.status === 'authenticated' && screen === 'main') {
    checkExpired();
    render();
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
    user: authState.session?.user || null,
    screen,
    menuOpen,
    panelView,
    completionVisible,
    scorePreference
  }),
  openInsights,
  takeRest: () => beginImmediateRest(),
  signOut
};

bootstrapAuth();

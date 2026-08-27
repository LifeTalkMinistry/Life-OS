import { Brand } from './components/Brand.js';
import { Orb } from './components/Orb.js';
import { OrbArtwork } from './components/OrbArtwork.js';
import { TodayRing } from './components/TodayRing.js';
import { PausePanel } from './components/PausePanel.js';
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

const app = document.querySelector('#app');
let pauseState = loadPauseState();
let screen = 'launch';
let menuOpen = false;
let panelView = null;
let completionVisible = false;
let launchTimer = null;
let completionTimer = null;
let tickTimer = null;
let gestureController = null;

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

  // PAUSE now has two primary jobs: tap the ORB to stop, or open Rest Insights
  // to understand the pattern of those intentional pauses.
  const showInsightsLink = menuOpen || (!pauseState.active && !completionVisible && !panelView);

  const view = document.createElement('section');
  view.className = `screen main-screen pause-main-screen${showInsightsLink ? ' has-pause-menu' : ''}${pauseState.active ? ' is-resting' : ''}`;
  view.appendChild(Brand());

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

function render() {
  if (screen === 'launch') app.replaceChildren(LaunchScreen());
  else app.replaceChildren(MainScreen());
}

function updateLiveTimer() {
  if (!pauseState.active || completionVisible || menuOpen) return;
  const timer = app.querySelector('[data-pause-timer]');
  if (!timer) return;

  const nextValue = pauseState.active.endAt
    ? formatCountdown(remainingMs(pauseState))
    : formatElapsed(elapsedMs(pauseState));

  if (timer.textContent !== nextValue) timer.textContent = nextValue;
}

function onKeydown(event) {
  if (event.key !== 'Escape') return;
  if (panelView) return closePanel();
  if (menuOpen) {
    menuOpen = false;
    render();
  }
}

document.addEventListener('keydown', onKeydown);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && screen === 'main') {
    checkExpired();
    render();
  }
});
window.addEventListener('focus', () => {
  if (screen === 'main') {
    checkExpired();
    render();
  }
});

render();
launchTimer = setTimeout(() => {
  screen = 'main';
  checkExpired();
  render();
}, 1100);

tickTimer = setInterval(() => {
  if (screen !== 'main' || !pauseState.active || completionVisible) return;
  if (checkExpired()) return;
  updateLiveTimer();
}, 250);

window.__PAUSE__ = {
  getState: () => ({ pauseState, screen, menuOpen, panelView, completionVisible }),
  openInsights,
  takeRest: () => beginImmediateRest()
};

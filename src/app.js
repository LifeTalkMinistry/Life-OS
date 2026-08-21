import { Brand } from './components/Brand.js';
import { Orb } from './components/Orb.js';
import { TodayRing } from './components/TodayRing.js';
import { WhyPanel } from './components/WhyPanel.js';
import { createOrbGestureController } from './gestures/orbGestures.js';
import {
  addUrgentMatter,
  completeCurrent,
  createInitialLifeState,
  currentActivity,
  deferCurrent,
  extendCurrent
} from './state/lifeState.js';

const app = document.querySelector('#app');
let lifeState = createInitialLifeState();
let screen = 'launch';
let orbMode = 'now';
let whyOpen = false;
let hintVisible = true;
let completionTimer = null;
let launchTimer = null;
let gestureController = null;

function hideHint() {
  hintVisible = false;
}

function setMode(mode) {
  orbMode = mode;
  render();
}

function openWhy() {
  hideHint();
  whyOpen = true;
  render();
}

function closeWhy() {
  whyOpen = false;
  render();
}

function handleAdjustment(dataset) {
  hideHint();

  if (dataset.action === 'done') {
    orbMode = 'completed';
    render();
    clearTimeout(completionTimer);
    completionTimer = setTimeout(() => {
      lifeState = completeCurrent(lifeState);
      orbMode = 'now';
      render();
    }, 900);
    return;
  }

  if (dataset.action === 'more') return setMode('more-time');
  if (dataset.action === 'cant') return setMode('cant-now');
  if (dataset.action === 'urgent') return setMode('urgent-time');

  if (dataset.minutes) {
    lifeState = extendCurrent(lifeState, Number(dataset.minutes));
    orbMode = 'now';
    return render();
  }

  if (dataset.defer) {
    lifeState = deferCurrent(lifeState, dataset.defer);
    orbMode = 'now';
    return render();
  }

  if (dataset.urgent) {
    const minutes = dataset.urgent === 'unknown' ? null : Number(dataset.urgent);
    lifeState = addUrgentMatter(lifeState, minutes);
    orbMode = 'now';
    return render();
  }
}

function getGestureController() {
  gestureController?.destroy();
  gestureController = createOrbGestureController({
    onSingleTap: openWhy,
    onDoubleTap: () => {
      hideHint();
      whyOpen = false;
      orbMode = 'adjust';
      render();
    },
    onHoldStart: () => {
      hideHint();
      whyOpen = false;
      orbMode = 'today';

      const releaseHold = () => {
        if (orbMode !== 'today') return;
        orbMode = 'now';
        render();
      };
      window.addEventListener('pointerup', releaseHold, { once: true });
      window.addEventListener('pointercancel', releaseHold, { once: true });
      render();
    },
    onHoldEnd: () => {
      if (orbMode !== 'today') return;
      orbMode = 'now';
      render();
    }
  });

  return {
    pointerDown: () => gestureController.pointerDown(),
    pointerUp: () => gestureController.pointerUp(),
    cancel: () => gestureController.cancel(),
    keyboardTap: openWhy
  };
}

function LaunchScreen() {
  const view = document.createElement('section');
  view.className = 'screen launch-screen';
  view.innerHTML = `
    <div class="launch-brand">
      <div class="brand-title brand-title-launch" aria-label="LIFE OS">
        <span>L I F E</span><span class="brand-os">O S</span>
      </div>
      <p>Control your life.</p>
    </div>
    <div class="launch-orb" aria-hidden="true"><div class="orb"></div></div>
  `;
  return view;
}

function MainScreen() {
  const activity = currentActivity(lifeState);
  const view = document.createElement('section');
  view.className = `screen main-screen${orbMode === 'today' ? ' is-today' : ''}`;
  view.appendChild(Brand());

  const stage = document.createElement('div');
  stage.className = 'orb-stage';

  if (orbMode === 'today') {
    stage.appendChild(TodayRing(lifeState.activities, activity.id));
  }

  stage.appendChild(Orb({
    activity,
    mode: orbMode,
    gestureHandlers: orbMode === 'now' ? getGestureController() : null,
    onAction: handleAdjustment
  }));

  view.appendChild(stage);

  const hint = document.createElement('p');
  hint.className = `gesture-hint${hintVisible && orbMode === 'now' ? ' is-visible' : ''}`;
  hint.textContent = orbMode === 'today'
    ? 'Release to return to now'
    : 'Tap for why · Hold for today · Double tap to adjust';
  view.appendChild(hint);

  if (whyOpen) {
    view.appendChild(WhyPanel(activity, closeWhy));
  }

  return view;
}

function render() {
  app.replaceChildren(screen === 'launch' ? LaunchScreen() : MainScreen());
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    if (whyOpen) return closeWhy();
    if (orbMode !== 'now') {
      orbMode = 'now';
      render();
    }
  }
}

document.addEventListener('keydown', onKeydown);
render();

launchTimer = setTimeout(() => {
  screen = 'now';
  render();
}, 1800);

window.__LIFE_OS__ = {
  getState: () => ({ screen, orbMode, whyOpen, lifeState }),
  reset: () => {
    clearTimeout(completionTimer);
    clearTimeout(launchTimer);
    lifeState = createInitialLifeState();
    screen = 'now';
    orbMode = 'now';
    whyOpen = false;
    hintVisible = true;
    render();
  }
};

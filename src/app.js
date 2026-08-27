import { Brand } from './components/Brand.js';
import { Orb } from './components/Orb.js';
import { OrbArtwork } from './components/OrbArtwork.js';
import { PausePanel } from './components/PausePanel.js';
import { createOrbGestureController } from './gestures/orbGestures.js';
import {
  addCustomRest,
  completeExpiredRest,
  finishRest,
  loadPauseState,
  removeCustomRest,
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

function openPanel(view) {
  menuOpen = false;
  panelView = view;
  render();
}

function closePanel() {
  panelView = null;
  render();
}

function handleMenuSelect(item) {
  if (item === 'take-rest') return openPanel('take-rest');
  if (item === 'history') return openPanel('history');
  if (item === 'insights') return openPanel('insights');
  if (item === 'my-rests') return openPanel('my-rests');
}

function handleOrbAction(action) {
  if (action?.startsWith('menu:')) {
    return handleMenuSelect(action.slice(5));
  }
  if (action === 'close-menu') {
    menuOpen = false;
    return render();
  }
  if (action === 'end-rest' && pauseState.active) {
    pauseState = finishRest(pauseState, 'ended-early');
    return showCompletion();
  }
}

function handleStartRest({ label, minutes, saveCustom }) {
  if (saveCustom) pauseState = addCustomRest(pauseState, label);
  pauseState = startRest(pauseState, label, minutes);
  panelView = null;
  menuOpen = false;
  completionVisible = false;
  render();
}

function handleAddRest(label) {
  pauseState = addCustomRest(pauseState, label);
  render();
}

function handleRemoveRest(label) {
  pauseState = removeCustomRest(pauseState, label);
  render();
}

function getGestureHandlers() {
  gestureController?.destroy();
  gestureController = createOrbGestureController({
    onSingleTap: () => {
      if (!pauseState.active) openPanel('take-rest');
    },
    onDoubleTap: () => {
      if (!pauseState.active) openPanel('take-rest');
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
      if (!pauseState.active) openPanel('take-rest');
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

  const view = document.createElement('section');
  view.className = `screen main-screen pause-main-screen${pauseState.active ? ' is-resting' : ''}`;
  view.appendChild(Brand());

  const stage = document.createElement('div');
  stage.className = 'orb-stage';

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
    ? 'Swipe inside the orb · Tap outside the menu to return'
    : pauseState.active
      ? 'This time is yours · Hold for menu'
      : 'Swipe inside the orb · Tap orb to rest';
  view.appendChild(hint);

  if (panelView) {
    view.appendChild(PausePanel({
      view: panelView,
      state: pauseState,
      onClose: closePanel,
      onStart: handleStartRest,
      onAddRest: handleAddRest,
      onRemoveRest: handleRemoveRest
    }));
  }

  return view;
}

function render() {
  if (screen === 'launch') app.replaceChildren(LaunchScreen());
  else app.replaceChildren(MainScreen());
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
  if (!checkExpired()) render();
}, 1000);

window.__PAUSE__ = {
  getState: () => ({ pauseState, screen, menuOpen, panelView, completionVisible }),
  openMenu: () => { menuOpen = true; render(); },
  takeRest: () => openPanel('take-rest')
};

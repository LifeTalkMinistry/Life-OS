import { Brand } from './components/Brand.js';
import { LifeSetupOrb } from './components/LifeSetupOrb.js';
import { Orb } from './components/Orb.js';
import { OrbArtwork } from './components/OrbArtwork.js';
import { TodayRing } from './components/TodayRing.js';
import { WhyPanel } from './components/WhyPanel.js';
import { createOrbGestureController } from './gestures/orbGestures.js';
import {
  LIFE_PROFILE_STORAGE_KEY,
  createEmptyLifeProfile,
  isLifeProfileComplete,
  normalizeLifeProfile
} from './state/lifeProfile.js';
import {
  addUrgentMatter,
  completeCurrent,
  createInitialLifeState,
  createLifeStateFromProfile,
  currentActivity,
  deferCurrent,
  extendCurrent
} from './state/lifeState.js';

const app = document.querySelector('#app');

function loadLifeProfile() {
  try {
    const raw = localStorage.getItem(LIFE_PROFILE_STORAGE_KEY);
    return raw ? normalizeLifeProfile(JSON.parse(raw)) : createEmptyLifeProfile();
  } catch {
    return createEmptyLifeProfile();
  }
}

function saveLifeProfile(profile) {
  try {
    localStorage.setItem(LIFE_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {}
}

function defaultActivityDays(profile) {
  if (profile.hasFixedSchedule && profile.fixedDays.length) return [...profile.fixedDays];
  return [0, 1, 2, 3, 4, 5, 6];
}

function createActivityDraft(profile) {
  return {
    name: '',
    days: defaultActivityDays(profile),
    start: '',
    end: ''
  };
}

let lifeProfile = loadLifeProfile();
let hasCompletedSetup = isLifeProfileComplete(lifeProfile);
let lifeState = hasCompletedSetup ? createLifeStateFromProfile(lifeProfile) : createInitialLifeState();
let screen = 'launch';
let orbMode = 'now';
let whyOpen = false;
let hintVisible = true;
let setupStep = 'welcome';
let setupHistory = [];
let setupActivityDraft = createActivityDraft(lifeProfile);
let completionTimer = null;
let launchTimer = null;
let setupTimer = null;
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

function goSetup(step) {
  setupHistory.push(setupStep);
  setupStep = step;
  render();
}

function goSetupBack() {
  const previous = setupHistory.pop();
  if (!previous) return;
  setupStep = previous;
  render();
}

function resetActivityDraft() {
  setupActivityDraft = createActivityDraft(lifeProfile);
}

function finishLifeSetup() {
  lifeProfile = normalizeLifeProfile({ ...lifeProfile, setupComplete: true });
  saveLifeProfile(lifeProfile);
  hasCompletedSetup = true;
  lifeState = createLifeStateFromProfile(lifeProfile);
  screen = 'now';
  setupStep = 'welcome';
  setupHistory = [];
  setupActivityDraft = createActivityDraft(lifeProfile);
  orbMode = 'now';
  whyOpen = false;
  hintVisible = true;
  render();
}

function handleSetupField(field, value) {
  if (field.startsWith('draft.')) {
    const draftField = field.slice('draft.'.length);
    if (!['name', 'start', 'end'].includes(draftField)) return;
    setupActivityDraft = { ...setupActivityDraft, [draftField]: value };
    return;
  }

  if (!(field in lifeProfile)) return;
  lifeProfile = { ...lifeProfile, [field]: value };
}

function handleSetupAction(dataset) {
  if (dataset.setupAction === 'begin') return goSetup('fixed');
  if (dataset.setupAction === 'back') return goSetupBack();

  if (dataset.setupFixed) {
    const hasFixedSchedule = dataset.setupFixed === 'yes';
    lifeProfile = {
      ...lifeProfile,
      hasFixedSchedule,
      fixedGuidanceMode: 'outside'
    };
    return goSetup(hasFixedSchedule ? 'fixed-kind' : 'sleep');
  }

  if (dataset.setupKind) {
    lifeProfile = { ...lifeProfile, fixedKind: dataset.setupKind };
    return goSetup('fixed-days');
  }

  if (dataset.setupDays) {
    if (dataset.setupDays === 'weekdays') {
      lifeProfile = { ...lifeProfile, fixedDays: [1, 2, 3, 4, 5] };
      return goSetup('fixed-time');
    }
    if (dataset.setupDays === 'everyday') {
      lifeProfile = { ...lifeProfile, fixedDays: [0, 1, 2, 3, 4, 5, 6] };
      return goSetup('fixed-time');
    }
    return goSetup('custom-days');
  }

  if (dataset.setupDay !== undefined) {
    const day = Number(dataset.setupDay);
    const nextDays = lifeProfile.fixedDays.includes(day)
      ? lifeProfile.fixedDays.filter((item) => item !== day)
      : [...lifeProfile.fixedDays, day];
    lifeProfile = { ...lifeProfile, fixedDays: nextDays };
    return render();
  }

  if (dataset.setupAction === 'days-continue') {
    if (!lifeProfile.fixedDays.length) return;
    return goSetup('fixed-time');
  }

  if (dataset.setupAction === 'fixed-time-continue') {
    if (!lifeProfile.fixedStart || !lifeProfile.fixedEnd) return;
    return goSetup('sleep');
  }

  if (dataset.setupAction === 'sleep-continue') {
    if (!lifeProfile.sleepStart || !lifeProfile.sleepEnd) return;
    resetActivityDraft();
    return goSetup(lifeProfile.hasFixedSchedule ? 'fixed-scope' : 'activities');
  }

  if (dataset.setupScope) {
    lifeProfile = {
      ...lifeProfile,
      fixedGuidanceMode: dataset.setupScope === 'breakdown' ? 'breakdown' : 'outside'
    };
    resetActivityDraft();
    return goSetup('activities');
  }

  if (dataset.setupActivityDay !== undefined) {
    const day = Number(dataset.setupActivityDay);
    const days = setupActivityDraft.days.includes(day)
      ? setupActivityDraft.days.filter((item) => item !== day)
      : [...setupActivityDraft.days, day];
    setupActivityDraft = { ...setupActivityDraft, days };
    return render();
  }

  if (dataset.setupAction === 'activity-add') {
    const name = setupActivityDraft.name.trim();
    const { days, start, end } = setupActivityDraft;
    if (!name || !days.length || !start || !end || start === end) return;

    const activity = {
      id: `activity-${Date.now()}-${lifeProfile.activities.length + 1}`,
      name: name.slice(0, 48),
      days: [...days],
      start,
      end
    };
    lifeProfile = { ...lifeProfile, activities: [...lifeProfile.activities, activity] };
    resetActivityDraft();
    return render();
  }

  if (dataset.setupRemoveActivity) {
    lifeProfile = {
      ...lifeProfile,
      activities: lifeProfile.activities.filter((activity) => activity.id !== dataset.setupRemoveActivity)
    };
    return render();
  }

  if (dataset.setupAction === 'activities-continue') {
    if (!lifeProfile.activities.length) return;
    return goSetup('review');
  }

  if (dataset.setupAction === 'review-edit') {
    if (setupHistory.at(-1) === 'activities') setupHistory.pop();
    setupStep = 'activities';
    return render();
  }

  if (dataset.setupAction === 'review-confirm') {
    if (!lifeProfile.activities.length) return;
    setupHistory.push(setupStep);
    setupStep = 'ready';
    render();
    clearTimeout(setupTimer);
    setupTimer = setTimeout(finishLifeSetup, 900);
  }
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
  view.querySelector('.launch-orb')?.prepend(OrbArtwork());
  return view;
}

function SetupScreen() {
  const view = document.createElement('section');
  view.className = 'screen main-screen setup-screen';
  view.appendChild(Brand());

  const stage = document.createElement('div');
  stage.className = 'orb-stage setup-stage';
  stage.appendChild(LifeSetupOrb({
    step: setupStep,
    profile: lifeProfile,
    activityDraft: setupActivityDraft,
    onAction: handleSetupAction,
    onField: handleSetupField
  }));
  view.appendChild(stage);

  const hint = document.createElement('p');
  hint.className = 'gesture-hint setup-bottom-hint';
  hint.textContent = setupStep === 'welcome' ? 'Your life. Your reality. Your direction.' : '';
  view.appendChild(hint);
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
  if (screen === 'launch') return app.replaceChildren(LaunchScreen());
  if (screen === 'setup') return app.replaceChildren(SetupScreen());
  return app.replaceChildren(MainScreen());
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    if (screen === 'setup' && setupHistory.length) return goSetupBack();
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
  screen = hasCompletedSetup ? 'now' : 'setup';
  render();
}, 1800);

window.__LIFE_OS__ = {
  getState: () => ({ screen, orbMode, whyOpen, lifeState, lifeProfile, setupStep, setupActivityDraft }),
  reset: () => {
    clearTimeout(completionTimer);
    clearTimeout(launchTimer);
    clearTimeout(setupTimer);
    lifeState = createInitialLifeState();
    screen = 'now';
    orbMode = 'now';
    whyOpen = false;
    hintVisible = true;
    render();
  },
  resetOnboarding: () => {
    clearTimeout(completionTimer);
    clearTimeout(launchTimer);
    clearTimeout(setupTimer);
    try { localStorage.removeItem(LIFE_PROFILE_STORAGE_KEY); } catch {}
    lifeProfile = createEmptyLifeProfile();
    hasCompletedSetup = false;
    lifeState = createInitialLifeState();
    screen = 'setup';
    setupStep = 'welcome';
    setupHistory = [];
    setupActivityDraft = createActivityDraft(lifeProfile);
    orbMode = 'now';
    whyOpen = false;
    hintVisible = true;
    render();
  }
};

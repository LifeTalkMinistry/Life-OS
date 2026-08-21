import { Brand } from './components/Brand.js';
import { LifeSetupOrb } from './components/LifeSetupOrb.js';
import { Orb } from './components/Orb.js';
import { OrbArtwork } from './components/OrbArtwork.js';
import { SystemPanel } from './components/SystemPanel.js';
import { TodayRing } from './components/TodayRing.js';
import { WhyPanel } from './components/WhyPanel.js';
import { createOrbGestureController } from './gestures/orbGestures.js';
import {
  LIFE_PROFILE_STORAGE_KEY,
  createEmptyLifeProfile,
  findTimeConflict,
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
const ACTIVITY_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const ANCHOR_PRE_FIXED = 'anchor-pre-fixed';
const ANCHOR_PRE_SLEEP = 'anchor-pre-sleep';
const ANCHOR_HOME = 'anchor-home-arrival';
const ANCHOR_IDS = new Set([ANCHOR_PRE_FIXED, ANCHOR_PRE_SLEEP, ANCHOR_HOME]);

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

function createActivityDraft(start = '') {
  return {
    name: '',
    icon: 'general',
    start,
    end: ''
  };
}

function isAnchorActivity(activity) {
  return ANCHOR_IDS.has(activity?.id);
}

function anchorActivity(profile, id) {
  return profile.activities.find((activity) => activity.id === id) ?? null;
}

function fixedSubject(kind) {
  if (kind === 'school') return 'school';
  if (kind === 'both') return 'work / school';
  return 'work';
}

function upsertAnchorActivity(id, name, days, start, end, icon = 'routine') {
  const anchor = {
    id,
    name,
    icon,
    days: [...days],
    start,
    end
  };
  lifeProfile = {
    ...lifeProfile,
    activities: [...lifeProfile.activities.filter((activity) => activity.id !== id), anchor]
  };
}

function activityCursorForDay(day) {
  const home = anchorActivity(lifeProfile, ANCHOR_HOME);
  const fixedDay = lifeProfile.hasFixedSchedule && lifeProfile.fixedDays.includes(day);
  let cursor = fixedDay && home?.end ? home.end : lifeProfile.sleepEnd;

  const custom = lifeProfile.activities
    .filter((activity) => !isAnchorActivity(activity) && activity.days.includes(day))
    .sort((a, b) => a.start.localeCompare(b.start));

  let changed = true;
  while (changed) {
    changed = false;
    const next = custom.find((activity) => activity.start === cursor);
    if (next) {
      cursor = next.end;
      changed = true;
    }
  }
  return cursor;
}

let lifeProfile = loadLifeProfile();
let hasCompletedSetup = isLifeProfileComplete(lifeProfile);
let lifeState = hasCompletedSetup ? createLifeStateFromProfile(lifeProfile) : createInitialLifeState();
let screen = 'launch';
let orbMode = 'now';
let whyOpen = false;
let systemView = null;
let hintVisible = true;
let setupStep = 'welcome';
let setupHistory = [];
let setupActivityDay = 1;
let setupActivityCursor = '';
let setupActivityDraft = createActivityDraft();
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
  systemView = null;
  whyOpen = true;
  render();
}

function closeWhy() {
  whyOpen = false;
  render();
}

function openSystemView(view) {
  hideHint();
  whyOpen = false;
  orbMode = 'now';
  systemView = view;
  render();
}

function closeSystemView() {
  systemView = null;
  render();
}

function navigateSystemView(view) {
  systemView = view;
  render();
}

function saveActivityTimes(changes) {
  lifeProfile = normalizeLifeProfile({
    ...lifeProfile,
    ...changes,
    setupComplete: true
  });
  saveLifeProfile(lifeProfile);
  hasCompletedSetup = isLifeProfileComplete(lifeProfile);
  lifeState = createLifeStateFromProfile(lifeProfile);
  systemView = 'settings';
  orbMode = 'now';
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

function resetActivityDraft(start = '') {
  setupActivityDraft = createActivityDraft(start);
}

function setActivityDay(day) {
  setupActivityDay = day;
  setupActivityCursor = activityCursorForDay(day);
  resetActivityDraft(setupActivityCursor);
}

function startActivityBuilder() {
  setActivityDay(1);
  goSetup('activities');
}

function nextActivityDay() {
  const index = ACTIVITY_DAY_ORDER.indexOf(setupActivityDay);
  if (index < 0 || index === ACTIVITY_DAY_ORDER.length - 1) return null;
  return ACTIVITY_DAY_ORDER[index + 1];
}

function previousActivityDay() {
  const index = ACTIVITY_DAY_ORDER.indexOf(setupActivityDay);
  if (index <= 0) return null;
  return ACTIVITY_DAY_ORDER[index - 1];
}

function finishLifeSetup() {
  lifeProfile = normalizeLifeProfile({ ...lifeProfile, setupComplete: true });
  saveLifeProfile(lifeProfile);
  hasCompletedSetup = true;
  lifeState = createLifeStateFromProfile(lifeProfile);
  screen = 'now';
  setupStep = 'welcome';
  setupHistory = [];
  setupActivityDay = 1;
  setupActivityCursor = '';
  setupActivityDraft = createActivityDraft();
  orbMode = 'now';
  whyOpen = false;
  systemView = null;
  hintVisible = true;
  render();
}

function resetLifeSetup() {
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
  setupActivityDay = 1;
  setupActivityCursor = '';
  setupActivityDraft = createActivityDraft();
  orbMode = 'now';
  whyOpen = false;
  systemView = null;
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
    return lifeProfile.hasFixedSchedule ? goSetup('fixed-scope') : startActivityBuilder();
  }

  if (dataset.setupScope) {
    lifeProfile = {
      ...lifeProfile,
      fixedGuidanceMode: dataset.setupScope === 'breakdown' ? 'breakdown' : 'outside'
    };
    resetActivityDraft();
    return goSetup('pre-fixed');
  }

  if (dataset.setupAction === 'pre-fixed-continue') {
    const start = setupActivityDraft.start;
    if (!start || start === lifeProfile.fixedStart) return;
    const subject = fixedSubject(lifeProfile.fixedKind);
    upsertAnchorActivity(
      ANCHOR_PRE_FIXED,
      `Prepare for ${subject}`,
      lifeProfile.fixedDays,
      start,
      lifeProfile.fixedStart,
      'routine'
    );
    resetActivityDraft();
    return goSetup('pre-sleep');
  }

  if (dataset.setupAction === 'pre-sleep-continue') {
    const start = setupActivityDraft.start;
    if (!start || start === lifeProfile.sleepStart) return;
    upsertAnchorActivity(
      ANCHOR_PRE_SLEEP,
      'Prepare for sleep',
      ALL_DAYS,
      start,
      lifeProfile.sleepStart,
      'routine'
    );
    resetActivityDraft();
    return goSetup('home-arrival');
  }

  if (dataset.setupAction === 'home-arrival-continue') {
    const end = setupActivityDraft.start;
    if (!end || end === lifeProfile.fixedEnd) return;
    upsertAnchorActivity(
      ANCHOR_HOME,
      'Travel home',
      lifeProfile.fixedDays,
      lifeProfile.fixedEnd,
      end,
      'routine'
    );
    return startActivityBuilder();
  }

  if (dataset.setupActivityIcon) {
    setupActivityDraft = { ...setupActivityDraft, icon: dataset.setupActivityIcon };
    return render();
  }

  if (dataset.setupAction === 'activity-name-continue') {
    const name = setupActivityDraft.name.trim();
    if (!name || !setupActivityDraft.start) return;
    return goSetup('activity-end');
  }

  if (dataset.setupAction === 'activity-add') {
    const name = setupActivityDraft.name.trim();
    const { icon, start, end } = setupActivityDraft;
    if (!name || !start || !end || start === end) return;

    const conflict = findTimeConflict(lifeProfile, setupActivityDay, start, end);
    if (conflict) return;

    const activity = {
      id: `activity-${Date.now()}-${lifeProfile.activities.length + 1}`,
      name: name.slice(0, 48),
      icon: icon || 'general',
      days: [setupActivityDay],
      start,
      end
    };
    lifeProfile = { ...lifeProfile, activities: [...lifeProfile.activities, activity] };
    setupActivityCursor = end;
    if (setupHistory[setupHistory.length - 1] === 'activities') setupHistory.pop();
    setupStep = 'activities';
    resetActivityDraft(setupActivityCursor);
    return render();
  }

  if (dataset.setupRemoveActivity) {
    if (ANCHOR_IDS.has(dataset.setupRemoveActivity)) return;
    lifeProfile = {
      ...lifeProfile,
      activities: lifeProfile.activities.filter((activity) => activity.id !== dataset.setupRemoveActivity)
    };
    setupActivityCursor = activityCursorForDay(setupActivityDay);
    resetActivityDraft(setupActivityCursor);
    return render();
  }

  if (dataset.setupAction === 'activity-day-next') {
    const nextDay = nextActivityDay();
    if (nextDay !== null) {
      setActivityDay(nextDay);
      return render();
    }
    return goSetup('review');
  }

  if (dataset.setupAction === 'activity-day-back') {
    const previousDay = previousActivityDay();
    if (previousDay !== null) {
      setActivityDay(previousDay);
      return render();
    }
    resetActivityDraft();
    return goSetupBack();
  }

  if (dataset.setupAction === 'review-edit') {
    setupHistory.push(setupStep);
    setupStep = 'activities';
    setActivityDay(1);
    return render();
  }

  if (dataset.setupAction === 'review-confirm') {
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
      systemView = null;
      orbMode = 'adjust';
      render();
    },
    onHoldStart: () => {
      hideHint();
      whyOpen = false;
      systemView = null;
      orbMode = 'today';
      render();
    },
    onHoldEnd: () => {}
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
    activityDay: setupActivityDay,
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
    stage.appendChild(TodayRing(lifeState.activities, activity.id, openSystemView));
  }

  const orbShell = Orb({
    activity,
    mode: orbMode,
    gestureHandlers: orbMode === 'now' ? getGestureController() : null,
    onAction: handleAdjustment
  });

  if (orbMode === 'today') {
    const orb = orbShell.querySelector('.orb');
    orb?.setAttribute('tabindex', '0');
    orb?.setAttribute('aria-label', 'Current activity. Tap to close today view.');
    orb?.addEventListener('click', () => {
      orbMode = 'now';
      render();
    });
    orb?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        orbMode = 'now';
        render();
      }
    });
  }

  stage.appendChild(orbShell);
  view.appendChild(stage);

  const hint = document.createElement('p');
  hint.className = `gesture-hint${hintVisible && orbMode === 'now' ? ' is-visible' : ''}`;
  hint.textContent = orbMode === 'today'
    ? 'Settings + Info above 12:00 · Tap orb to return'
    : 'Tap for why · Hold for today · Double tap to adjust';
  view.appendChild(hint);

  if (whyOpen) {
    view.appendChild(WhyPanel(activity, closeWhy));
  }

  if (systemView) {
    view.appendChild(SystemPanel({
      view: systemView,
      profile: lifeProfile,
      onClose: closeSystemView,
      onNavigate: navigateSystemView,
      onSaveTimes: saveActivityTimes,
      onReset: resetLifeSetup
    }));
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
    if (systemView) return closeSystemView();
    if (screen === 'setup' && setupStep === 'activities') {
      return handleSetupAction({ setupAction: 'activity-day-back' });
    }
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
  getState: () => ({
    screen,
    orbMode,
    whyOpen,
    systemView,
    lifeState,
    lifeProfile,
    setupStep,
    setupActivityDay,
    setupActivityCursor,
    setupActivityDraft
  }),
  reset: () => {
    clearTimeout(completionTimer);
    clearTimeout(launchTimer);
    clearTimeout(setupTimer);
    lifeState = createInitialLifeState();
    screen = 'now';
    orbMode = 'now';
    whyOpen = false;
    systemView = null;
    hintVisible = true;
    render();
  },
  resetOnboarding: resetLifeSetup
};

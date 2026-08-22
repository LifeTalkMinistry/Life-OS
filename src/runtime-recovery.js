/* LIFE OS onboarding controller.
 *
 * Reconstructed as one deterministic flow: optional entry -> setup -> review ->
 * persist -> build live state -> MainScreen. No second completion timer, no
 * competing click interceptor, and no requirement to map every open hour.
 */
(() => {
  const DEFERRED_SETUP_KEY = 'life-os-v1-setup-deferred';
  const ONBOARDING_DRAFT_KEY = 'life-os-v1-onboarding-draft';
  const baseLifeSetupOrb = LifeSetupOrb;
  const baseHandleSetupField = handleSetupField;

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function storageRemove(key) {
    try { localStorage.removeItem(key); } catch {}
  }

  // A valid LIFE OS setup does not require every gap—or even a custom activity—
  // to be mapped. OPEN TIME is a valid live result.
  isLifeProfileComplete = function reconstructedProfileComplete(rawProfile) {
    const profile = normalizeLifeProfile(rawProfile);
    const fixedReady = profile.hasFixedSchedule === false
      || (profile.hasFixedSchedule === true
        && profile.fixedDays.length > 0
        && Boolean(profile.fixedStart)
        && Boolean(profile.fixedEnd));

    return profile.setupComplete === true
      && fixedReady
      && Boolean(profile.sleepStart)
      && Boolean(profile.sleepEnd);
  };

  function createOpenOnlyState(profile = createEmptyLifeProfile()) {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const start = format24(minutes);
    const end = format24(minutes + 60);
    const open = {
      id: 'open-time',
      title: 'OPEN TIME',
      shortTitle: 'Open Time',
      start,
      end,
      timeLabel: clockShort(start),
      objective: profile.setupComplete
        ? 'No activity is assigned to this block.'
        : 'LIFE OS is not set up yet.',
      why: profile.setupComplete
        ? 'Your Life Map has no scheduled activity for this time.'
        : 'Set up your Life Map when you are ready for schedule-aware guidance.',
      recommendedMinutes: 60,
      kind: 'open'
    };

    return {
      activities: [open],
      currentId: open.id,
      urgentResumeId: null,
      history: [],
      profile
    };
  }

  function resetSetupRuntime() {
    clearTimeout(setupTimer);
    setupStep = 'welcome';
    setupHistory = [];
    setupActivityDay = 1;
    setupActivityCursor = '';
    setupActivityDraft = createActivityDraft();
    orbMode = 'now';
    whyOpen = false;
    systemView = null;
    hintVisible = true;
  }

  function checkpointDraft() {
    const draft = {
      profile: normalizeLifeProfile({ ...lifeProfile, setupComplete: false }),
      step: setupStep,
      history: [...setupHistory],
      activityDay: setupActivityDay,
      activityCursor: setupActivityCursor,
      activityDraft: { ...setupActivityDraft }
    };
    storageSet(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
  }

  function startFreshSetup() {
    storageRemove(DEFERRED_SETUP_KEY);
    storageRemove(ONBOARDING_DRAFT_KEY);
    clearTimeout(setupTimer);
    lifeProfile = createEmptyLifeProfile();
    hasCompletedSetup = false;
    lifeState = createInitialLifeState();
    screen = 'setup';
    setupStep = 'fixed';
    setupHistory = ['welcome'];
    setupActivityDay = 1;
    setupActivityCursor = '';
    setupActivityDraft = createActivityDraft();
    orbMode = 'now';
    whyOpen = false;
    systemView = null;
    hintVisible = true;
    checkpointDraft();
    render();
  }

  function openWithoutSetup() {
    storageSet(DEFERRED_SETUP_KEY, 'true');
    storageRemove(ONBOARDING_DRAFT_KEY);
    hasCompletedSetup = false;
    lifeProfile = createEmptyLifeProfile();
    lifeState = createOpenOnlyState(lifeProfile);
    screen = 'now';
    resetSetupRuntime();
    render();
  }

  function readBackCompletedProfile() {
    try {
      const raw = localStorage.getItem(LIFE_PROFILE_STORAGE_KEY);
      if (!raw) return null;
      const profile = normalizeLifeProfile(JSON.parse(raw));
      return isLifeProfileComplete(profile) ? profile : null;
    } catch {
      return null;
    }
  }

  finishLifeSetup = function reconstructedFinishLifeSetup() {
    clearTimeout(setupTimer);

    const completed = normalizeLifeProfile({ ...lifeProfile, setupComplete: true });
    if (!isLifeProfileComplete(completed)) {
      setupStep = 'review';
      render();
      return false;
    }

    // Build the state before navigation. If state construction ever fails, the
    // user remains in onboarding rather than being sent to a blank MainScreen.
    let nextState;
    try {
      nextState = createLifeStateFromProfile(completed);
      if (!currentActivity(nextState)) nextState = createOpenOnlyState(completed);
    } catch (error) {
      console.error('LIFE OS onboarding state build failed', error);
      setupStep = 'review';
      render();
      return false;
    }

    if (!storageSet(LIFE_PROFILE_STORAGE_KEY, JSON.stringify(completed))) {
      console.error('LIFE OS onboarding profile could not be persisted');
      setupStep = 'review';
      render();
      return false;
    }

    const persisted = readBackCompletedProfile();
    if (!persisted) {
      console.error('LIFE OS onboarding profile failed read-back verification');
      setupStep = 'review';
      render();
      return false;
    }

    storageRemove(DEFERRED_SETUP_KEY);
    storageRemove(ONBOARDING_DRAFT_KEY);
    lifeProfile = persisted;
    hasCompletedSetup = true;
    lifeState = nextState;
    screen = 'now';
    resetSetupRuntime();
    render();
    return true;
  };

  handleSetupField = function reconstructedHandleSetupField(field, value) {
    baseHandleSetupField(field, value);
    if (screen === 'setup') checkpointDraft();
  };

  handleSetupAction = function reconstructedHandleSetupAction(dataset) {
    if (dataset.setupAction === 'begin') return startFreshSetup();
    if (dataset.setupAction === 'back') {
      goSetupBack();
      checkpointDraft();
      return;
    }

    if (dataset.setupFixed) {
      const hasFixedSchedule = dataset.setupFixed === 'yes';
      lifeProfile = {
        ...lifeProfile,
        hasFixedSchedule,
        fixedGuidanceMode: 'outside'
      };
      goSetup(hasFixedSchedule ? 'fixed-kind' : 'sleep');
      checkpointDraft();
      return;
    }

    if (dataset.setupKind) {
      lifeProfile = { ...lifeProfile, fixedKind: dataset.setupKind };
      goSetup('fixed-days');
      checkpointDraft();
      return;
    }

    if (dataset.setupDays) {
      if (dataset.setupDays === 'weekdays') {
        lifeProfile = { ...lifeProfile, fixedDays: [1, 2, 3, 4, 5] };
        goSetup('fixed-time');
      } else if (dataset.setupDays === 'everyday') {
        lifeProfile = { ...lifeProfile, fixedDays: [0, 1, 2, 3, 4, 5, 6] };
        goSetup('fixed-time');
      } else {
        goSetup('custom-days');
      }
      checkpointDraft();
      return;
    }

    if (dataset.setupDay !== undefined) {
      const day = Number(dataset.setupDay);
      const nextDays = lifeProfile.fixedDays.includes(day)
        ? lifeProfile.fixedDays.filter((item) => item !== day)
        : [...lifeProfile.fixedDays, day];
      lifeProfile = { ...lifeProfile, fixedDays: nextDays };
      checkpointDraft();
      render();
      return;
    }

    if (dataset.setupAction === 'days-continue') {
      if (!lifeProfile.fixedDays.length) return;
      goSetup('fixed-time');
      checkpointDraft();
      return;
    }

    if (dataset.setupAction === 'fixed-time-continue') {
      if (!lifeProfile.fixedStart || !lifeProfile.fixedEnd || lifeProfile.fixedStart === lifeProfile.fixedEnd) return;
      goSetup('sleep');
      checkpointDraft();
      return;
    }

    if (dataset.setupAction === 'sleep-continue') {
      if (!lifeProfile.sleepStart || !lifeProfile.sleepEnd || lifeProfile.sleepStart === lifeProfile.sleepEnd) return;
      if (lifeProfile.hasFixedSchedule) goSetup('fixed-scope');
      else startActivityBuilder();
      checkpointDraft();
      return;
    }

    if (dataset.setupScope) {
      lifeProfile = {
        ...lifeProfile,
        fixedGuidanceMode: dataset.setupScope === 'breakdown' ? 'breakdown' : 'outside'
      };
      resetActivityDraft();
      goSetup('pre-fixed');
      checkpointDraft();
      return;
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
      goSetup('pre-sleep');
      checkpointDraft();
      return;
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
      goSetup('home-arrival');
      checkpointDraft();
      return;
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
      startActivityBuilder();
      checkpointDraft();
      return;
    }

    if (dataset.setupActivityIcon) {
      setupActivityDraft = { ...setupActivityDraft, icon: dataset.setupActivityIcon };
      checkpointDraft();
      render();
      return;
    }

    if (dataset.setupAction === 'activity-name-continue') {
      const name = setupActivityDraft.name.trim();
      if (!name || !setupActivityDraft.start) return;
      goSetup('activity-end');
      checkpointDraft();
      return;
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
      checkpointDraft();
      render();
      return;
    }

    if (dataset.setupRemoveActivity) {
      if (ANCHOR_IDS.has(dataset.setupRemoveActivity)) return;
      lifeProfile = {
        ...lifeProfile,
        activities: lifeProfile.activities.filter((activity) => activity.id !== dataset.setupRemoveActivity)
      };
      setupActivityCursor = activityCursorForDay(setupActivityDay);
      resetActivityDraft(setupActivityCursor);
      checkpointDraft();
      render();
      return;
    }

    if (dataset.setupAction === 'activity-day-next') {
      const nextDay = nextActivityDay();
      if (nextDay !== null) {
        setActivityDay(nextDay);
        checkpointDraft();
        render();
      } else {
        goSetup('review');
        checkpointDraft();
      }
      return;
    }

    if (dataset.setupAction === 'activity-day-back') {
      const previousDay = previousActivityDay();
      if (previousDay !== null) {
        setActivityDay(previousDay);
        checkpointDraft();
        render();
      } else {
        resetActivityDraft();
        goSetupBack();
        checkpointDraft();
      }
      return;
    }

    if (dataset.setupAction === 'review-edit') {
      setupHistory.push(setupStep);
      setupStep = 'activities';
      setActivityDay(1);
      checkpointDraft();
      render();
      return;
    }

    if (dataset.setupAction === 'review-confirm') {
      // No intermediate timer. Completion is atomic: validate, persist, build,
      // then switch to MainScreen in the same authoritative action.
      return finishLifeSetup();
    }
  };

  LifeSetupOrb = function reconstructedEntryOrb(args) {
    if (args.step !== 'welcome') return baseLifeSetupOrb(args);

    const shell = baseLifeSetupOrb(args);
    const originalOrb = shell.querySelector('.setup-orb');
    if (!originalOrb) return shell;

    const orb = originalOrb.cloneNode(false);
    orb.removeAttribute('role');
    orb.removeAttribute('tabindex');
    orb.removeAttribute('aria-label');
    orb.innerHTML = `
      <div class="orb-content setup-content setup-welcome-content">
        <p class="setup-eyebrow">LIFE OS</p>
        <h1 class="setup-hero">READY TO<br>TAKE CONTROL?</h1>
        <div class="setup-options setup-options-compact">
          <button type="button" data-entry-action="setup-now">Set up LIFE OS</button>
          <button type="button" data-entry-action="later">Do it later</button>
        </div>
      </div>
    `;

    orb.querySelector('[data-entry-action="setup-now"]')?.addEventListener('click', startFreshSetup);
    orb.querySelector('[data-entry-action="later"]')?.addEventListener('click', openWithoutSetup);
    originalOrb.replaceWith(orb);
    return shell;
  };

  // If the user previously chose "Do it later", stay in the usable Open Time
  // MainScreen until they intentionally start Life Setup.
  const deferred = storageGet(DEFERRED_SETUP_KEY) === 'true';
  if (!hasCompletedSetup && deferred) {
    clearTimeout(launchTimer);
    openWithoutSetup();
  }
})();

/* Atomic onboarding -> live Orb handoff.
 *
 * This file is intentionally the final production runtime guard. Finishing
 * setup must persist the profile, rebuild the current live state, and render
 * RUNNING NOW without requiring a browser refresh.
 */
(() => {
  const canReachAppScope =
    typeof handleSetupAction === 'function'
    && typeof normalizeLifeProfile === 'function'
    && typeof isLifeProfileComplete === 'function'
    && typeof createLifeStateFromProfile === 'function'
    && typeof saveLifeProfile === 'function'
    && typeof createActivityDraft === 'function'
    && typeof render === 'function';

  if (!canReachAppScope) return;

  function readPersistedCompletedProfile() {
    try {
      const raw = localStorage.getItem(LIFE_PROFILE_STORAGE_KEY);
      if (!raw) return null;
      const profile = normalizeLifeProfile(JSON.parse(raw));
      return isLifeProfileComplete(profile) ? profile : null;
    } catch {
      return null;
    }
  }

  function resetLiveUiState() {
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
  }

  function openLiveFromProfile(profile) {
    lifeProfile = normalizeLifeProfile(profile);
    hasCompletedSetup = isLifeProfileComplete(lifeProfile);
    if (!hasCompletedSetup) return false;

    lifeState = createLifeStateFromProfile(lifeProfile);
    resetLiveUiState();
    render();
    return true;
  }

  function verifyLiveOrb() {
    const liveOrbVisible =
      screen === 'now'
      && Boolean(document.querySelector('.main-screen .orb-now-content'));

    if (liveOrbVisible) return;

    /* The profile is already durable at this point. If a render/state race left
     * the decorative sphere on screen, recover from the exact saved profile in
     * memory instead of making the user refresh the browser. */
    const persisted = readPersistedCompletedProfile();
    if (persisted) openLiveFromProfile(persisted);
  }

  function scheduleLiveVerification() {
    if (typeof queueMicrotask === 'function') queueMicrotask(verifyLiveOrb);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(verifyLiveOrb));
    }
    setTimeout(verifyLiveOrb, 80);
  }

  function completeSetupAndOpenLiveOrb() {
    clearTimeout(setupTimer);
    clearTimeout(launchTimer);

    lifeProfile = normalizeLifeProfile({
      ...lifeProfile,
      setupComplete: true
    });

    /* Persist before rendering. A refresh at any point after this line must
     * resolve to the exact same completed profile. */
    saveLifeProfile(lifeProfile);
    hasCompletedSetup = isLifeProfileComplete(lifeProfile);

    if (!hasCompletedSetup) {
      screen = 'setup';
      setupStep = 'review';
      render();
      return;
    }

    /* Schedule the verifier before the first live render so even an unexpected
     * first-render race can recover on the next frame. */
    scheduleLiveVerification();
    openLiveFromProfile(lifeProfile);
  }

  const originalSetupActionForCompletion = handleSetupAction;
  handleSetupAction = function guardedSetupAction(dataset = {}) {
    if (dataset.setupAction === 'review-confirm') {
      completeSetupAndOpenLiveOrb();
      return;
    }
    return originalSetupActionForCompletion(dataset);
  };

  /* Capture the final confirmation before component listeners. This removes
   * the old intermediate READY/timer state from the production handoff. */
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element
      ? event.target.closest('[data-setup-action="review-confirm"]')
      : null;
    if (!target || screen !== 'setup') return;

    event.preventDefault();
    event.stopImmediatePropagation();
    completeSetupAndOpenLiveOrb();
  }, true);

  /* Completed users should also never remain on the decorative launch sphere. */
  const persistedOnBoot = readPersistedCompletedProfile();
  if (persistedOnBoot && screen === 'launch') {
    clearTimeout(launchTimer);
    openLiveFromProfile(persistedOnBoot);
    scheduleLiveVerification();
  }
})();

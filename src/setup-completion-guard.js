/* Atomic onboarding -> live Orb handoff.
 *
 * GitHub Pages builds LIFE OS as one ordered script, so this file runs after
 * app.js and can harden the final transition. The final confirmation must do
 * three things together: persist setupComplete, build the real live state,
 * and render the interactive Orb. There is intentionally no intermediate
 * artwork-only/ready state here.
 */
(() => {
  const canReachAppScope =
    typeof handleSetupAction === 'function'
    && typeof normalizeLifeProfile === 'function'
    && typeof isLifeProfileComplete === 'function'
    && typeof createLifeStateFromProfile === 'function'
    && typeof saveLifeProfile === 'function'
    && typeof render === 'function';

  if (!canReachAppScope) return;

  function completeSetupAndOpenLiveOrb() {
    clearTimeout(setupTimer);
    clearTimeout(launchTimer);

    lifeProfile = normalizeLifeProfile({
      ...lifeProfile,
      setupComplete: true
    });

    // Persist first. A refresh after this exact point must stay out of onboarding.
    saveLifeProfile(lifeProfile);
    hasCompletedSetup = isLifeProfileComplete(lifeProfile);

    if (!hasCompletedSetup) {
      // Do not leave the user on a blank transition state if required fixed/sleep
      // data is somehow incomplete. Return to review where they can edit it.
      screen = 'setup';
      setupStep = 'review';
      render();
      return;
    }

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

  const originalSetupActionForCompletion = handleSetupAction;
  handleSetupAction = function guardedSetupAction(dataset = {}) {
    if (dataset.setupAction === 'review-confirm') {
      completeSetupAndOpenLiveOrb();
      return;
    }
    return originalSetupActionForCompletion(dataset);
  };

  // Capture the final button before component listeners. This makes completion
  // independent from any future refactor of LifeSetupOrb's button wiring.
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element
      ? event.target.closest('[data-setup-action="review-confirm"]')
      : null;
    if (!target || screen !== 'setup') return;

    event.preventDefault();
    event.stopImmediatePropagation();
    completeSetupAndOpenLiveOrb();
  }, true);

  // Returning completed users must never pause on the decorative launch Orb.
  if (hasCompletedSetup && screen === 'launch') {
    clearTimeout(launchTimer);
    lifeState = createLifeStateFromProfile(lifeProfile);
    screen = 'now';
    orbMode = 'now';
    whyOpen = false;
    systemView = null;
    hintVisible = true;
    render();
  }
})();

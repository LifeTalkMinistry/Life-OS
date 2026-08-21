/* Completion handoff guard.
 * The production build concatenates this after app.js, so it can harden the
 * onboarding -> live Orb transition without adding another visual state.
 * In unbundled/module development these app-scope bindings are unavailable;
 * the typeof guards make this file a harmless no-op there.
 */
(() => {
  const canReachAppScope =
    typeof handleSetupAction === 'function'
    && typeof finishLifeSetup === 'function'
    && typeof render === 'function';

  if (!canReachAppScope) return;

  const originalSetupActionForCompletion = handleSetupAction;

  handleSetupAction = function guardedSetupAction(dataset = {}) {
    if (dataset.setupAction === 'review-confirm') {
      clearTimeout(setupTimer);
      finishLifeSetup();
      return;
    }

    return originalSetupActionForCompletion(dataset);
  };

  /* A completed profile should never sit on the non-interactive launch Orb.
   * Returning users go straight to RUNNING NOW with gestures attached. */
  if (hasCompletedSetup && screen === 'launch') {
    clearTimeout(launchTimer);
    screen = 'now';
    orbMode = 'now';
    whyOpen = false;
    systemView = null;
    hintVisible = true;
    render();
  }
})();

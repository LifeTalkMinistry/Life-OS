/* Optional setup entry + deferred setup routing.
 *
 * LIFE OS should be usable before a Life Map exists. This layer only handles
 * the entry decision; completed onboarding still uses the single authoritative
 * finishLifeSetup() path in app.js.
 */
(() => {
  const DEFERRED_SETUP_KEY = 'life-os-v1-setup-deferred';
  const baseLifeSetupOrb = LifeSetupOrb;
  const baseFinishLifeSetup = finishLifeSetup;

  function createOpenOnlyState() {
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
      objective: 'LIFE OS is not set up yet.',
      why: 'Set up your Life Map when you are ready for schedule-aware guidance.',
      recommendedMinutes: 60,
      kind: 'open'
    };

    return {
      activities: [open],
      currentId: open.id,
      urgentResumeId: null,
      history: [],
      profile: createEmptyLifeProfile()
    };
  }

  function openWithoutSetup() {
    try { localStorage.setItem(DEFERRED_SETUP_KEY, 'true'); } catch {}
    hasCompletedSetup = false;
    lifeProfile = createEmptyLifeProfile();
    lifeState = createOpenOnlyState();
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

  function beginSetup(onAction) {
    try { localStorage.removeItem(DEFERRED_SETUP_KEY); } catch {}
    onAction?.({ setupAction: 'begin' });
  }

  LifeSetupOrb = function optionalSetupLifeSetupOrb(args) {
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

    orb.querySelector('[data-entry-action="setup-now"]')?.addEventListener('click', () => beginSetup(args.onAction));
    orb.querySelector('[data-entry-action="later"]')?.addEventListener('click', openWithoutSetup);
    originalOrb.replaceWith(orb);
    return shell;
  };

  finishLifeSetup = function finishAndClearDeferredSetup() {
    try { localStorage.removeItem(DEFERRED_SETUP_KEY); } catch {}
    return baseFinishLifeSetup();
  };

  let deferred = false;
  try { deferred = localStorage.getItem(DEFERRED_SETUP_KEY) === 'true'; } catch {}
  if (!hasCompletedSetup && deferred) {
    clearTimeout(launchTimer);
    openWithoutSetup();
  }
})();

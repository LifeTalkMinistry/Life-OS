/* Final production invariant for the live LIFE OS Orb.
 *
 * Once setup is complete, the app must never remain on decorative artwork or
 * a live Orb whose content layer is invisible. This guard runs after all
 * feature scripts in the GitHub Pages bundle and repairs either condition.
 */
(() => {
  const canRecover =
    typeof normalizeLifeProfile === 'function'
    && typeof isLifeProfileComplete === 'function'
    && typeof createLifeStateFromProfile === 'function'
    && typeof createActivityDraft === 'function'
    && typeof render === 'function';

  if (!canRecover) return;

  const style = document.createElement('style');
  style.textContent = `
    .main-screen .orb-now-content {
      display: block !important;
      opacity: 1 !important;
      visibility: visible !important;
      transform: none !important;
    }
    .main-screen .orb-now-content > * {
      opacity: 1 !important;
      visibility: visible !important;
    }
  `;
  document.head.appendChild(style);

  function persistedCompletedProfile() {
    try {
      const raw = localStorage.getItem(LIFE_PROFILE_STORAGE_KEY);
      if (!raw) return null;
      const profile = normalizeLifeProfile(JSON.parse(raw));
      return isLifeProfileComplete(profile) ? profile : null;
    } catch {
      return null;
    }
  }

  function recoverLiveOrb() {
    const profile = persistedCompletedProfile();
    if (!profile) return false;

    const liveContent = document.querySelector('.main-screen .orb-now-content');
    const alreadyLive = screen === 'now' && liveContent;
    if (alreadyLive) return true;

    lifeProfile = profile;
    hasCompletedSetup = true;
    lifeState = createLifeStateFromProfile(profile);
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

    return Boolean(document.querySelector('.main-screen .orb-now-content'));
  }

  // Repair immediately, then again after browser/PWA lifecycle transitions.
  queueMicrotask(recoverLiveOrb);
  requestAnimationFrame(() => requestAnimationFrame(recoverLiveOrb));
  setTimeout(recoverLiveOrb, 120);
  setTimeout(recoverLiveOrb, 900);
  setTimeout(recoverLiveOrb, 2200);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) recoverLiveOrb();
  });
  window.addEventListener('pageshow', recoverLiveOrb);
})();

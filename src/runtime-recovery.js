/* Production persistence + completion recovery.
 *
 * This is intentionally the only post-app completion guard. It verifies the
 * completed profile can be read back before switching to RUNNING NOW, and it
 * keeps a cookie fallback for Android/PWA contexts where localStorage is
 * unavailable or unexpectedly isolated.
 */
(() => {
  const FALLBACK_COOKIE = 'life-os-v1-profile-fallback';

  function writeFallbackCookie(profile) {
    try {
      const encoded = encodeURIComponent(JSON.stringify(profile));
      document.cookie = `${FALLBACK_COOKIE}=${encoded}; Max-Age=31536000; Path=/; SameSite=Lax`;
      return true;
    } catch {
      return false;
    }
  }

  function readFallbackCookie() {
    try {
      const prefix = `${FALLBACK_COOKIE}=`;
      const entry = document.cookie.split('; ').find((item) => item.startsWith(prefix));
      if (!entry) return null;
      return normalizeLifeProfile(JSON.parse(decodeURIComponent(entry.slice(prefix.length))));
    } catch {
      return null;
    }
  }

  function readLocalCompletedProfile() {
    try {
      const raw = localStorage.getItem(LIFE_PROFILE_STORAGE_KEY);
      if (!raw) return null;
      const profile = normalizeLifeProfile(JSON.parse(raw));
      return isLifeProfileComplete(profile) ? profile : null;
    } catch {
      return null;
    }
  }

  function persistCompletedProfile(rawProfile) {
    const profile = normalizeLifeProfile({ ...rawProfile, setupComplete: true });

    try {
      localStorage.setItem(LIFE_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {}

    writeFallbackCookie(profile);

    return readLocalCompletedProfile()
      || (() => {
        const fallback = readFallbackCookie();
        return fallback && isLifeProfileComplete(fallback) ? fallback : null;
      })();
  }

  function openLive(profile) {
    const normalized = normalizeLifeProfile(profile);
    if (!isLifeProfileComplete(normalized)) return false;

    lifeProfile = normalized;
    hasCompletedSetup = true;
    lifeState = createLifeStateFromProfile(normalized);
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
    return true;
  }

  function authoritativeFinishLifeSetup() {
    clearTimeout(setupTimer);
    clearTimeout(launchTimer);

    const persisted = persistCompletedProfile(lifeProfile);
    if (persisted && openLive(persisted)) return;

    // Never leave the user on an empty/ready transition if persistence failed.
    screen = 'setup';
    setupStep = 'review';
    render();
  }

  // Replace the timer-based completion with one synchronous authoritative path.
  finishLifeSetup = authoritativeFinishLifeSetup;

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element
      ? event.target.closest('[data-setup-action="review-confirm"]')
      : null;
    if (!target || screen !== 'setup') return;

    event.preventDefault();
    event.stopImmediatePropagation();
    authoritativeFinishLifeSetup();
  }, true);

  // Restore a completed fallback profile before the launch timer can route back
  // into onboarding.
  if (!hasCompletedSetup) {
    const fallback = readFallbackCookie();
    if (fallback && isLifeProfileComplete(fallback)) {
      try {
        localStorage.setItem(LIFE_PROFILE_STORAGE_KEY, JSON.stringify(fallback));
      } catch {}
      clearTimeout(launchTimer);
      openLive(fallback);
    }
  }
})();

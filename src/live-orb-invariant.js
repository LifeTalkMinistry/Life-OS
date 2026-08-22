/* Final production invariant: LIFE OS must never remain on a decorative/empty Orb.
 * This file is intentionally bundled LAST, after every setup/runtime patch.
 */
(() => {
  function fallbackOpenActivity() {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const start = format24(minutes);
    const end = format24(minutes + 60);
    return {
      id: 'open-time',
      title: 'OPEN TIME',
      shortTitle: 'Open Time',
      start,
      end,
      timeLabel: clockShort(start),
      objective: 'No activity is assigned to this block.',
      why: 'Your Life Map has no scheduled activity for this time.',
      recommendedMinutes: 60,
      kind: 'open'
    };
  }

  function guaranteedActivity() {
    let activity = null;
    try { activity = currentActivity(lifeState); } catch {}
    if (activity?.title && activity?.end) return activity;

    try {
      lifeState = createLifeStateFromProfile(lifeProfile);
      activity = currentActivity(lifeState);
    } catch {}

    return activity?.title && activity?.end ? activity : fallbackOpenActivity();
  }

  function escapePart(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function liveMarkup(activity) {
    const safeTitle = String(activity.title || 'OPEN TIME')
      .split('\n')
      .map(escapePart)
      .join('<br>');

    const timing = activity.kind === 'open'
      ? '<p class="orb-until">No activity scheduled</p>'
      : `<p class="orb-until">Until</p><p class="orb-time">${escapePart(formatClock(activity.end))}</p>`;

    return `<div class="orb-content orb-now-content" data-live-invariant="true">
      <p class="orb-kicker">RUNNING NOW</p>
      <h1 class="orb-title">${safeTitle}</h1>
      <span class="orb-divider" aria-hidden="true"><i></i></span>
      ${timing}
    </div>`;
  }

  function persistCompletedMarker() {
    try {
      const completed = normalizeLifeProfile({ ...lifeProfile, setupComplete: true });
      localStorage.setItem(LIFE_PROFILE_STORAGE_KEY, JSON.stringify(completed));
      lifeProfile = completed;
      hasCompletedSetup = true;
    } catch {}
  }

  function installTopOverlay(shell, activity) {
    if (!shell) return;
    let overlay = shell.querySelector(':scope > .live-orb-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'live-orb-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      shell.appendChild(overlay);
    }
    overlay.innerHTML = liveMarkup(activity);
  }

  function repairLiveOrb() {
    if (screen !== 'now') return;

    const activity = guaranteedActivity();
    let shell = document.querySelector('.main-screen .orb-shell');

    if (!shell) {
      try {
        lifeState = createLifeStateFromProfile(lifeProfile);
        app.replaceChildren(MainScreen());
      } catch {}
      shell = document.querySelector('.main-screen .orb-shell');
    }

    if (!shell) return;

    // Keep the normal interactive Orb intact, but render the visible live copy as
    // a separate topmost sibling. This completely bypasses inner Orb clipping,
    // SVG stacking, masks, and any opacity inherited by .orb itself.
    installTopOverlay(shell, activity);
    persistCompletedMarker();
  }

  const baseRender = render;
  render = function invariantRender() {
    try {
      baseRender();
    } finally {
      repairLiveOrb();
    }
  };

  const root = document.querySelector('#app');
  if (root) {
    let repairing = false;
    const observer = new MutationObserver(() => {
      if (repairing || screen !== 'now') return;
      repairing = true;
      try { repairLiveOrb(); } finally { repairing = false; }
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  // A decorative launch Orb is only valid briefly. If an old timer or runtime
  // path leaves the app there, resolve it deterministically.
  setTimeout(() => {
    if (screen !== 'launch') return;
    try {
      hasCompletedSetup = isLifeProfileComplete(lifeProfile);
      if (hasCompletedSetup) {
        lifeState = createLifeStateFromProfile(lifeProfile);
        screen = 'now';
      } else {
        screen = 'setup';
      }
      render();
    } catch {
      screen = 'setup';
      render();
    }
  }, 2200);

  // The ready step must never become a dead decorative state.
  setTimeout(() => {
    if (screen === 'setup' && setupStep === 'ready') {
      try { finishLifeSetup(); } catch {}
    }
  }, 1200);

  repairLiveOrb();
})();

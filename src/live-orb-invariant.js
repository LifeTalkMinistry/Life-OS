/* Final production invariant: a live LIFE OS screen must never show an empty Orb.
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

  function liveMarkup(activity) {
    const safeTitle = String(activity.title || 'OPEN TIME')
      .split('\n')
      .map((part) => String(part)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;'))
      .join('<br>');

    const timing = activity.kind === 'open'
      ? '<p class="orb-until">No activity scheduled</p>'
      : `<p class="orb-until">Until</p><p class="orb-time">${formatClock(activity.end)}</p>`;

    return `<div class="orb-content orb-now-content" data-live-invariant="true">
      <p class="orb-kicker">RUNNING NOW</p>
      <h1 class="orb-title">${safeTitle}</h1>
      <span class="orb-divider" aria-hidden="true"><i></i></span>
      ${timing}
    </div>`;
  }

  function repairLiveOrb() {
    if (screen !== 'now') return;

    const activity = guaranteedActivity();
    const orb = document.querySelector('.main-screen .orb');

    if (!orb) {
      // If MainScreen itself failed before creating the Orb, rebuild once from a
      // guaranteed state and let the normal renderer try again.
      try {
        lifeState = createLifeStateFromProfile(lifeProfile);
        const rebuilt = MainScreen();
        app.replaceChildren(rebuilt);
      } catch {}
    }

    const liveOrb = document.querySelector('.main-screen .orb');
    if (!liveOrb) return;

    if (!liveOrb.querySelector('.orb-now-content')) {
      liveOrb.innerHTML = liveMarkup(activity);
    }

    // A live screen implies setup is complete; keep the durable marker aligned.
    try {
      const completed = normalizeLifeProfile({ ...lifeProfile, setupComplete: true });
      localStorage.setItem(LIFE_PROFILE_STORAGE_KEY, JSON.stringify(completed));
      lifeProfile = completed;
      hasCompletedSetup = true;
    } catch {}
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

  repairLiveOrb();
})();

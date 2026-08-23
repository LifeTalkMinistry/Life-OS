/* LIFE OS V1 live activity tracker.
 *
 * The home orb is no longer schedule-first. The user's job is simply to tell
 * LIFE OS what they are doing, start the activity, and stop it when finished.
 * Actual activity data becomes the foundation for later LIFE OS intelligence.
 */
(() => {
  const TRACKER_KEY = 'life-os-v1-live-activity-tracker';
  const MAX_LOGS = 500;

  function safeRead() {
    try {
      const raw = localStorage.getItem(TRACKER_KEY);
      if (!raw) return { active: null, logs: [], saved: [] };
      const parsed = JSON.parse(raw);
      return {
        active: parsed?.active && parsed.active.name && parsed.active.startedAt ? parsed.active : null,
        logs: Array.isArray(parsed?.logs) ? parsed.logs.slice(-MAX_LOGS) : [],
        saved: Array.isArray(parsed?.saved) ? parsed.saved.filter(Boolean).slice(0, 12) : []
      };
    } catch {
      return { active: null, logs: [], saved: [] };
    }
  }

  function safeWrite(value) {
    try { localStorage.setItem(TRACKER_KEY, JSON.stringify(value)); } catch {}
  }

  let tracker = safeRead();
  let trackerView = tracker.active ? 'running' : 'idle';
  let trackerDraft = '';
  let lastCompleted = null;
  let elapsedTimer = null;

  const escape = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function elapsedLabel(startedAt, endedAt = Date.now()) {
    const ms = Math.max(0, endedAt - Number(startedAt || endedAt));
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function trackerOrbMarkup() {
    if (trackerView === 'entry') {
      return `
        <div class="orb-content life-tracker-content life-tracker-entry">
          <p class="orb-kicker">RIGHT NOW</p>
          <h1 class="life-tracker-question">WHAT ARE YOU DOING?</h1>
          <input class="life-tracker-input" data-tracker-input maxlength="48" autocomplete="off" placeholder="e.g. Gym, Devotion, CLARA" value="${escape(trackerDraft)}" />
          <button type="button" class="life-tracker-primary" data-tracker-action="start" ${trackerDraft.trim() ? '' : 'disabled'}>START</button>
          <button type="button" class="life-tracker-secondary" data-tracker-action="cancel">Cancel</button>
        </div>`;
    }

    if (trackerView === 'running' && tracker.active) {
      return `
        <div class="orb-content life-tracker-content life-tracker-running">
          <p class="orb-kicker">RUNNING NOW</p>
          <h1 class="orb-title">${escape(tracker.active.name)}</h1>
          <span class="orb-divider" aria-hidden="true"><i></i></span>
          <p class="life-tracker-elapsed" data-tracker-elapsed>${elapsedLabel(tracker.active.startedAt)}</p>
          <p class="life-tracker-caption">ACTUAL TIME</p>
          <button type="button" class="life-tracker-stop" data-tracker-action="stop">STOP</button>
        </div>`;
    }

    if (trackerView === 'save' && lastCompleted) {
      return `
        <div class="orb-content life-tracker-content life-tracker-save">
          <p class="orb-kicker">ACTIVITY LOGGED</p>
          <h1 class="orb-title">${escape(lastCompleted.name)}</h1>
          <p class="life-tracker-duration">${elapsedLabel(lastCompleted.startedAt, lastCompleted.endedAt)}</p>
          <p class="life-tracker-save-copy">Save this as a normal activity?</p>
          <button type="button" class="life-tracker-primary" data-tracker-action="save-normal">SAVE ACTIVITY</button>
          <button type="button" class="life-tracker-secondary" data-tracker-action="skip-save">Not now</button>
        </div>`;
    }

    return `
      <div class="orb-content life-tracker-content life-tracker-idle">
        <p class="orb-kicker">RUNNING NOW</p>
        <h1 class="orb-title">OPEN TIME</h1>
        <span class="orb-divider" aria-hidden="true"><i></i></span>
        <p class="orb-subtitle">No activity scheduled</p>
        <button type="button" class="life-tracker-start" data-tracker-action="entry">START ACTIVITY</button>
      </div>`;
  }

  function TrackerOrb() {
    const shell = document.createElement('div');
    shell.className = 'orb-shell life-tracker-shell';

    const orb = document.createElement('div');
    orb.className = 'orb life-tracker-orb';
    orb.innerHTML = trackerOrbMarkup();

    const input = orb.querySelector('[data-tracker-input]');
    input?.addEventListener('input', () => {
      trackerDraft = input.value;
      const start = orb.querySelector('[data-tracker-action="start"]');
      if (start) start.disabled = !trackerDraft.trim();
    });
    input?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && trackerDraft.trim()) startActivity(trackerDraft);
    });
    if (input) setTimeout(() => input.focus(), 0);

    orb.querySelectorAll('[data-tracker-action]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const action = button.dataset.trackerAction;
        if (action === 'entry') {
          trackerDraft = '';
          trackerView = 'entry';
          render();
        } else if (action === 'cancel') {
          trackerView = tracker.active ? 'running' : 'idle';
          render();
        } else if (action === 'start' && trackerDraft.trim()) {
          startActivity(trackerDraft);
        } else if (action === 'stop') {
          stopActivity();
        } else if (action === 'save-normal') {
          saveNormalActivity();
        } else if (action === 'skip-save') {
          lastCompleted = null;
          trackerView = 'idle';
          render();
        }
      });
    });

    shell.append(OrbArtwork(), orb);
    return shell;
  }

  function startActivity(name) {
    const clean = String(name || '').trim().slice(0, 48);
    if (!clean) return;
    tracker.active = {
      id: `tracked-${Date.now()}`,
      name: clean,
      startedAt: Date.now()
    };
    trackerDraft = '';
    trackerView = 'running';
    safeWrite(tracker);
    render();
  }

  function stopActivity() {
    if (!tracker.active) return;
    const endedAt = Date.now();
    lastCompleted = { ...tracker.active, endedAt, durationMs: Math.max(0, endedAt - tracker.active.startedAt) };
    tracker.logs = [...tracker.logs, lastCompleted].slice(-MAX_LOGS);
    tracker.active = null;
    safeWrite(tracker);
    trackerView = tracker.saved.includes(lastCompleted.name) ? 'idle' : 'save';
    render();
  }

  function saveNormalActivity() {
    if (lastCompleted?.name && !tracker.saved.includes(lastCompleted.name)) {
      tracker.saved = [lastCompleted.name, ...tracker.saved].slice(0, 12);
      safeWrite(tracker);
    }
    lastCompleted = null;
    trackerView = 'idle';
    render();
  }

  const priorMainScreen = MainScreen;
  MainScreen = function ActivityTrackerMainScreen() {
    clearInterval(elapsedTimer);

    // System panels from the previous prototype still need a safe escape hatch
    // while the tracker becomes the authoritative V1 home experience.
    if (systemView) return priorMainScreen();

    const view = document.createElement('section');
    view.className = 'screen main-screen life-tracker-screen';
    view.appendChild(Brand());

    const stage = document.createElement('div');
    stage.className = 'orb-stage';
    stage.appendChild(TrackerOrb());
    view.appendChild(stage);

    const hint = document.createElement('p');
    hint.className = 'gesture-hint is-visible life-tracker-hint';
    hint.textContent = trackerView === 'running'
      ? 'Stop when you finish. LIFE OS records the actual time.'
      : trackerView === 'entry'
        ? 'Tell LIFE OS what you are doing.'
        : 'TAP FOR WHY · HOLD FOR TODAY · DOUBLE TAP TO ADJUST';
    view.appendChild(hint);

    if (trackerView === 'running' && tracker.active) {
      elapsedTimer = setInterval(() => {
        const node = document.querySelector('[data-tracker-elapsed]');
        if (node && tracker.active) node.textContent = elapsedLabel(tracker.active.startedAt);
      }, 1000);
    }

    return view;
  };

  const style = document.createElement('style');
  style.textContent = `
    .life-tracker-content{width:min(78%,320px);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:.72rem}
    .life-tracker-question{margin:0;color:#fff;font-size:clamp(1.45rem,5.8vw,2rem);line-height:1.08;font-weight:650;letter-spacing:-.02em}
    .life-tracker-input{width:100%;box-sizing:border-box;border:1px solid rgba(196,171,255,.35);border-radius:999px;background:rgba(8,7,20,.55);color:#fff;text-align:center;padding:.82rem 1rem;font:500 1rem/1.2 Inter,ui-sans-serif,sans-serif;outline:none;box-shadow:inset 0 0 22px rgba(108,75,255,.08)}
    .life-tracker-input:focus{border-color:rgba(220,199,255,.72);box-shadow:0 0 18px rgba(151,95,255,.14),inset 0 0 22px rgba(108,75,255,.1)}
    .life-tracker-input::placeholder{color:rgba(229,223,239,.46)}
    .life-tracker-primary,.life-tracker-secondary,.life-tracker-start,.life-tracker-stop{font:600 .82rem/1 Inter,ui-sans-serif,sans-serif;letter-spacing:.08em;color:#fff;background:none;border:0;cursor:pointer}
    .life-tracker-primary,.life-tracker-start{padding:.72rem 1.25rem;border-radius:999px;border:1px solid rgba(202,178,255,.38);background:rgba(112,74,255,.12)}
    .life-tracker-primary:disabled{opacity:.35}
    .life-tracker-secondary{opacity:.62;padding:.4rem}
    .life-tracker-stop{margin-top:.15rem;padding:.76rem 1.35rem;border-radius:999px;border:1px solid rgba(255,191,220,.42);background:rgba(255,70,150,.08)}
    .life-tracker-elapsed{margin:.05rem 0 0;color:#fff;font-size:1.55rem;font-weight:520;font-variant-numeric:tabular-nums;letter-spacing:.05em}
    .life-tracker-caption{margin:-.4rem 0 .1rem;color:rgba(225,215,238,.58);font-size:.58rem;letter-spacing:.22em}
    .life-tracker-duration{margin:0;color:#fff;font-size:1.3rem;font-variant-numeric:tabular-nums}
    .life-tracker-save-copy{margin:.05rem 0 .2rem;color:rgba(237,231,246,.72);font-size:.88rem;line-height:1.35}
    .life-tracker-hint{max-width:min(86vw,430px);text-align:center}
  `;
  document.head.appendChild(style);

  window.__LIFE_OS_TRACKER__ = {
    getState: () => JSON.parse(JSON.stringify(tracker)),
    clear: () => {
      tracker = { active: null, logs: [], saved: [] };
      trackerView = 'idle';
      lastCompleted = null;
      safeWrite(tracker);
      render();
    }
  };
})();
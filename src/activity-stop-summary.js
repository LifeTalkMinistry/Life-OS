/* LIFE OS — stop summary + manual duration correction. */
(() => {
  const TRACKER_KEY = 'life-os-v1-live-activity-tracker';
  const PENDING_KEY = 'life-os-stop-summary-pending';

  function readTracker() {
    try {
      const raw = localStorage.getItem(TRACKER_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        active: parsed?.active || null,
        logs: Array.isArray(parsed?.logs) ? parsed.logs : [],
        saved: Array.isArray(parsed?.saved) ? parsed.saved.filter(Boolean) : []
      };
    } catch {
      return { active: null, logs: [], saved: [] };
    }
  }

  function writeTracker(state) {
    try { localStorage.setItem(TRACKER_KEY, JSON.stringify(state)); } catch {}
  }

  function readPending() {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function writePending(value) {
    try {
      if (value) sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
      else sessionStorage.removeItem(PENDING_KEY);
    } catch {}
  }

  function durationLabel(ms) {
    const totalMinutes = Math.max(1, Math.round(Number(ms || 0) / 60000));
    if (totalMinutes < 60) return `${totalMinutes}m`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  // Capture STOP before the tracker handles it so we can always show the
  // completion summary first. Reloading then lets the private tracker state
  // rehydrate cleanly from localStorage with no active timer.
  document.addEventListener('click', (event) => {
    const stop = event.target.closest('[data-tracker-action="stop"]');
    if (!stop) return;

    const tracker = readTracker();
    if (!tracker.active) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const endedAt = Date.now();
    const completed = {
      ...tracker.active,
      endedAt,
      durationMs: Math.max(0, endedAt - Number(tracker.active.startedAt || endedAt))
    };

    tracker.active = null;
    tracker.logs = [...tracker.logs, completed].slice(-500);
    writeTracker(tracker);
    writePending({ id: completed.id, name: completed.name, mode: 'summary' });
    location.reload();
  }, true);

  const priorMainScreen = MainScreen;
  MainScreen = function MainScreenWithStopSummary() {
    const view = priorMainScreen();
    const pending = readPending();
    if (!pending || !view?.classList?.contains('life-tracker-screen')) return view;

    const tracker = readTracker();
    const log = tracker.logs.find((item) => item?.id === pending.id);
    if (!log) {
      writePending(null);
      return view;
    }

    const orb = view.querySelector('.life-tracker-orb');
    if (!orb) return view;

    if (pending.mode === 'adjust') {
      const totalMinutes = Math.max(1, Math.round(Number(log.durationMs || 0) / 60000));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      orb.innerHTML = `
        <div class="orb-content life-stop-summary life-stop-adjust">
          <p class="orb-kicker">ACTUAL TIME</p>
          <div class="life-stop-time-inputs">
            <label><input type="number" min="0" max="72" inputmode="numeric" value="${hours}" data-stop-hours><span>H</span></label>
            <label><input type="number" min="0" max="59" inputmode="numeric" value="${minutes}" data-stop-minutes><span>MIN</span></label>
          </div>
          <button type="button" class="life-stop-primary" data-stop-save>SAVE</button>
          <button type="button" class="life-stop-secondary" data-stop-cancel>CANCEL</button>
        </div>`;

      orb.querySelector('[data-stop-save]')?.addEventListener('click', (event) => {
        event.stopPropagation();
        const h = Math.max(0, Math.min(72, Number(orb.querySelector('[data-stop-hours]')?.value || 0)));
        const m = Math.max(0, Math.min(59, Number(orb.querySelector('[data-stop-minutes]')?.value || 0)));
        const durationMs = Math.max(60000, ((h * 60) + m) * 60000);
        const state = readTracker();
        const index = state.logs.findIndex((item) => item?.id === pending.id);
        if (index >= 0) {
          const current = state.logs[index];
          state.logs[index] = {
            ...current,
            durationMs,
            startedAt: Math.max(0, Number(current.endedAt || Date.now()) - durationMs)
          };
          writeTracker(state);
        }
        writePending({ ...pending, mode: 'summary' });
        render();
      });

      orb.querySelector('[data-stop-cancel]')?.addEventListener('click', (event) => {
        event.stopPropagation();
        writePending({ ...pending, mode: 'summary' });
        render();
      });
      return view;
    }

    if (pending.mode === 'save') {
      orb.innerHTML = `
        <div class="orb-content life-stop-summary life-stop-save-normal">
          <p class="orb-kicker">SAVE ACTIVITY?</p>
          <h1 class="life-stop-name">${escapeHtml(log.name || 'Activity')}</h1>
          <button type="button" class="life-stop-primary" data-stop-save-normal>SAVE ACTIVITY</button>
          <button type="button" class="life-stop-secondary" data-stop-finish>NOT NOW</button>
        </div>`;

      orb.querySelector('[data-stop-save-normal]')?.addEventListener('click', (event) => {
        event.stopPropagation();
        const state = readTracker();
        if (log.name && !state.saved.includes(log.name)) state.saved = [log.name, ...state.saved];
        writeTracker(state);
        writePending(null);
        render();
      });
      orb.querySelector('[data-stop-finish]')?.addEventListener('click', (event) => {
        event.stopPropagation();
        writePending(null);
        render();
      });
      return view;
    }

    orb.innerHTML = `
      <div class="orb-content life-stop-summary">
        <p class="orb-kicker">ACTIVITY COMPLETE</p>
        <h1 class="life-stop-duration">${durationLabel(log.durationMs)}</h1>
        <p class="life-stop-caption">TRACKED</p>
        <button type="button" class="life-stop-primary" data-stop-done>DONE</button>
        <button type="button" class="life-stop-secondary" data-stop-adjust>ADJUST TIME</button>
      </div>`;

    orb.querySelector('[data-stop-adjust]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      writePending({ ...pending, mode: 'adjust' });
      render();
    });

    orb.querySelector('[data-stop-done]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      const state = readTracker();
      if (log.name && !state.saved.includes(log.name)) {
        writePending({ ...pending, mode: 'save' });
      } else {
        writePending(null);
      }
      render();
    });

    return view;
  };

  const style = document.createElement('style');
  style.textContent = `
    .life-stop-summary{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:.78rem}
    .life-stop-duration{margin:.08rem 0 0;color:#fff;font:580 2rem/1 Inter,ui-sans-serif,sans-serif;letter-spacing:-.025em;font-variant-numeric:tabular-nums}
    .life-stop-caption{margin:-.34rem 0 .3rem;color:rgba(225,216,239,.48);font:520 .52rem/1 Inter,ui-sans-serif,sans-serif;letter-spacing:.22em}
    .life-stop-primary,.life-stop-secondary{border:0;cursor:pointer;font-family:Inter,ui-sans-serif,sans-serif}
    .life-stop-primary{min-width:150px;padding:.76rem 1.25rem;border:1px solid rgba(202,178,255,.36);border-radius:999px;background:rgba(112,74,255,.12);color:#fff;font-size:.76rem;font-weight:650;letter-spacing:.11em}
    .life-stop-secondary{padding:.45rem .9rem;background:none;color:rgba(229,220,241,.58);font-size:.62rem;font-weight:580;letter-spacing:.13em}
    .life-stop-time-inputs{display:flex;align-items:flex-end;justify-content:center;gap:14px;margin:.35rem 0 .25rem}
    .life-stop-time-inputs label{display:flex;flex-direction:column;align-items:center;gap:7px}
    .life-stop-time-inputs input{width:70px;padding:.62rem .45rem;border:1px solid rgba(202,178,255,.25);border-radius:14px;background:rgba(10,8,20,.48);color:#fff;text-align:center;font:560 1.12rem/1 Inter,ui-sans-serif,sans-serif;outline:none;font-variant-numeric:tabular-nums}
    .life-stop-time-inputs span{color:rgba(222,212,237,.48);font:520 .5rem/1 Inter,ui-sans-serif,sans-serif;letter-spacing:.17em}
    .life-stop-name{max-width:75%;margin:.15rem 0 .45rem;color:#fff;font:560 1.05rem/1.25 Inter,ui-sans-serif,sans-serif;overflow-wrap:anywhere}
  `;
  document.head.appendChild(style);
})();

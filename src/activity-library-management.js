/* LIFE OS — activity history editing + scalable Saved Activities library. */
(() => {
  const TRACKER_KEY = 'life-os-v1-live-activity-tracker';
  const DELETED_SAVED_KEY = 'life-os-v1-deleted-saved-activities';
  const nativeSetItem = Storage.prototype.setItem;
  let pageOpen = false;
  let libraryDirty = false;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const savedKey = (value) => String(value ?? '').trim().toLowerCase();

  function readDeletedSaved() {
    try {
      const raw = localStorage.getItem(DELETED_SAVED_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed.map(savedKey).filter(Boolean) : []);
    } catch { return new Set(); }
  }

  function writeDeletedSaved(set) {
    nativeSetItem.call(localStorage, DELETED_SAVED_KEY, JSON.stringify([...set]));
  }

  function uniqueSaved(items) {
    const deleted = readDeletedSaved();
    const seen = new Set();
    return (Array.isArray(items) ? items : []).filter(Boolean).filter((item) => {
      const key = savedKey(item);
      if (!key || deleted.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function readState() {
    try {
      const raw = localStorage.getItem(TRACKER_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        active: parsed?.active || null,
        logs: Array.isArray(parsed?.logs) ? parsed.logs.filter(Boolean) : [],
        saved: uniqueSaved(parsed?.saved)
      };
    } catch { return { active:null, logs:[], saved:[] }; }
  }

  function writeState(state) {
    state.saved = uniqueSaved(state.saved);
    nativeSetItem.call(localStorage, TRACKER_KEY, JSON.stringify(state));
  }

  /* Preserve the complete Saved Activities library when the compact tracker
     writes state, while honoring explicit deletions and case-insensitive dedupe. */
  Storage.prototype.setItem = function(key, value) {
    if (this === localStorage && key === TRACKER_KEY) {
      try {
        const incoming = JSON.parse(value);
        const existingRaw = localStorage.getItem(TRACKER_KEY);
        const existing = existingRaw ? JSON.parse(existingRaw) : {};
        if (Array.isArray(incoming?.saved) && Array.isArray(existing?.saved)) {
          incoming.saved = uniqueSaved([...incoming.saved, ...existing.saved]);
          value = JSON.stringify(incoming);
        }
      } catch {}
    }
    return nativeSetItem.call(this, key, value);
  };

  function dateInputValue(timestamp) {
    const d = new Date(Number(timestamp || Date.now()));
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0,16);
  }

  function durationLabel(ms) {
    const mins = Math.max(1, Math.round(Number(ms || 0) / 60000));
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins/60), m = mins%60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  function injectViewAllSaved(root = document) {
    const savedBlock = root.querySelector?.('.life-entry-saved');
    if (!savedBlock || savedBlock.querySelector('[data-open-saved-library]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'life-saved-view-all';
    button.dataset.openSavedLibrary = '';
    button.textContent = 'VIEW ALL SAVED ACTIVITIES';
    savedBlock.appendChild(button);
  }

  new MutationObserver(() => injectViewAllSaved()).observe(document.documentElement, {childList:true, subtree:true});
  queueMicrotask(() => injectViewAllSaved());

  function savedLibraryMarkup(query = '') {
    const saved = readState().saved;
    const needle = query.trim().toLowerCase();
    const filtered = needle ? saved.filter(name => String(name).toLowerCase().includes(needle)) : saved;
    return filtered.length ? filtered.map((name, index) => `
      <div class="life-library-row" data-saved-row="${index}">
        <button type="button" class="life-library-start" data-saved-start="${esc(name)}" aria-label="Start ${esc(name)}">
          <span><strong>${esc(name)}</strong><small>TAP TO START</small></span><i>›</i>
        </button>
        <button type="button" class="life-library-manage" data-saved-manage="${esc(name)}" aria-label="Edit ${esc(name)}">•••</button>
      </div>`).join('') : `<div class="life-library-empty"><strong>${saved.length ? 'No matches.' : 'No saved activities yet.'}</strong><p>${saved.length ? 'Try another search.' : 'Save an activity after you finish it and it will appear here.'}</p></div>`;
  }

  function openSavedLibrary() {
    pageOpen = true;
    libraryDirty = false;
    const app = document.querySelector('#app');
    if (!app) return;
    app.innerHTML = `
      <section class="life-library-page" aria-label="Saved Activities">
        <header class="life-library-header">
          <button type="button" class="life-library-back" data-library-back aria-label="Back">‹</button>
          <div><p>LIFE OS</p><h1>Saved Activities</h1></div>
        </header>
        <main class="life-library-body">
          <div class="life-library-search"><span>⌕</span><input type="search" data-library-search placeholder="Search saved activities" autocomplete="off"></div>
          <div class="life-library-count" data-library-count>${readState().saved.length} SAVED</div>
          <div class="life-library-list" data-library-list>${savedLibraryMarkup()}</div>
        </main>
      </section>`;

    const input = app.querySelector('[data-library-search]');
    const list = app.querySelector('[data-library-list]');
    input?.addEventListener('input', () => { if (list) list.innerHTML = savedLibraryMarkup(input.value); });
    app.querySelector('[data-library-back]')?.addEventListener('click', () => {
      pageOpen = false;
      if (libraryDirty) location.reload();
      else if (typeof render === 'function') render();
    });
  }

  function startSavedActivity(name) {
    const clean = String(name || '').trim().slice(0,48);
    if (!clean) return;
    const state = readState();
    if (state.active) {
      pageOpen = false;
      location.reload();
      return;
    }
    state.active = { id:`tracked-${Date.now()}`, name:clean, startedAt:Date.now() };
    writeState(state);
    pageOpen = false;
    location.reload();
  }

  function openSavedEditor(name) {
    const overlay = document.createElement('div');
    overlay.className = 'life-manage-overlay';
    overlay.innerHTML = `
      <section class="life-manage-sheet" role="dialog" aria-modal="true" aria-label="Saved activity details">
        <div class="life-manage-grip"></div>
        <p class="life-manage-eyebrow">SAVED ACTIVITY</p>
        <label>Activity name<input data-saved-edit-name maxlength="48" value="${esc(name)}"></label>
        <div class="life-manage-actions">
          <button type="button" class="life-manage-save" data-saved-save>SAVE CHANGES</button>
          <button type="button" class="life-manage-delete" data-saved-delete>DELETE SAVED ACTIVITY</button>
          <button type="button" class="life-manage-cancel" data-manage-close>CANCEL</button>
        </div>
      </section>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('[data-manage-close]')?.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('[data-saved-save]')?.addEventListener('click', () => {
      const next = overlay.querySelector('[data-saved-edit-name]')?.value.trim().slice(0,48);
      if (!next) return;
      const deleted = readDeletedSaved();
      deleted.delete(savedKey(next));
      writeDeletedSaved(deleted);
      const state = readState();
      state.saved = uniqueSaved(state.saved.map(item => savedKey(item) === savedKey(name) ? next : item));
      writeState(state); libraryDirty = true; close(); openSavedLibrary(); libraryDirty = true;
    });
    overlay.querySelector('[data-saved-delete]')?.addEventListener('click', () => {
      const button = overlay.querySelector('[data-saved-delete]');
      if (button.dataset.confirm !== 'yes') { button.dataset.confirm='yes'; button.textContent='TAP AGAIN TO DELETE'; return; }
      const deleted = readDeletedSaved();
      deleted.add(savedKey(name));
      writeDeletedSaved(deleted);
      const state = readState();
      state.saved = state.saved.filter(item => savedKey(item) !== savedKey(name));
      writeState(state); libraryDirty = true; close(); openSavedLibrary(); libraryDirty = true;
    });
  }

  function sortedLogs() {
    return readState().logs.slice().sort((a,b) => Number(b.endedAt||0)-Number(a.endedAt||0));
  }

  function openHistoryEditor(log) {
    if (!log) return;
    const overlay = document.createElement('div');
    overlay.className = 'life-manage-overlay';
    overlay.innerHTML = `
      <section class="life-manage-sheet" role="dialog" aria-modal="true" aria-label="Activity details">
        <div class="life-manage-grip"></div>
        <p class="life-manage-eyebrow">ACTIVITY HISTORY</p>
        <label>Activity name<input data-history-name maxlength="48" value="${esc(log.name || 'Activity')}"></label>
        <div class="life-manage-time-grid">
          <label>Started<input type="datetime-local" data-history-start value="${dateInputValue(log.startedAt)}"></label>
          <label>Ended<input type="datetime-local" data-history-end value="${dateInputValue(log.endedAt)}"></label>
        </div>
        <small class="life-manage-duration">Recorded duration: ${durationLabel(log.durationMs)}</small>
        <div class="life-manage-actions">
          <button type="button" class="life-manage-save" data-history-save>SAVE CHANGES</button>
          <button type="button" class="life-manage-delete" data-history-delete>DELETE HISTORY</button>
          <button type="button" class="life-manage-cancel" data-manage-close>CANCEL</button>
        </div>
      </section>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('[data-manage-close]')?.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('[data-history-save]')?.addEventListener('click', () => {
      const name = overlay.querySelector('[data-history-name]')?.value.trim().slice(0,48);
      const startedAt = new Date(overlay.querySelector('[data-history-start]')?.value).getTime();
      const endedAt = new Date(overlay.querySelector('[data-history-end]')?.value).getTime();
      if (!name || !Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt <= startedAt) return;
      const state = readState();
      const idx = state.logs.findIndex(item => item.id === log.id || (item.startedAt === log.startedAt && item.endedAt === log.endedAt && item.name === log.name));
      if (idx < 0) return;
      state.logs[idx] = {...state.logs[idx], name, startedAt, endedAt, durationMs:endedAt-startedAt};
      writeState(state); libraryDirty = true; close(); window.__LIFE_OS_ACTIVITY_HISTORY_PAGE__?.open?.();
    });
    overlay.querySelector('[data-history-delete]')?.addEventListener('click', () => {
      const button = overlay.querySelector('[data-history-delete]');
      if (button.dataset.confirm !== 'yes') { button.dataset.confirm='yes'; button.textContent='TAP AGAIN TO DELETE'; return; }
      const state = readState();
      state.logs = state.logs.filter(item => !(item.id === log.id || (item.startedAt === log.startedAt && item.endedAt === log.endedAt && item.name === log.name)));
      writeState(state); libraryDirty = true; close(); window.__LIFE_OS_ACTIVITY_HISTORY_PAGE__?.open?.();
    });
  }

  document.addEventListener('click', (event) => {
    const open = event.target.closest('[data-open-saved-library]');
    if (open) { event.preventDefault(); event.stopImmediatePropagation(); openSavedLibrary(); return; }

    const manage = event.target.closest('[data-saved-manage]');
    if (manage) { event.preventDefault(); event.stopImmediatePropagation(); openSavedEditor(manage.dataset.savedManage); return; }

    const start = event.target.closest('[data-saved-start]');
    if (start) { event.preventDefault(); event.stopImmediatePropagation(); startSavedActivity(start.dataset.savedStart); return; }

    const historyRow = event.target.closest('.life-history-page-row');
    if (historyRow) {
      event.preventDefault();
      const rows = [...document.querySelectorAll('.life-history-page-row')];
      openHistoryEditor(sortedLogs()[rows.indexOf(historyRow)]);
    }
  }, true);

  window.addEventListener('popstate', () => {
    if (pageOpen) { pageOpen = false; if (typeof render === 'function') render(); }
  });

  const style = document.createElement('style');
  style.textContent = `
    .life-saved-view-all{margin-top:.2rem;padding:.48rem .7rem;border:0;background:none;color:rgba(220,207,240,.62);font:600 .54rem/1 Inter,ui-sans-serif,sans-serif;letter-spacing:.14em;cursor:pointer}
    .life-history-page-row{cursor:pointer}.life-history-page-row:active{opacity:.72}
    .life-library-page{min-height:100svh;background:#030307;color:#fff;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:calc(env(safe-area-inset-top) + 26px) 22px calc(env(safe-area-inset-bottom) + 34px);box-sizing:border-box;overflow-y:auto}
    .life-library-header{max-width:680px;margin:0 auto 28px;display:flex;align-items:center;gap:14px}.life-library-header p{margin:0 0 5px;color:rgba(202,185,229,.48);font-size:.58rem;letter-spacing:.25em}.life-library-header h1{margin:0;font-size:1.5rem;font-weight:520;letter-spacing:-.02em}.life-library-back{width:38px;height:38px;display:grid;place-items:center;border:1px solid rgba(210,193,241,.14);border-radius:50%;background:rgba(255,255,255,.025);color:rgba(255,255,255,.88);font:300 1.85rem/1 sans-serif;cursor:pointer;padding:0 0 3px}
    .life-library-body{max-width:680px;margin:0 auto}.life-library-search{display:flex;align-items:center;gap:10px;padding:0 14px;height:46px;border:1px solid rgba(199,176,245,.13);border-radius:15px;background:rgba(255,255,255,.025)}.life-library-search span{color:rgba(214,200,233,.48);font-size:1.1rem}.life-library-search input{width:100%;border:0;outline:0;background:none;color:#fff;font-size:.86rem}.life-library-search input::placeholder{color:rgba(216,204,232,.38)}.life-library-count{margin:22px 2px 9px;color:rgba(216,204,232,.42);font-size:.56rem;letter-spacing:.17em}.life-library-list{border-top:1px solid rgba(214,199,240,.1)}
    .life-library-row{width:100%;display:flex;align-items:stretch;border-bottom:1px solid rgba(214,199,240,.1);background:none;color:#fff}.life-library-start{min-width:0;flex:1;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px 2px;border:0;background:none;color:#fff;text-align:left;cursor:pointer}.life-library-start span{min-width:0;display:flex;flex-direction:column;gap:5px}.life-library-start strong{font-size:.96rem;font-weight:520;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.life-library-start small{color:rgba(216,205,229,.42);font-size:.55rem;letter-spacing:.12em}.life-library-start i{font:300 1.45rem/1 sans-serif;color:rgba(220,208,238,.35);font-style:normal}.life-library-start:active{opacity:.72}.life-library-manage{width:48px;flex:0 0 48px;border:0;background:none;color:rgba(220,208,238,.46);font:700 .78rem/1 Inter,ui-sans-serif,sans-serif;letter-spacing:.08em;cursor:pointer}.life-library-manage:active{color:#fff}.life-library-empty{padding:58px 10px;text-align:center;color:rgba(230,220,242,.56)}.life-library-empty strong{display:block;margin-bottom:8px;color:rgba(255,255,255,.84);font-size:.98rem;font-weight:520}.life-library-empty p{margin:0;font-size:.76rem;line-height:1.5}
    .life-manage-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.62);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:18px}.life-manage-sheet{width:min(100%,560px);padding:10px 20px calc(18px + env(safe-area-inset-bottom));border:1px solid rgba(203,180,245,.15);border-radius:26px;background:linear-gradient(180deg,rgba(18,14,28,.98),rgba(7,6,12,.99));box-shadow:0 -18px 60px rgba(47,24,89,.28)}.life-manage-grip{width:34px;height:3px;margin:2px auto 20px;border-radius:999px;background:rgba(255,255,255,.18)}.life-manage-eyebrow{margin:0 0 18px;color:rgba(206,190,230,.48);font-size:.58rem;letter-spacing:.2em}.life-manage-sheet label{display:flex;flex-direction:column;gap:7px;margin-bottom:14px;color:rgba(225,215,239,.55);font-size:.62rem;letter-spacing:.08em}.life-manage-sheet input{width:100%;height:44px;padding:0 12px;border:1px solid rgba(205,184,240,.15);border-radius:12px;outline:0;background:rgba(255,255,255,.035);color:#fff;font-size:.86rem}.life-manage-time-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.life-manage-duration{display:block;margin:-2px 0 18px;color:rgba(220,209,235,.42);font-size:.62rem}.life-manage-actions{display:flex;flex-direction:column;gap:8px}.life-manage-actions button{min-height:44px;border-radius:12px;font:620 .7rem/1 Inter,ui-sans-serif,sans-serif;letter-spacing:.08em;cursor:pointer}.life-manage-save{border:1px solid rgba(199,170,255,.34);background:rgba(119,73,232,.15);color:#fff}.life-manage-delete{border:1px solid rgba(255,123,163,.18);background:rgba(255,65,123,.055);color:rgba(255,155,184,.82)}.life-manage-cancel{border:0;background:none;color:rgba(226,216,239,.5)}
    @media(max-width:420px){.life-manage-time-grid{grid-template-columns:1fr}.life-library-page{padding-left:20px;padding-right:20px}}
  `;
  document.head.appendChild(style);
})();
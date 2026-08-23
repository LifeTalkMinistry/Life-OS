/* LIFE OS V1 live activity tracker. */
(() => {
  const TRACKER_KEY = 'life-os-v1-live-activity-tracker';
  const MAX_LOGS = 500;
  const COMMANDS = [
    { id: 'entry', label: 'START ACTIVITY' },
    { id: 'history', label: 'ACTIVITY HISTORY' },
    { id: 'insights', label: 'INSIGHTS' },
    { id: 'settings', label: 'SETTINGS' }
  ];

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
    } catch { return { active: null, logs: [], saved: [] }; }
  }

  function safeWrite(value) { try { localStorage.setItem(TRACKER_KEY, JSON.stringify(value)); } catch {} }
  let tracker = safeRead();
  let trackerView = tracker.active ? 'running' : 'idle';
  let trackerDraft = '';
  let lastCompleted = null;
  let elapsedTimer = null;
  let commandIndex = 0;
  let swipeStartY = null;
  let swipeStartX = null;

  const escape = (value) => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  function elapsedLabel(startedAt, endedAt = Date.now()) {
    const totalSeconds = Math.floor(Math.max(0, endedAt - Number(startedAt || endedAt)) / 1000);
    const hours = Math.floor(totalSeconds / 3600), minutes = Math.floor((totalSeconds % 3600) / 60), seconds = totalSeconds % 60;
    return hours > 0 ? `${hours}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}` : `${minutes}:${String(seconds).padStart(2,'0')}`;
  }

  function compactDuration(ms) {
    const minutes = Math.max(1, Math.round(Number(ms || 0) / 60000));
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
  }

  function recentLogs(days = 7) {
    const since = Date.now() - (days * 24 * 60 * 60 * 1000);
    return tracker.logs
      .filter((log) => Number(log?.endedAt || 0) >= since)
      .sort((a, b) => Number(b.endedAt || 0) - Number(a.endedAt || 0));
  }

  function historyRowsMarkup(logs) {
    if (!logs.length) return `<p class="life-history-empty">No completed activities yet.</p>`;
    return logs.slice(0, 4).map((log) => {
      const date = new Date(Number(log.endedAt || Date.now()));
      const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return `<div class="life-history-row"><span><strong>${escape(log.name)}</strong><small>${escape(day)}</small></span><b>${compactDuration(log.durationMs)}</b></div>`;
    }).join('');
  }

  function savedActivitiesMarkup(limit = 6) {
    if (!tracker.saved.length) return '';
    return `<div class="life-saved-list">${tracker.saved.slice(0, limit).map((name) => `<button type="button" class="life-saved-choice" data-saved-activity="${escape(name)}">${escape(name)}</button>`).join('')}</div>`;
  }

  function entrySavedMarkup() {
    if (!tracker.saved.length) return '';
    return `<div class="life-entry-saved"><span class="life-entry-or">OR CHOOSE SAVED</span>${savedActivitiesMarkup(4)}</div>`;
  }

  function insightsMarkup() {
    const recent = recentLogs(7);
    if (!recent.length) return `<p class="life-history-empty">Track a few activities first.<br>LIFE OS will build your time picture here.</p>`;
    const totals = new Map();
    recent.forEach((log) => totals.set(log.name, (totals.get(log.name) || 0) + Math.max(0, Number(log.durationMs || 0))));
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const totalMs = ranked.reduce((sum, item) => sum + item[1], 0);
    const top = ranked[0];
    return `<div class="life-insight-card"><span>LAST 7 DAYS</span><strong>${compactDuration(totalMs)}</strong><small>tracked across ${recent.length} ${recent.length === 1 ? 'activity' : 'activities'}</small></div><div class="life-insight-card"><span>MOST TIME</span><strong>${escape(top[0])}</strong><small>${compactDuration(top[1])}</small></div>`;
  }

  function commandWheelMarkup() {
    const before = COMMANDS[(commandIndex - 1 + COMMANDS.length) % COMMANDS.length];
    const current = COMMANDS[commandIndex];
    const after = COMMANDS[(commandIndex + 1) % COMMANDS.length];
    return `<div class="orb-content life-command-wheel" data-command-wheel>
      <button type="button" class="life-command-option is-neighbor" data-command-shift="-1">${before.label}</button>
      <button type="button" class="life-command-option is-current" data-command-select="${current.id}">${current.label}</button>
      <button type="button" class="life-command-option is-neighbor" data-command-shift="1">${after.label}</button>
      <span class="life-command-cue">SWIPE</span>
    </div>`;
  }

  function trackerOrbMarkup() {
    if (trackerView === 'running' && tracker.active) return `<div class="orb-content life-tracker-content life-tracker-running"><p class="orb-kicker">RUNNING NOW</p><h1 class="orb-title">${escape(tracker.active.name)}</h1><span class="orb-divider" aria-hidden="true"><i></i></span><p class="life-tracker-elapsed" data-tracker-elapsed>${elapsedLabel(tracker.active.startedAt)}</p><p class="life-tracker-caption">ACTUAL TIME</p><button type="button" class="life-tracker-stop" data-tracker-action="stop">STOP</button></div>`;
    if (trackerView === 'save' && lastCompleted) return `<div class="orb-content life-tracker-content life-tracker-save"><p class="orb-kicker">ACTIVITY LOGGED</p><h1 class="orb-title">${escape(lastCompleted.name)}</h1><p class="life-tracker-duration">${elapsedLabel(lastCompleted.startedAt,lastCompleted.endedAt)}</p><p class="life-tracker-save-copy">Save this as a normal activity?</p><button type="button" class="life-tracker-primary" data-tracker-action="save-normal">SAVE ACTIVITY</button><button type="button" class="life-tracker-secondary" data-tracker-action="skip-save">Not now</button></div>`;
    if (trackerView === 'entry') return `<div class="orb-content life-tracker-entry-clean"><form class="life-activity-composer" data-tracker-form><input data-tracker-input maxlength="48" autocomplete="off" placeholder="Type your activity now" aria-label="Type your activity now"><button type="submit" aria-label="Start activity">↑</button></form>${entrySavedMarkup()}<button type="button" class="life-view-back" data-tracker-action="back">BACK</button></div>`;
    if (trackerView === 'history') {
      const recent = recentLogs(7);
      const totalMs = recent.reduce((sum, log) => sum + Math.max(0, Number(log.durationMs || 0)), 0);
      return `<div class="orb-content life-tracker-content life-tracker-history"><p class="orb-kicker">ACTIVITY HISTORY</p><div class="life-history-summary"><strong>${recent.length}</strong><span>ACTIVITIES · LAST 7 DAYS</span><b>${recent.length ? compactDuration(totalMs) : '0m'} tracked</b></div><div class="life-history-list">${historyRowsMarkup(recent)}</div><button type="button" class="life-view-back" data-tracker-action="back">BACK</button></div>`;
    }
    if (trackerView === 'insights') return `<div class="orb-content life-tracker-content life-tracker-insights"><p class="orb-kicker">INSIGHTS</p>${insightsMarkup()}<button type="button" class="life-view-back" data-tracker-action="back">BACK</button></div>`;
    return commandWheelMarkup();
  }

  function selectCommand(id) {
    if (id === 'settings') {
      systemView = 'settings';
      render();
      return;
    }
    trackerView = id;
    if (id === 'entry') trackerDraft = '';
    render();
  }

  function shiftCommand(direction) {
    commandIndex = (commandIndex + direction + COMMANDS.length) % COMMANDS.length;
    if (navigator.vibrate) navigator.vibrate(8);
    render();
  }

  function TrackerOrb() {
    const shell = document.createElement('div'); shell.className='orb-shell life-tracker-shell';
    const orb = document.createElement('div'); orb.className='orb life-tracker-orb'; orb.innerHTML=trackerOrbMarkup();

    const input = orb.querySelector('[data-tracker-input]');
    if (input) {
      input.value = trackerDraft;
      input.addEventListener('input', () => { trackerDraft = input.value; });
      orb.querySelector('[data-tracker-form]')?.addEventListener('submit', e => { e.preventDefault(); if (trackerDraft.trim()) startActivity(trackerDraft); });
    }

    orb.querySelectorAll('[data-tracker-action]').forEach(button => button.addEventListener('click', event => {
      event.stopPropagation(); const action=button.dataset.trackerAction;
      if(action==='stop') stopActivity();
      else if(action==='save-normal') saveNormalActivity();
      else if(action==='skip-save'){lastCompleted=null;trackerView='idle';render();}
      else if(action==='back'){trackerView='idle';render();}
    }));

    orb.querySelectorAll('[data-saved-activity]').forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      startActivity(button.dataset.savedActivity);
    }));

    orb.querySelectorAll('[data-command-shift]').forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      shiftCommand(Number(button.dataset.commandShift));
    }));

    orb.querySelector('[data-command-select]')?.addEventListener('click', event => {
      event.stopPropagation();
      selectCommand(event.currentTarget.dataset.commandSelect);
    });

    if (trackerView === 'idle') {
      orb.addEventListener('pointerdown', (event) => {
        swipeStartY = event.clientY;
        swipeStartX = event.clientX;
      });
      orb.addEventListener('pointerup', (event) => {
        if (swipeStartY === null) return;
        const dy = event.clientY - swipeStartY;
        const dx = event.clientX - swipeStartX;
        swipeStartY = null;
        swipeStartX = null;
        if (Math.abs(dy) < 32 || Math.abs(dy) < Math.abs(dx)) return;
        event.preventDefault();
        shiftCommand(dy < 0 ? 1 : -1);
      });
      orb.addEventListener('pointercancel', () => { swipeStartY = null; swipeStartX = null; });
    }

    shell.append(OrbArtwork(),orb); return shell;
  }

  function startActivity(name){const clean=String(name||'').trim().slice(0,48);if(!clean)return;tracker.active={id:`tracked-${Date.now()}`,name:clean,startedAt:Date.now()};trackerDraft='';trackerView='running';safeWrite(tracker);render();}
  function stopActivity(){if(!tracker.active)return;const endedAt=Date.now();lastCompleted={...tracker.active,endedAt,durationMs:Math.max(0,endedAt-tracker.active.startedAt)};tracker.logs=[...tracker.logs,lastCompleted].slice(-MAX_LOGS);tracker.active=null;safeWrite(tracker);trackerView=tracker.saved.includes(lastCompleted.name)?'idle':'save';render();}
  function saveNormalActivity(){if(lastCompleted?.name&&!tracker.saved.includes(lastCompleted.name)){tracker.saved=[lastCompleted.name,...tracker.saved].slice(0,12);safeWrite(tracker);}lastCompleted=null;trackerView='idle';render();}

  const priorMainScreen=MainScreen;
  MainScreen=function ActivityTrackerMainScreen(){
    clearInterval(elapsedTimer); if(systemView)return priorMainScreen();
    const view=document.createElement('section');view.className='screen main-screen life-tracker-screen';view.appendChild(Brand());
    const stage=document.createElement('div');stage.className='orb-stage';stage.appendChild(TrackerOrb());view.appendChild(stage);
    if(trackerView==='idle') {const hint=document.createElement('p');hint.className='gesture-hint is-visible life-tracker-hint';hint.textContent='SWIPE UP OR DOWN · TAP TO SELECT';view.appendChild(hint);}
    if(trackerView==='running'&&tracker.active)elapsedTimer=setInterval(()=>{const node=document.querySelector('[data-tracker-elapsed]');if(node&&tracker.active)node.textContent=elapsedLabel(tracker.active.startedAt);},1000);
    return view;
  };

  const style=document.createElement('style');style.textContent=`
    .life-tracker-content{width:min(80%,320px);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:.65rem}
    .life-tracker-entry-clean{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.78rem}
    .life-tracker-primary,.life-tracker-secondary,.life-tracker-stop,.life-view-back{font:600 .82rem/1 Inter,ui-sans-serif,sans-serif;letter-spacing:.08em;color:#fff;background:none;border:0;cursor:pointer}
    .life-tracker-primary{padding:.78rem 1.45rem;border-radius:999px;border:1px solid rgba(202,178,255,.38);background:rgba(112,74,255,.12)}
    .life-tracker-secondary,.life-view-back{opacity:.58;padding:.4rem}.life-view-back{font-size:.6rem;letter-spacing:.16em}.life-tracker-stop{margin-top:.15rem;padding:.76rem 1.35rem;border-radius:999px;border:1px solid rgba(255,191,220,.42);background:rgba(255,70,150,.08)}
    .life-tracker-elapsed{margin:.05rem 0 0;color:#fff;font-size:1.55rem;font-weight:520;font-variant-numeric:tabular-nums;letter-spacing:.05em}.life-tracker-caption{margin:-.4rem 0 .1rem;color:rgba(225,215,238,.58);font-size:.58rem;letter-spacing:.22em}.life-tracker-duration{margin:0;color:#fff;font-size:1.3rem}.life-tracker-save-copy{margin:.05rem 0 .2rem;color:rgba(237,231,246,.72);font-size:.88rem}.life-tracker-hint{max-width:min(86vw,430px);text-align:center}
    .life-activity-composer{box-sizing:border-box;width:72%;max-width:280px;display:flex;align-items:center;gap:8px;padding:7px 8px 7px 16px;border:1px solid rgba(202,178,255,.3);border-radius:999px;background:rgba(13,11,24,.52);box-shadow:inset 0 0 22px rgba(108,75,255,.08);overflow:hidden}
    .life-activity-composer input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:#fff;font:500 .95rem/1.2 Inter,ui-sans-serif,sans-serif;text-align:left}.life-activity-composer input::placeholder{color:rgba(225,218,236,.5)}
    .life-activity-composer button{width:36px;height:36px;flex:0 0 36px;border:1px solid rgba(210,190,255,.38);border-radius:50%;background:rgba(125,82,255,.18);color:#fff;font-size:1.05rem;cursor:pointer}
    .life-entry-saved{width:72%;max-width:280px;display:flex;flex-direction:column;align-items:center;gap:.38rem}.life-entry-or{font:520 .48rem/1 Inter,ui-sans-serif,sans-serif;letter-spacing:.2em;color:rgba(226,216,239,.42)}
    .life-entry-saved .life-saved-list{max-height:112px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none}.life-entry-saved .life-saved-list::-webkit-scrollbar{display:none}.life-entry-saved .life-saved-choice{padding:.42rem .45rem;font-size:.68rem}
    .life-command-wheel{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.12rem;touch-action:none;user-select:none}
    .life-command-option{border:0;background:none;color:#fff;font-family:Inter,ui-sans-serif,sans-serif;letter-spacing:.11em;cursor:pointer;transition:opacity .18s ease,transform .18s ease,font-size .18s ease}
    .life-command-option.is-current{min-width:72%;padding:.8rem 1.05rem;border:1px solid rgba(202,178,255,.38);border-radius:999px;background:rgba(112,74,255,.12);font-size:.86rem;font-weight:650;opacity:1;box-shadow:inset 0 0 18px rgba(121,79,255,.08)}
    .life-command-option.is-neighbor{font-size:.64rem;font-weight:520;opacity:.3;padding:.3rem 1rem;transform:scale(.96)}
    .life-command-cue{margin-top:.12rem;font:500 .48rem/1 Inter,ui-sans-serif,sans-serif;letter-spacing:.22em;color:rgba(225,217,238,.28)}
    .life-tracker-history{width:min(82%,330px);gap:.55rem}.life-history-summary{display:flex;flex-direction:column;align-items:center;gap:.14rem;margin-bottom:.08rem}.life-history-summary strong{font-size:1.65rem;font-weight:560;color:#fff}.life-history-summary span{font-size:.54rem;letter-spacing:.18em;color:rgba(226,216,239,.58)}.life-history-summary b{font-size:.7rem;font-weight:520;color:rgba(239,232,248,.8)}
    .life-history-list,.life-saved-list{width:100%;display:flex;flex-direction:column;gap:.22rem}.life-history-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:.42rem .2rem;border-bottom:1px solid rgba(221,205,255,.11);text-align:left}.life-history-row span{min-width:0;display:flex;flex-direction:column;gap:.08rem}.life-history-row strong{max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.72rem;font-weight:560;color:rgba(255,255,255,.94)}.life-history-row small{font-size:.55rem;color:rgba(224,215,236,.48)}.life-history-row b{flex:0 0 auto;font-size:.66rem;font-weight:540;color:rgba(237,230,248,.78)}.life-history-empty{margin:.5rem 0;color:rgba(230,221,241,.58);font-size:.74rem;line-height:1.55}
    .life-saved-choice{width:100%;padding:.52rem .7rem;border:0;border-bottom:1px solid rgba(221,205,255,.11);background:none;color:rgba(255,255,255,.9);font:560 .74rem/1.2 Inter,ui-sans-serif,sans-serif;cursor:pointer;text-align:center}
    .life-tracker-insights{gap:.6rem}.life-insight-card{width:100%;display:flex;flex-direction:column;align-items:center;gap:.12rem;padding:.55rem .35rem;border-bottom:1px solid rgba(221,205,255,.1)}.life-insight-card span{font-size:.5rem;letter-spacing:.18em;color:rgba(226,216,239,.48)}.life-insight-card strong{max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:1.05rem;font-weight:580;color:#fff}.life-insight-card small{font-size:.62rem;color:rgba(235,226,245,.62)}
  `;document.head.appendChild(style);
  window.__LIFE_OS_TRACKER__={getState:()=>JSON.parse(JSON.stringify(tracker)),clear:()=>{tracker={active:null,logs:[],saved:[]};trackerView='idle';lastCompleted=null;commandIndex=0;safeWrite(tracker);render();}};
  render();
})();
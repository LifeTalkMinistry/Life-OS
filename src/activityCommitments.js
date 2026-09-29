import { durationToMinutes, minutesToDisplay, repairKnownActivityTarget } from './activityTargetDurations.js';

/* PAUSE declared Activity commitments.
 * Activity timing stays owned by the ORB. This module owns Activity storage,
 * creation, and the hold-menu entry point.
 */
(() => {
  const PREFIX = 'pause-activity-commitments-v1';
  const USER_KEY = 'pause_backend_user_v1';
  const REST_KEY = 'pause-state-v1';
  const LIMIT = 500;
  let overlay = null;
  let mode = 'hub';
  let tick = null;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  const clean = (value, limit = 48) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, limit);

  function accountId() {
    try {
      const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
      return clean(user?.id ?? user?.user_id ?? user?.userId ?? 'guest', 96) || 'guest';
    } catch {
      return 'guest';
    }
  }

  const key = () => `${PREFIX}:account:${accountId()}`;
  const empty = () => ({ version: 1, activities: [], sessions: [], active: null });

  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(key()) || 'null');
      if (!raw || typeof raw !== 'object') return empty();
      let repaired = false;
      const activities = Array.isArray(raw.activities)
        ? raw.activities
            .filter((item) => item?.id && item?.name)
            .slice(0, 40)
            .map((item) => {
              const next = repairKnownActivityTarget(item);
              if (next !== item) repaired = true;
              return next;
            })
        : [];
      const next = {
        version: 1,
        activities,
        sessions: Array.isArray(raw.sessions) ? raw.sessions.filter((item) => item?.activityId && Number(item.startAt) && Number(item.endAt)).slice(-LIMIT) : [],
        active: raw.active?.activityId && Number(raw.active?.startAt) ? raw.active : null
      };
      if (repaired) {
        try { localStorage.setItem(key(), JSON.stringify(next)); } catch {}
        queueMicrotask(() => window.dispatchEvent(new CustomEvent('pause:activities-changed', { detail: next })));
      }
      return next;
    } catch {
      return empty();
    }
  }

  function write(state) {
    const next = {
      version: 1,
      activities: state.activities.slice(0, 40),
      sessions: state.sessions.slice(-LIMIT),
      active: state.active || null
    };
    try { localStorage.setItem(key(), JSON.stringify(next)); } catch {}
    window.dispatchEvent(new CustomEvent('pause:activities-changed', { detail: next }));
    return next;
  }

  function manilaKey(ms = Date.now()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function midnight(dateKey) {
    const [year, month, day] = String(dateKey).split('-').map(Number);
    return Date.UTC(year, month - 1, day, -8, 0, 0, 0);
  }

  function addDays(dateKey, days) {
    return manilaKey(midnight(dateKey) + Number(days || 0) * 86400000);
  }

  function endDateForPeriod(value, unit) {
    const amount = Math.max(1, Math.min(120, Math.round(Number(value) || 1)));
    const today = manilaKey();
    if (unit === 'months') {
      const [year, month, day] = today.split('-').map(Number);
      return manilaKey(Date.UTC(year, month - 1 + amount, day, -8));
    }
    return addDays(today, amount * 7);
  }

  function clock(ms) {
    const seconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function ended(activity) {
    return Boolean(activity?.endDate && Date.now() >= midnight(addDays(activity.endDate, 1)));
  }

  function restActive() {
    try {
      const id = accountId();
      const accountKey = id === 'guest' ? null : `${REST_KEY}:account:${id}`;
      if (accountKey) {
        const accountRaw = localStorage.getItem(accountKey);
        if (accountRaw !== null) return Boolean(JSON.parse(accountRaw)?.active?.startAt);
      }
      return Boolean(JSON.parse(localStorage.getItem(REST_KEY) || 'null')?.active?.startAt);
    } catch {
      return false;
    }
  }

  function styles() {
    if (document.querySelector('#pause-activity-v1-style')) return;
    const style = document.createElement('style');
    style.id = 'pause-activity-v1-style';
    style.textContent = `
      .pause-activity-menu{left:50%!important;right:auto!important;top:auto!important;bottom:-7%!important;transform:translateX(-50%)!important;width:132px!important}
      .pause-activity-menu:hover{transform:translateX(-50%) scale(1.035)!important}
      .pause-activity-menu small{display:block;margin-top:3px;color:#8d8299;font-size:.52rem;line-height:1.1}
      .pause-activity-menu.is-running{border-color:rgba(205,160,255,.5)!important}
      .activity-backdrop{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:20px;background:rgba(3,3,7,.82);backdrop-filter:blur(14px)}
      .activity-panel{box-sizing:border-box;width:min(94vw,440px);max-height:min(86svh,760px);overflow:auto;padding:22px;border:1px solid rgba(169,124,228,.2);border-radius:22px;background:linear-gradient(180deg,rgba(18,12,31,.98),rgba(7,6,13,.99));box-shadow:0 28px 80px rgba(0,0,0,.55);color:#eee8f5;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
      .activity-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:16px}
      .activity-head p{margin:0 0 6px;color:#8d8299;font-size:.58rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
      .activity-head h2{margin:0;font-size:1.35rem;font-weight:520}
      .activity-close{width:34px;height:34px;border:1px solid rgba(169,124,228,.18);border-radius:50%;background:transparent;color:#aaa0b5;font-size:1rem;cursor:pointer}
      .activity-form{display:grid;gap:17px}
      .activity-field>label,.activity-field>span{display:block;margin-bottom:7px;color:#a79dac;font-size:.66rem}
      .activity-field input[type=text],.activity-field input[type=number],.activity-field input[type=date],.activity-field select{box-sizing:border-box;width:100%;min-height:44px;padding:0 12px;border:1px solid rgba(169,124,228,.18);border-radius:12px;background:rgba(7,5,14,.6);color:#eee8f5;outline:0;color-scheme:dark}
      .activity-field input:focus,.activity-field select:focus{border-color:rgba(190,145,255,.42);background:rgba(12,8,24,.78)}
      .activity-choices{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}
      .activity-choice{position:relative}.activity-choice input{position:absolute;opacity:0}
      .activity-choice span{display:grid;place-items:center;min-height:42px;padding:5px;border:1px solid rgba(169,124,228,.16);border-radius:11px;color:#a9a0b3;font-size:.66rem;text-align:center;cursor:pointer}
      .activity-choice input:checked+span{border-color:rgba(200,155,255,.46);background:rgba(105,62,176,.18);color:#f0eaf5}
      .activity-score-targets{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      .activity-score-target{display:block;padding:13px;border:1px solid rgba(169,124,228,.15);border-radius:14px;background:rgba(17,10,32,.36)}
      .activity-score-target>span{display:block;margin-bottom:5px;color:#a79dac;font-size:.61rem;font-weight:680;letter-spacing:.08em}
      .activity-score-target>small{display:block;margin-top:6px;color:#776e80;font-size:.57rem;line-height:1.35}
      .activity-score-target input{font-variant-numeric:tabular-nums}
      .activity-target-value-row{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;align-items:stretch}
      .activity-target-value-row>input{box-sizing:border-box;width:100%;min-width:0;padding-left:10px!important;padding-right:10px!important}
      .activity-target-unit-select{box-sizing:border-box;width:100%;min-width:0;min-height:36px;padding:0 9px;border:1px solid rgba(169,124,228,.18);border-radius:10px;background:rgba(7,5,14,.68);color:#b9afc3;color-scheme:dark;font:inherit;font-size:.6rem;outline:0;cursor:pointer}
      .activity-target-unit-select:focus{border-color:rgba(190,145,255,.42);background:rgba(12,8,24,.78)}
      .activity-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .activity-help{margin:7px 0 0;color:#736b7b;font-size:.6rem;line-height:1.5}
      .activity-score-explainer{margin:0;padding:12px 13px;border:1px solid rgba(164,121,226,.12);border-radius:12px;background:rgba(85,51,142,.07);color:#8f849a;font-size:.64rem;line-height:1.5}
      .activity-score-explainer strong{color:#c8b8d8;font-weight:600}
      .activity-error{min-height:16px;margin:0;color:#c7a9d9;font-size:.65rem;text-align:center}
      .activity-submit{width:100%;min-height:46px;border:1px solid rgba(169,124,228,.22);border-radius:12px;background:rgba(112,74,255,.16);color:#eee7f5;font-size:.68rem;font-weight:700;cursor:pointer}
      .activity-running{padding:15px;margin-bottom:14px;border:1px solid rgba(205,160,255,.28);border-radius:16px;text-align:center;background:rgba(105,62,176,.09)}
      .activity-running small{display:block;color:#9b90a7;font-size:.57rem;letter-spacing:.14em}.activity-running strong{display:block;margin:5px 0 2px;font-size:1rem}.activity-clock{font-size:1.5rem;font-variant-numeric:tabular-nums}.activity-stop{margin-top:9px;min-height:40px;padding:0 16px;border:1px solid rgba(169,124,228,.18);border-radius:11px;background:rgba(88,53,145,.1);color:#ddd4e7}
      .activity-list{display:grid;gap:8px}.activity-card{display:block;padding:12px;border:1px solid rgba(159,121,218,.14);border-radius:14px;background:rgba(11,8,20,.55)}.activity-card strong{display:block;font-size:.82rem}.activity-empty{margin:18px 0;color:#81798a;font-size:.75rem;text-align:center;line-height:1.55}
      [hidden]{display:none!important}
      @media(max-width:380px){.activity-score-targets{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function menuIcon() {
    return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 8v4l3 2M7 4l-2 2M17 4l2 2"/></svg>';
  }

  function injectMenu() {
    const nav = document.querySelector('.pause-orb-menu');
    if (!nav || nav.querySelector('[data-pause-activity-menu]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pause-menu-node pause-activity-menu';
    button.dataset.pauseActivityMenu = '1';
    button.innerHTML = `<span class="pause-menu-node-icon" aria-hidden="true">${menuIcon()}</span><span class="pause-menu-node-copy"><strong>Activity</strong><small>Manage declared time</small></span>`;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      open('hub');
    });
    nav.appendChild(button);
    refreshMenu();
  }

  function refreshMenu() {
    const button = document.querySelector('[data-pause-activity-menu]');
    if (!button) return;
    const active = read().active;
    button.classList.toggle('is-running', Boolean(active));
    const copy = button.querySelector('.pause-menu-node-copy');
    if (copy) copy.innerHTML = `<strong>Activity</strong><small>${active ? `${esc(active.name)} running` : 'Manage declared time'}</small>`;
  }

  function start(id) {
    if (restActive()) return false;
    const state = read();
    if (state.active) return false;
    const activity = state.activities.find((item) => String(item.id) === String(id));
    if (!activity || ended(activity)) return false;
    state.active = {
      id: `active-${Date.now()}`,
      activityId: activity.id,
      name: activity.name,
      startAt: Date.now()
    };
    write(state);
    render();
    return true;
  }

  function stop() {
    const state = read();
    if (!state.active) return false;
    const endAt = Date.now();
    const active = state.active;
    state.sessions.push({
      id: `session-${endAt}`,
      activityId: active.activityId,
      name: active.name,
      startAt: active.startAt,
      endAt,
      durationMs: Math.max(0, endAt - active.startAt)
    });
    state.active = null;
    write(state);
    render();
    return true;
  }

  function hub(state) {
    return `${state.active ? `<div class="activity-running"><small>ACTIVITY IN PROGRESS</small><strong>${esc(state.active.name)}</strong><div class="activity-clock" data-activity-clock>${clock(Date.now() - state.active.startAt)}</div><button class="activity-stop" data-stop>END ACTIVITY</button></div>` : ''}
      <div class="activity-list">${state.activities.length ? state.activities.map((activity) => `<div class="activity-card"><strong>${esc(activity.name)}</strong></div>`).join('') : '<p class="activity-empty">No activities yet.</p>'}</div>`;
  }

  function addForm() {
    return `<form class="activity-form" data-form>
      <div class="activity-field">
        <label>WHAT ARE YOU COMMITTING TIME TO?</label>
        <input type="text" name="name" maxlength="48" placeholder="Spanish" autocomplete="off" required>
      </div>

      <div class="activity-field">
        <span>HOW SHOULD PAUSE MEASURE IT?</span>
        <div class="activity-choices">
          <label class="activity-choice"><input type="radio" name="targetMode" value="track" checked><span>Track only</span></label>
          <label class="activity-choice"><input type="radio" name="targetMode" value="daily"><span>Daily target</span></label>
          <label class="activity-choice"><input type="radio" name="targetMode" value="weekly"><span>Weekly target</span></label>
          <label class="activity-choice"><input type="radio" name="targetMode" value="total"><span>Total target</span></label>
        </div>
      </div>

      <div data-score-targets hidden>
        <p class="activity-score-explainer"><strong>100%</strong> is the full target. <strong>Passing</strong> is the minimum amount that still counts as meeting your commitment.</p>
        <div class="activity-score-targets" style="margin-top:9px">
          <label class="activity-score-target">
            <span>100% TARGET</span>
            <div class="activity-target-value-row">
              <input type="number" name="targetValue" min="0.25" max="1000" step="0.25" placeholder="2" inputmode="decimal">
              <select class="activity-target-unit-select" name="targetUnit" data-duration-unit data-previous-unit="hours" aria-label="100% target unit"><option value="hours" selected>Hours</option><option value="minutes">Minutes</option></select>
            </div>
            <small data-full-target-unit></small>
          </label>
          <label class="activity-score-target">
            <span>PASSING TARGET</span>
            <div class="activity-target-value-row">
              <input type="number" name="passingValue" min="0.25" max="1000" step="0.25" placeholder="1" inputmode="decimal">
              <select class="activity-target-unit-select" name="passingUnit" data-duration-unit data-previous-unit="hours" aria-label="Passing target unit"><option value="hours" selected>Hours</option><option value="minutes">Minutes</option></select>
            </div>
            <small data-passing-target-unit></small>
          </label>
        </div>
      </div>

      <div class="activity-field">
        <span>HOW LONG IS THIS COMMITMENT?</span>
        <div class="activity-choices">
          <label class="activity-choice"><input type="radio" name="spanMode" value="ongoing" checked><span>Ongoing</span></label>
          <label class="activity-choice"><input type="radio" name="spanMode" value="until"><span>Until a date</span></label>
          <label class="activity-choice"><input type="radio" name="spanMode" value="period"><span>For a period</span></label>
        </div>
      </div>

      <div class="activity-field" data-until hidden><label>END DATE</label><input type="date" name="endDate"></div>
      <div class="activity-field" data-period hidden><label>PERIOD</label><div class="activity-row"><input type="number" name="periodValue" min="1" max="120" value="4"><select name="periodUnit"><option value="weeks">Weeks</option><option value="months">Months</option></select></div></div>
      <p class="activity-error" data-error></p>
      <button class="activity-submit" type="submit">CREATE ACTIVITY</button>
    </form>`;
  }

  function targetCadence(mode) {
    if (mode === 'daily') return 'per day';
    if (mode === 'weekly') return 'per week';
    if (mode === 'total') return 'for this commitment';
    return '';
  }

  function configureDurationInput(input, unit, field) {
    if (!input) return;
    const minutes = unit === 'minutes';
    input.min = minutes ? '15' : '0.25';
    input.max = minutes ? '60000' : '1000';
    input.step = minutes ? '1' : '0.25';
    input.placeholder = minutes ? (field === 'target' ? '120' : '60') : (field === 'target' ? '2' : '1');
  }

  function convertDurationUnit(select) {
    if (!select?.matches?.('[data-duration-unit]')) return;
    const previous = select.dataset.previousUnit === 'minutes' ? 'minutes' : 'hours';
    const next = select.value === 'minutes' ? 'minutes' : 'hours';
    const input = select.closest('.activity-target-value-row')?.querySelector('input[type="number"]');
    if (input && previous !== next && input.value) {
      const canonical = durationToMinutes(input.value, previous);
      if (canonical != null) input.value = String(minutesToDisplay(canonical, next));
    }
    select.dataset.previousUnit = next;
  }

  function syncFields(form) {
    const targetMode = form.querySelector('input[name=targetMode]:checked')?.value || 'track';
    const spanMode = form.querySelector('input[name=spanMode]:checked')?.value || 'ongoing';
    const scoreTargets = form.querySelector('[data-score-targets]');
    if (scoreTargets) scoreTargets.hidden = targetMode === 'track';
    form.querySelector('[data-until]').hidden = spanMode !== 'until';
    form.querySelector('[data-period]').hidden = spanMode !== 'period';
    const cadence = targetCadence(targetMode);
    const fullUnit = form.querySelector('[data-full-target-unit]');
    const passUnit = form.querySelector('[data-passing-target-unit]');
    if (fullUnit) fullUnit.textContent = cadence;
    if (passUnit) passUnit.textContent = cadence;
    configureDurationInput(form.querySelector('input[name="targetValue"]'), form.querySelector('select[name="targetUnit"]')?.value, 'target');
    configureDurationInput(form.querySelector('input[name="passingValue"]'), form.querySelector('select[name="passingUnit"]')?.value, 'passing');
  }

  function saveForm(form) {
    const data = new FormData(form);
    const state = read();
    const error = form.querySelector('[data-error]');
    const name = clean(data.get('name'));
    const targetMode = String(data.get('targetMode') || 'track');
    const spanMode = String(data.get('spanMode') || 'ongoing');
    const targetUnit = data.get('targetUnit') === 'minutes' ? 'minutes' : 'hours';
    const passingUnit = data.get('passingUnit') === 'minutes' ? 'minutes' : 'hours';
    const targetMinutes = durationToMinutes(data.get('targetValue'), targetUnit);
    const passingTargetMinutes = durationToMinutes(data.get('passingValue'), passingUnit);

    if (!name) {
      error.textContent = 'Name the activity you want to document.';
      return;
    }
    if (state.activities.some((activity) => activity.name.toLowerCase() === name.toLowerCase())) {
      error.textContent = 'You already declared an activity with this name.';
      return;
    }
    if (targetMode !== 'track') {
      if (targetMinutes == null || targetMinutes < 15 || targetMinutes > 60000) {
        error.textContent = 'Choose a 100% target between 15 minutes and 1000 hours.';
        return;
      }
      if (passingTargetMinutes == null || passingTargetMinutes < 15 || passingTargetMinutes > targetMinutes) {
        error.textContent = 'Passing must be at least 15 minutes and cannot be higher than your 100% target.';
        return;
      }
    }

    let endDate = null;
    if (spanMode === 'until') {
      endDate = clean(data.get('endDate'), 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || midnight(addDays(endDate, 1)) <= Date.now()) {
        error.textContent = 'Choose a future end date.';
        return;
      }
    } else if (spanMode === 'period') {
      const value = Number(data.get('periodValue'));
      if (!Number.isFinite(value) || value < 1 || value > 120) {
        error.textContent = 'Choose a valid period.';
        return;
      }
      endDate = endDateForPeriod(value, data.get('periodUnit') === 'months' ? 'months' : 'weeks');
    }

    state.activities.unshift({
      id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      targetMode,
      targetMinutes: targetMode === 'track' ? null : targetMinutes,
      passingTargetMinutes: targetMode === 'track' ? null : passingTargetMinutes,
      targetDisplayUnit: targetMode === 'track' ? null : targetUnit,
      passingDisplayUnit: targetMode === 'track' ? null : passingUnit,
      spanMode,
      endDate,
      createdAt: Date.now()
    });
    write(state);
    mode = 'hub';
    render();
  }

  function render() {
    if (!overlay?.isConnected) return;
    clearInterval(tick);
    tick = null;
    const state = read();
    const panel = overlay.querySelector('.activity-panel');
    const title = mode === 'add' ? 'Add Activity' : 'Activities';
    const body = mode === 'add' ? addForm() : hub(state);
    panel.innerHTML = `<div class="activity-head"><div><p>PAUSE · INTENTIONAL EFFORT</p><h2>${title}</h2></div><button class="activity-close" data-close aria-label="Close">×</button></div>${body}`;
    panel.querySelector('[data-close]')?.addEventListener('click', close);
    panel.querySelector('[data-stop]')?.addEventListener('click', stop);
    const form = panel.querySelector('[data-form]');
    if (form) {
      form.addEventListener('change', (event) => {
        convertDurationUnit(event.target?.closest?.('[data-duration-unit]'));
        syncFields(form);
      });
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        saveForm(form);
      });
      syncFields(form);
      queueMicrotask(() => form.querySelector('input[name=name]')?.focus());
    }
    if (state.active) {
      tick = setInterval(() => {
        const node = overlay?.querySelector('[data-activity-clock]');
        const active = read().active;
        if (node && active) node.textContent = clock(Date.now() - active.startAt);
      }, 1000);
    }
  }

  function open(next = 'hub') {
    styles();
    close();
    mode = next;
    overlay = document.createElement('div');
    overlay.className = 'activity-backdrop';
    overlay.innerHTML = '<section class="activity-panel" role="dialog" aria-modal="true" aria-label="PAUSE activities"></section>';
    overlay.addEventListener('pointerdown', (event) => {
      if (event.target === overlay) close();
    });
    document.body.appendChild(overlay);
    render();
  }

  function close() {
    clearInterval(tick);
    tick = null;
    overlay?.remove();
    overlay = null;
    mode = 'hub';
  }

  window.__PAUSE_ACTIVITIES__ = {
    getActivities: () => read().activities.filter((activity) => !ended(activity)).map((activity) => ({ ...activity })),
    getActive: () => {
      const active = read().active;
      return active ? { ...active } : null;
    },
    start,
    stop,
    open
  };

  function init() {
    styles();
    injectMenu();
    new MutationObserver(() => {
      if (overlay?.isConnected && !document.querySelector('#app .pause-main-screen')) close();
      injectMenu();
    }).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('pause:activities-changed', refreshMenu);
    window.addEventListener('storage', (event) => {
      if (event.key?.startsWith(PREFIX) || event.key === USER_KEY) {
        refreshMenu();
        if (overlay?.isConnected) render();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
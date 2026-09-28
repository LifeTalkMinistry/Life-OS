/* Activity status/report parity helpers.
 * - Activity status info expands inline like Rest Insights.
 * - Track-only Activities keep the same progress-row skeleton without a fake score.
 * - The Activity report top-right action opens setup management instead of closing.
 *
 * IMPORTANT: reconciliation is intentionally idempotent. A MutationObserver may call
 * it repeatedly, but an already-decorated report must produce zero further DOM writes.
 */
(() => {
  const STYLE_ID = 'pause-activity-status-inline-style';
  const PREFIX = 'pause-activity-commitments-v1';
  const USER_KEY = 'pause_backend_user_v1';
  let reconcileQueued = false;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function accountId() {
    try {
      const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
      return String(user?.id ?? user?.user_id ?? user?.userId ?? 'guest').trim() || 'guest';
    } catch {
      return 'guest';
    }
  }

  const stateKey = () => `${PREFIX}:account:${accountId()}`;

  function readState() {
    try {
      const raw = JSON.parse(localStorage.getItem(stateKey()) || 'null');
      return raw && typeof raw === 'object'
        ? {
            version: 1,
            activities: Array.isArray(raw.activities) ? raw.activities : [],
            sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
            active: raw.active || null
          }
        : { version: 1, activities: [], sessions: [], active: null };
    } catch {
      return { version: 1, activities: [], sessions: [], active: null };
    }
  }

  function writeState(state) {
    const next = {
      version: 1,
      activities: Array.isArray(state.activities) ? state.activities : [],
      sessions: Array.isArray(state.sessions) ? state.sessions : [],
      active: state.active || null
    };
    try { localStorage.setItem(stateKey(), JSON.stringify(next)); } catch {}
    window.dispatchEvent(new CustomEvent('pause:activities-changed', { detail: next }));
    return next;
  }

  function manilaKey(ms = Date.now()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function ensureStyles() {
    if (document.querySelector(`#${STYLE_ID}`)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .activity-insights-status-help{box-sizing:border-box;width:100%;margin:10px auto 0;padding:12px 14px;border:1px solid rgba(174,126,255,.22);border-radius:11px;background:rgba(15,9,29,.34);color:#9a90a4;font-size:.64rem;font-weight:430;line-height:1.55;text-align:center}
      .activity-insights-status-help[hidden]{display:none}
      .activity-insights-status-line .activity-insights-info[aria-expanded='true']{border-color:rgba(184,142,248,.42);background:rgba(111,69,184,.17);color:#e6dcf0}
      .activity-insights-progress-row.is-track-only .activity-insights-progress-track>span{width:0!important}
      .activity-insights-progress-row.is-track-only>span{color:#776f80}
      .activity-insights-header [data-activity-manage-trigger]{font-size:1rem;font-weight:700;letter-spacing:.08em;line-height:1}
      .activity-manage-root{color:#eee8f5}
      .activity-manage-header{display:grid;grid-template-columns:34px minmax(0,1fr) 34px;align-items:center;gap:10px;min-height:44px;margin-bottom:18px}
      .activity-manage-header h2{overflow:hidden;margin:0;color:#eee8f5;font-size:1.2rem;font-weight:520;line-height:1.2;text-align:center;text-overflow:ellipsis;white-space:nowrap}
      .activity-manage-header button{appearance:none;display:grid;place-items:center;width:30px;height:30px;padding:0;border:1px solid rgba(169,124,228,.18);border-radius:50%;background:transparent;color:#9d93a6;cursor:pointer}
      .activity-manage-header button:last-child{justify-self:end}
      .activity-manage-header button:hover,.activity-manage-header button:focus-visible{border-color:rgba(191,146,255,.36);color:#fff;outline:none}
      .activity-manage-form{display:grid;gap:18px}
      .activity-manage-field>label,.activity-manage-field>span{display:block;margin-bottom:7px;color:#93899d;font-size:.6rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
      .activity-manage-field input[type='text'],.activity-manage-field input[type='number'],.activity-manage-field input[type='date']{box-sizing:border-box;width:100%;min-height:44px;padding:0 12px;border:1px solid rgba(169,124,228,.18);border-radius:12px;background:rgba(7,5,14,.6);color:#eee8f5;color-scheme:dark;outline:0}
      .activity-manage-field input:focus{border-color:rgba(190,145,255,.42);background:rgba(12,8,24,.78)}
      .activity-manage-choices{display:grid;grid-template-columns:1fr 1fr;gap:7px}
      .activity-manage-choice{position:relative}.activity-manage-choice input{position:absolute;opacity:0}
      .activity-manage-choice span{display:grid;place-items:center;min-height:42px;padding:5px 8px;border:1px solid rgba(169,124,228,.16);border-radius:11px;color:#a9a0b3;font-size:.66rem;text-align:center;cursor:pointer}
      .activity-manage-choice input:checked+span{border-color:rgba(200,155,255,.46);background:rgba(105,62,176,.18);color:#f0eaf5}
      .activity-manage-target-wrap[hidden],.activity-manage-until[hidden],.activity-manage-delete-confirm[hidden]{display:none}
      .activity-manage-targets{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      .activity-manage-target{display:block;padding:13px;border:1px solid rgba(169,124,228,.15);border-radius:14px;background:rgba(17,10,32,.36)}
      .activity-manage-target>span{display:block;margin-bottom:6px;color:#a79dac;font-size:.58rem;font-weight:680;letter-spacing:.08em}
      .activity-manage-target small{display:block;margin-top:6px;color:#776e80;font-size:.56rem}
      .activity-manage-explainer{margin:0 0 9px;color:#8f849a;font-size:.63rem;line-height:1.5}
      .activity-manage-error{min-height:16px;margin:0;color:#c7a9d9;font-size:.64rem;text-align:center}
      .activity-manage-save,.activity-manage-delete{width:100%;min-height:44px;border-radius:12px;font-size:.68rem;font-weight:700;cursor:pointer}
      .activity-manage-save{border:1px solid rgba(169,124,228,.24);background:rgba(112,74,255,.16);color:#eee7f5}
      .activity-manage-danger{margin-top:4px;padding-top:18px;border-top:1px solid rgba(155,120,219,.11)}
      .activity-manage-delete{border:1px solid rgba(215,102,127,.2);background:rgba(133,39,62,.08);color:#c89baa}
      .activity-manage-delete-confirm{padding:14px;border:1px solid rgba(215,102,127,.18);border-radius:12px;background:rgba(91,27,43,.09)}
      .activity-manage-delete-confirm p{margin:0 0 12px;color:#aa929b;font-size:.63rem;line-height:1.5}
      .activity-manage-delete-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.activity-manage-delete-actions button{min-height:38px;border-radius:10px;cursor:pointer}
      .activity-manage-delete-cancel{border:1px solid rgba(169,124,228,.16);background:transparent;color:#9c92a6}
      .activity-manage-delete-confirm-button{border:1px solid rgba(215,102,127,.25);background:rgba(133,39,62,.16);color:#d7a9b7}
      @media(max-width:380px){.activity-manage-targets{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function statusButtonFromEvent(event) {
    return event.target?.closest?.('.activity-insights-status-line .activity-insights-info') || null;
  }

  function getOrCreateHelp(card, button) {
    let help = card.querySelector(':scope > .activity-insights-status-help');
    if (help) return help;
    help = document.createElement('p');
    help.className = 'activity-insights-status-help';
    help.dataset.activityStatusHelp = '';
    help.textContent = String(button.getAttribute('title') || '').trim() || 'Activity status reflects the time recorded for this activity.';
    help.hidden = true;
    const main = card.querySelector('.activity-insights-status-main');
    if (main) main.insertAdjacentElement('afterend', help);
    else card.prepend(help);
    return help;
  }

  function toggleInlineStatus(button) {
    const card = button.closest('.activity-insights-status-card');
    if (!card) return;
    document.querySelector('[data-pause-info-popover-layer]')?.remove();
    const help = getOrCreateHelp(card, button);
    const opening = help.hidden;
    help.hidden = !opening;
    button.setAttribute('aria-expanded', opening ? 'true' : 'false');
  }

  function reconcileTrackOnlyProgress() {
    document.querySelectorAll('.activity-insights-status-card .activity-insights-unscored').forEach((note) => {
      const card = note.closest('.activity-insights-status-card');
      if (!card || card.querySelector('[data-activity-track-only-progress]')) return;
      const row = document.createElement('div');
      row.className = 'activity-insights-progress-row is-track-only';
      row.dataset.activityTrackOnlyProgress = '';
      row.setAttribute('aria-label', 'Track-only activity. No score is assigned.');
      row.innerHTML = '<div class="activity-insights-progress-track" aria-hidden="true"><span style="width:0%"></span></div><span aria-hidden="true">—</span>';
      note.replaceWith(row);
    });
  }

  function decorateManageTrigger() {
    document.querySelectorAll('.activity-panel[data-activity-report-view]:not([data-activity-manage-view]) .activity-insights-header [data-activity-insights-close]:not([data-activity-manage-trigger])').forEach((button) => {
      // One write pass only. The :not([data-activity-manage-trigger]) guard makes
      // repeated MutationObserver reconciliation a no-op after this point.
      button.dataset.activityManageTrigger = '1';
      button.setAttribute('aria-label', 'Manage activity');
      button.setAttribute('title', 'Manage activity');
      if (button.textContent !== '⋯') button.textContent = '⋯';
    });
  }

  function queueReconcile() {
    if (reconcileQueued) return;
    reconcileQueued = true;
    queueMicrotask(() => {
      reconcileQueued = false;
      reconcileTrackOnlyProgress();
      decorateManageTrigger();
    });
  }

  function currentActivity(panel) {
    const id = String(panel?.dataset?.activityReportId || '');
    const state = readState();
    return { state, id, activity: state.activities.find((item) => String(item?.id) === id) || null };
  }

  function targetUnit(mode) {
    if (mode === 'daily') return 'hours / day';
    if (mode === 'weekly') return 'hours / week';
    if (mode === 'total') return 'total hours';
    return 'hours';
  }

  function returnToReport(panel, activityId) {
    if (!panel) return;
    delete panel.dataset.activityManageView;
    panel.dataset.activityReportView = '1';
    panel.dataset.activityReportId = String(activityId);
    panel.innerHTML = '';
    panel.scrollTop = 0;
  }

  function closeActivityOverlay() {
    document.querySelector('.activity-backdrop')?.remove();
  }

  function renderManage(panel) {
    const { id, activity } = currentActivity(panel);
    if (!activity) return;
    const mode = activity.targetMode && activity.targetMode !== 'track' ? activity.targetMode : 'track';
    const targetHours = Number(activity.targetMinutes || 0) / 60;
    const passingHours = Number(activity.passingTargetMinutes || 0) / 60;
    const hasEnd = Boolean(activity.endDate);

    panel.dataset.activityManageView = '1';
    panel.scrollTop = 0;
    panel.innerHTML = `<div class="activity-manage-root" data-activity-refined-root>
      <header class="activity-manage-header">
        <button type="button" data-activity-manage-back aria-label="Back to activity report">←</button>
        <h2>Activity Setup</h2>
        <button type="button" data-activity-manage-close aria-label="Close">×</button>
      </header>
      <form class="activity-manage-form" data-activity-manage-form>
        <div class="activity-manage-field"><label>Activity name</label><input type="text" name="name" maxlength="48" value="${esc(activity.name)}" required></div>
        <div class="activity-manage-field"><span>How should PAUSE measure it?</span><div class="activity-manage-choices">
          ${[['track','Track only'],['daily','Daily target'],['weekly','Weekly target'],['total','Total target']].map(([value,label]) => `<label class="activity-manage-choice"><input type="radio" name="targetMode" value="${value}"${mode === value ? ' checked' : ''}><span>${label}</span></label>`).join('')}
        </div></div>
        <div class="activity-manage-field activity-manage-target-wrap" data-activity-manage-target-wrap ${mode === 'track' ? 'hidden' : ''}>
          <p class="activity-manage-explainer">Set what counts as <strong>100%</strong> and the minimum that still counts as <strong>passing</strong>.</p>
          <div class="activity-manage-targets">
            <label class="activity-manage-target"><span>100% TARGET</span><input type="number" name="targetHours" min="0.01" max="1000" step="0.01" value="${targetHours || ''}" inputmode="decimal"><small data-activity-target-unit>${targetUnit(mode)}</small></label>
            <label class="activity-manage-target"><span>PASSING TARGET</span><input type="number" name="passingHours" min="0.01" max="1000" step="0.01" value="${passingHours || ''}" inputmode="decimal"><small data-activity-passing-unit>${targetUnit(mode)}</small></label>
          </div>
        </div>
        <div class="activity-manage-field"><span>How long is this commitment?</span><div class="activity-manage-choices">
          <label class="activity-manage-choice"><input type="radio" name="spanMode" value="ongoing"${hasEnd ? '' : ' checked'}><span>Ongoing</span></label>
          <label class="activity-manage-choice"><input type="radio" name="spanMode" value="until"${hasEnd ? ' checked' : ''}><span>Until a date</span></label>
        </div></div>
        <div class="activity-manage-field activity-manage-until" data-activity-manage-until ${hasEnd ? '' : 'hidden'}><label>End date</label><input type="date" name="endDate" min="${manilaKey()}" value="${esc(activity.endDate || '')}"></div>
        <p class="activity-manage-error" data-activity-manage-error aria-live="polite"></p>
        <button type="submit" class="activity-manage-save">SAVE CHANGES</button>
        <div class="activity-manage-danger">
          <button type="button" class="activity-manage-delete" data-activity-manage-delete>DELETE ACTIVITY</button>
          <div class="activity-manage-delete-confirm" data-activity-manage-delete-confirm hidden><p>Delete <strong>${esc(activity.name)}</strong> and its tracked Activity history? This cannot be undone.</p><div class="activity-manage-delete-actions"><button type="button" class="activity-manage-delete-cancel" data-activity-manage-delete-cancel>Cancel</button><button type="button" class="activity-manage-delete-confirm-button" data-activity-manage-delete-confirm-button>Delete permanently</button></div></div>
        </div>
      </form>
    </div>`;

    const form = panel.querySelector('[data-activity-manage-form]');
    const targetWrap = panel.querySelector('[data-activity-manage-target-wrap]');
    const untilWrap = panel.querySelector('[data-activity-manage-until]');
    const error = panel.querySelector('[data-activity-manage-error]');

    const refreshTargetMode = () => {
      const selected = form?.querySelector('input[name="targetMode"]:checked')?.value || 'track';
      if (targetWrap) targetWrap.hidden = selected === 'track';
      panel.querySelectorAll('[data-activity-target-unit],[data-activity-passing-unit]').forEach((node) => { node.textContent = targetUnit(selected); });
    };
    const refreshSpanMode = () => {
      const selected = form?.querySelector('input[name="spanMode"]:checked')?.value || 'ongoing';
      if (untilWrap) untilWrap.hidden = selected !== 'until';
    };

    form?.querySelectorAll('input[name="targetMode"]').forEach((input) => input.addEventListener('change', refreshTargetMode));
    form?.querySelectorAll('input[name="spanMode"]').forEach((input) => input.addEventListener('change', refreshSpanMode));
    panel.querySelector('[data-activity-manage-back]')?.addEventListener('click', () => returnToReport(panel, id));
    panel.querySelector('[data-activity-manage-close]')?.addEventListener('click', closeActivityOverlay);

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = new FormData(form);
      const name = String(values.get('name') || '').trim().replace(/\s+/g, ' ').slice(0, 48);
      const targetMode = String(values.get('targetMode') || 'track');
      const spanMode = String(values.get('spanMode') || 'ongoing');
      const targetHoursValue = Number(values.get('targetHours'));
      const passingHoursValue = Number(values.get('passingHours'));
      const endDate = String(values.get('endDate') || '');

      if (!name) { if (error) error.textContent = 'Enter an activity name.'; return; }
      if (targetMode !== 'track') {
        if (!Number.isFinite(targetHoursValue) || targetHoursValue <= 0 || !Number.isFinite(passingHoursValue) || passingHoursValue <= 0) {
          if (error) error.textContent = 'Set both the 100% target and passing target.';
          return;
        }
        if (passingHoursValue > targetHoursValue) { if (error) error.textContent = 'Passing target cannot be higher than the 100% target.'; return; }
      }
      if (spanMode === 'until' && (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < manilaKey())) {
        if (error) error.textContent = 'Choose a valid end date.';
        return;
      }

      const latest = readState();
      const index = latest.activities.findIndex((item) => String(item?.id) === id);
      if (index < 0) returnToReport(panel, id);
      latest.activities[index] = {
        ...latest.activities[index],
        name,
        targetMode,
        targetMinutes: targetMode === 'track' ? null : Math.round(targetHoursValue * 60),
        passingTargetMinutes: targetMode === 'track' ? null : Math.round(passingHoursValue * 60),
        spanMode: spanMode === 'until' ? 'until' : 'ongoing',
        endDate: spanMode === 'until' ? endDate : null
      };
      latest.sessions = latest.sessions.map((session) => String(session?.activityId) === id ? { ...session, name } : session);
      if (String(latest.active?.activityId) === id) latest.active = { ...latest.active, name };
      writeState(latest);
      returnToReport(panel, id);
    });

    const deleteButton = panel.querySelector('[data-activity-manage-delete]');
    const deleteConfirm = panel.querySelector('[data-activity-manage-delete-confirm]');
    deleteButton?.addEventListener('click', () => {
      const latest = readState();
      if (String(latest.active?.activityId) === id) { if (error) error.textContent = 'End this activity before deleting it.'; return; }
      deleteButton.hidden = true;
      if (deleteConfirm) deleteConfirm.hidden = false;
    });
    panel.querySelector('[data-activity-manage-delete-cancel]')?.addEventListener('click', () => {
      if (deleteConfirm) deleteConfirm.hidden = true;
      if (deleteButton) deleteButton.hidden = false;
    });
    panel.querySelector('[data-activity-manage-delete-confirm-button]')?.addEventListener('click', () => {
      const latest = readState();
      if (String(latest.active?.activityId) === id) { if (error) error.textContent = 'End this activity before deleting it.'; return; }
      latest.activities = latest.activities.filter((item) => String(item?.id) !== id);
      latest.sessions = latest.sessions.filter((session) => String(session?.activityId) !== id);
      writeState(latest);
      closeActivityOverlay();
      queueMicrotask(() => window.__PAUSE_ACTIVITIES__?.open?.('hub'));
    });
  }

  function manageButtonFromEvent(event) {
    return event.target?.closest?.('.activity-panel[data-activity-report-view]:not([data-activity-manage-view]) [data-activity-manage-trigger]') || null;
  }

  function onClick(event) {
    const manageButton = manageButtonFromEvent(event);
    if (manageButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const panel = manageButton.closest('.activity-panel');
      if (panel) renderManage(panel);
      return;
    }

    const button = statusButtonFromEvent(event);
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleInlineStatus(button);
  }

  function onKeyDown(event) {
    const manageButton = manageButtonFromEvent(event);
    if (manageButton && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const panel = manageButton.closest('.activity-panel');
      if (panel) renderManage(panel);
      return;
    }

    const button = statusButtonFromEvent(event);
    if (!button || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleInlineStatus(button);
  }

  function init() {
    ensureStyles();
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    new MutationObserver((records) => {
      // Only structural additions can introduce a new report/status element.
      // Attribute mutations are intentionally ignored so reconciliation cannot self-loop.
      if (records.some((record) => record.addedNodes?.length)) queueReconcile();
    }).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('pause:activities-changed', queueReconcile);
    queueReconcile();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

/* Activity session edit/delete support for the Activity daily audit.
 * Mirrors the Rest daily-audit editing pattern while keeping Activity data separate.
 * Historical Activity sessions can be edited or deleted; an active timer is never
 * exposed to these controls.
 */
(() => {
  const STYLE_ID = 'pause-activity-session-edit-style';
  const PREFIX = 'pause-activity-commitments-v1';
  const USER_KEY = 'pause_backend_user_v1';
  const DAY_MS = 86_400_000;
  let scanQueued = false;

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
      const parsed = JSON.parse(localStorage.getItem(stateKey()) || 'null');
      return parsed && typeof parsed === 'object'
        ? {
            version: 1,
            activities: Array.isArray(parsed.activities) ? parsed.activities : [],
            sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
            active: parsed.active || null
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

  function dayStart(key) {
    const [year, month, day] = String(key).split('-').map(Number);
    if (![year, month, day].every(Number.isFinite)) return NaN;
    return Date.UTC(year, month - 1, day, -8, 0, 0, 0);
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function inputValue(ms) {
    const stamp = Number(ms);
    if (!Number.isFinite(stamp)) return '';
    const key = manilaKey(stamp);
    const start = dayStart(key);
    if (!Number.isFinite(start)) return '';
    const minutes = Math.max(0, Math.min(1439, Math.floor((stamp - start) / 60_000)));
    return `${key}T${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
  }

  function parseInput(value) {
    const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/);
    if (!match) return NaN;
    const start = dayStart(match[1]);
    const hours = Number(match[2]);
    const minutes = Number(match[3]);
    if (!Number.isFinite(start) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;
    return start + hours * 3_600_000 + minutes * 60_000;
  }

  function duration(ms) {
    const totalSeconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
    if (totalSeconds < 60) return `${totalSeconds} sec`;
    const totalMinutes = Math.round(totalSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (!hours) return `${minutes}m`;
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  function parseAuditDayKey(panel) {
    const text = String(panel?.querySelector('.activity-insights-day-card>p')?.textContent || '').trim();
    const dateText = text.includes('·') ? text.split('·').slice(1).join('·').trim() : '';
    const match = dateText.match(/^([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})$/);
    if (!match) return '';
    const months = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
    const month = months[match[1]];
    return month ? `${match[3]}-${pad2(month)}-${pad2(match[2])}` : '';
  }

  function overlap(startAt, endAt, rangeStart, rangeEnd) {
    return Math.max(0, Math.min(Number(endAt), rangeEnd) - Math.max(Number(startAt), rangeStart));
  }

  function sessionsForDay(state, activityId, key, now = Date.now()) {
    const sessions = (Array.isArray(state.sessions) ? state.sessions : [])
      .filter((session) => String(session?.activityId) === String(activityId))
      .map((session) => ({ ...session, startAt: Number(session.startAt), endAt: Number(session.endAt), live: false }))
      .filter((session) => Number.isFinite(session.startAt) && Number.isFinite(session.endAt) && session.endAt >= session.startAt)
      .sort((a, b) => b.endAt - a.endAt);

    if (String(state.active?.activityId) === String(activityId) && Number(state.active?.startAt)) {
      sessions.unshift({ ...state.active, startAt: Number(state.active.startAt), endAt: now, live: true });
    }

    const start = dayStart(key);
    const end = Math.min(start + DAY_MS, now);
    return sessions.filter((session) => overlap(session.startAt, session.endAt, start, end) > 0);
  }

  function ensureStyles() {
    if (document.querySelector(`#${STYLE_ID}`)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .activity-session-row-tail{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex:0 0 auto}
      .activity-session-edit-button{appearance:none;min-height:28px;padding:0 9px;border:1px solid rgba(169,124,228,.18);border-radius:8px;background:rgba(93,55,153,.09);color:#a89daf;font-size:.55rem;font-weight:700;letter-spacing:.06em;cursor:pointer}
      .activity-session-edit-button:hover,.activity-session-edit-button:focus-visible{border-color:rgba(188,142,251,.34);background:rgba(105,62,176,.15);color:#eee7f5;outline:none}
      .activity-session-editor{display:grid;gap:11px;padding:2px 0 5px}
      .activity-session-editor-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .activity-session-editor-head strong{color:#e6deed!important;font-size:.72rem!important;font-weight:560!important}
      .activity-session-editor-head span{color:#776f80;font-size:.52rem;font-weight:700;letter-spacing:.11em}
      .activity-session-edit-grid{display:grid;gap:10px}
      .activity-session-edit-field{display:grid;gap:6px}
      .activity-session-edit-field>span{color:#81778a;font-size:.54rem;font-weight:700;letter-spacing:.11em}
      .activity-session-edit-field input{box-sizing:border-box;width:100%;min-height:40px;padding:0 10px;border:1px solid rgba(169,124,228,.2);border-radius:10px;background:rgba(8,5,15,.68);color:#e9e2ef;color-scheme:dark;font-size:.64rem;outline:none}
      .activity-session-edit-field input:focus{border-color:rgba(190,145,255,.42);background:rgba(12,8,24,.8)}
      .activity-session-edit-duration{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid rgba(155,120,219,.1);border-bottom:1px solid rgba(155,120,219,.1);color:#887f91;font-size:.6rem}
      .activity-session-edit-duration strong{color:#c8a9f6!important;font-size:.68rem!important;font-weight:560!important}
      .activity-session-edit-error{min-height:12px;margin:0!important;color:#c79bb1!important;font-size:.57rem!important;line-height:1.4}
      .activity-session-edit-actions{display:grid;grid-template-columns:minmax(84px,1fr) auto auto;align-items:center;gap:7px}
      .activity-session-edit-actions button{appearance:none;min-height:36px;padding:0 10px;border-radius:9px;font-size:.57rem;font-weight:700;white-space:nowrap;cursor:pointer}
      .activity-session-delete{justify-self:start;border:1px solid rgba(210,92,121,.2);background:rgba(125,34,57,.08);color:#c89aa9}
      .activity-session-cancel{border:1px solid rgba(169,124,228,.16);background:transparent;color:#978da0}
      .activity-session-save{border:1px solid rgba(169,124,228,.25);background:rgba(112,74,255,.16);color:#eee7f5}
      .activity-session-delete:hover,.activity-session-delete:focus-visible{border-color:rgba(222,111,139,.36);background:rgba(125,34,57,.14);color:#ddb0bd;outline:none}
      .activity-session-cancel:hover,.activity-session-cancel:focus-visible,.activity-session-save:hover,.activity-session-save:focus-visible{outline:none;color:#fff}
      .activity-session-delete-confirm{padding:11px;border:1px solid rgba(210,92,121,.18);border-radius:10px;background:rgba(96,26,44,.1)}
      .activity-session-delete-confirm[hidden]{display:none}
      .activity-session-delete-confirm p{margin:0 0 10px!important;color:#a99099!important;font-size:.59rem!important;line-height:1.45}
      .activity-session-delete-confirm-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}
      .activity-session-delete-confirm-actions button{min-height:35px;border-radius:8px;font-size:.56rem;font-weight:700;cursor:pointer}
      .activity-session-delete-keep{border:1px solid rgba(158,123,205,.16);background:transparent;color:#978da0}
      .activity-session-delete-final{border:1px solid rgba(218,101,131,.26);background:rgba(135,40,64,.15);color:#d8a8b6}
      @media(max-width:360px){.activity-session-edit-actions{grid-template-columns:1fr 1fr}.activity-session-delete{grid-column:1/-1;width:100%}.activity-session-cancel,.activity-session-save{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function refreshDayAudit(panel, dayKey) {
    const back = panel?.querySelector('[data-activity-insights-back]');
    if (!back || !dayKey) return;
    back.click();
    queueMicrotask(() => {
      const dayButton = panel.querySelector(`[data-activity-day="${dayKey}"]`);
      if (dayButton) dayButton.click();
    });
  }

  function updatePreview(form) {
    const error = form.querySelector('[data-activity-session-edit-error]');
    const preview = form.querySelector('[data-activity-session-edit-duration]');
    const startAt = parseInput(form.elements.startAt?.value);
    const endAt = parseInput(form.elements.endAt?.value);
    if (error) error.textContent = '';
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) {
      if (preview) preview.textContent = '—';
      return false;
    }
    if (endAt <= startAt) {
      if (preview) preview.textContent = '—';
      if (error) error.textContent = 'End time must be after the start time.';
      return false;
    }
    if (endAt > Date.now() + 60_000 || startAt > Date.now() + 60_000) {
      if (preview) preview.textContent = '—';
      if (error) error.textContent = 'Activity time cannot be in the future.';
      return false;
    }
    if (preview) preview.textContent = duration(endAt - startAt);
    return true;
  }

  function editorMarkup(session, dayKey) {
    const max = inputValue(Date.now());
    return `<form class="activity-session-editor" data-activity-session-edit-form data-session-id="${esc(session.id)}" data-day-key="${esc(dayKey)}">
      <div class="activity-session-editor-head"><strong>Activity Session</strong><span>ENDED</span></div>
      <div class="activity-session-edit-grid">
        <label class="activity-session-edit-field"><span>ACTUAL START · MANILA</span><input type="datetime-local" name="startAt" step="60" max="${esc(max)}" value="${esc(inputValue(session.startAt))}" required></label>
        <label class="activity-session-edit-field"><span>ACTUAL END · MANILA</span><input type="datetime-local" name="endAt" step="60" max="${esc(max)}" value="${esc(inputValue(session.endAt))}" required></label>
      </div>
      <div class="activity-session-edit-duration"><span>Actual activity time</span><strong data-activity-session-edit-duration>${esc(duration(session.endAt - session.startAt))}</strong></div>
      <p class="activity-session-edit-error" data-activity-session-edit-error aria-live="polite"></p>
      <div class="activity-session-edit-actions">
        <button type="button" class="activity-session-delete" data-activity-session-delete>Delete Session</button>
        <button type="button" class="activity-session-cancel" data-activity-session-cancel>Cancel</button>
        <button type="submit" class="activity-session-save">Save Changes</button>
      </div>
      <div class="activity-session-delete-confirm" data-activity-session-delete-confirm hidden>
        <p>Delete this Activity session? It will be removed from this Activity’s history and its totals and score will be recalculated.</p>
        <div class="activity-session-delete-confirm-actions">
          <button type="button" class="activity-session-delete-keep" data-activity-session-delete-keep>Keep Session</button>
          <button type="button" class="activity-session-delete-final" data-activity-session-delete-final>Delete Permanently</button>
        </div>
      </div>
    </form>`;
  }

  function findSession(state, activityId, sessionId) {
    return (Array.isArray(state.sessions) ? state.sessions : []).find((session) =>
      String(session?.activityId) === String(activityId) && String(session?.id) === String(sessionId)
    ) || null;
  }

  function openEditor(button) {
    const article = button.closest('article[data-activity-session-id]');
    const panel = button.closest('.activity-panel');
    const activityId = String(panel?.dataset?.activityReportId || '');
    const sessionId = String(article?.dataset?.activitySessionId || '');
    const dayKey = parseAuditDayKey(panel);
    const state = readState();
    const session = findSession(state, activityId, sessionId);
    if (!article || !session || !dayKey) return;
    article.innerHTML = editorMarkup(session, dayKey);
    updatePreview(article.querySelector('[data-activity-session-edit-form]'));
  }

  function saveEditor(form) {
    const panel = form.closest('.activity-panel');
    const activityId = String(panel?.dataset?.activityReportId || '');
    const sessionId = String(form.dataset.sessionId || '');
    const dayKey = String(form.dataset.dayKey || '');
    if (!updatePreview(form)) return;

    const startAt = parseInput(form.elements.startAt.value);
    const endAt = parseInput(form.elements.endAt.value);
    const state = readState();
    const index = state.sessions.findIndex((session) =>
      String(session?.activityId) === activityId && String(session?.id) === sessionId
    );
    if (index < 0) {
      const error = form.querySelector('[data-activity-session-edit-error]');
      if (error) error.textContent = 'This Activity session could not be found.';
      return;
    }

    state.sessions[index] = {
      ...state.sessions[index],
      startAt,
      endAt,
      durationMs: Math.max(0, endAt - startAt)
    };
    writeState(state);
    refreshDayAudit(panel, dayKey);
  }

  function deleteSession(form) {
    const panel = form.closest('.activity-panel');
    const activityId = String(panel?.dataset?.activityReportId || '');
    const sessionId = String(form.dataset.sessionId || '');
    const dayKey = String(form.dataset.dayKey || '');
    const state = readState();
    const nextSessions = state.sessions.filter((session) => !(
      String(session?.activityId) === activityId && String(session?.id) === sessionId
    ));
    if (nextSessions.length === state.sessions.length) {
      const error = form.querySelector('[data-activity-session-edit-error]');
      if (error) error.textContent = 'This Activity session could not be found.';
      return;
    }
    state.sessions = nextSessions;
    writeState(state);
    refreshDayAudit(panel, dayKey);
  }

  function enhancePanel(panel) {
    const dayKey = parseAuditDayKey(panel);
    const activityId = String(panel?.dataset?.activityReportId || '');
    const card = panel?.querySelector('.activity-insights-sessions-card');
    if (!dayKey || !activityId || !card) return;

    const sessions = sessionsForDay(readState(), activityId, dayKey);
    const articles = [...card.querySelectorAll(':scope > article')];
    articles.forEach((article, index) => {
      if (article.dataset.activitySessionEditEnhanced === '1') return;
      article.dataset.activitySessionEditEnhanced = '1';
      const session = sessions[index];
      if (!session || session.live || !session.id) return;
      article.dataset.activitySessionId = String(session.id);
      const head = article.querySelector(':scope > div');
      const durationNode = head?.querySelector('b');
      if (!head || !durationNode) return;

      const tail = document.createElement('span');
      tail.className = 'activity-session-row-tail';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'activity-session-edit-button';
      button.dataset.activitySessionEdit = '';
      button.textContent = 'EDIT';
      button.setAttribute('aria-label', `Edit Activity session from ${inputValue(session.startAt)}`);
      durationNode.replaceWith(tail);
      tail.append(durationNode, button);
    });
  }

  function scan() {
    scanQueued = false;
    ensureStyles();
    document.querySelectorAll('.activity-panel[data-activity-report-view] .activity-insights-day-card').forEach((dayCard) => {
      const panel = dayCard.closest('.activity-panel');
      if (panel) enhancePanel(panel);
    });
  }

  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    queueMicrotask(scan);
  }

  function onClick(event) {
    const edit = event.target?.closest?.('[data-activity-session-edit]');
    if (edit) {
      event.preventDefault();
      openEditor(edit);
      return;
    }

    const cancel = event.target?.closest?.('[data-activity-session-cancel]');
    if (cancel) {
      const form = cancel.closest('[data-activity-session-edit-form]');
      const panel = form?.closest('.activity-panel');
      if (form && panel) refreshDayAudit(panel, String(form.dataset.dayKey || ''));
      return;
    }

    const remove = event.target?.closest?.('[data-activity-session-delete]');
    if (remove) {
      const form = remove.closest('[data-activity-session-edit-form]');
      const confirm = form?.querySelector('[data-activity-session-delete-confirm]');
      remove.hidden = true;
      if (confirm) confirm.hidden = false;
      return;
    }

    const keep = event.target?.closest?.('[data-activity-session-delete-keep]');
    if (keep) {
      const form = keep.closest('[data-activity-session-edit-form]');
      const confirm = form?.querySelector('[data-activity-session-delete-confirm]');
      const removeButton = form?.querySelector('[data-activity-session-delete]');
      if (confirm) confirm.hidden = true;
      if (removeButton) removeButton.hidden = false;
      return;
    }

    const final = event.target?.closest?.('[data-activity-session-delete-final]');
    if (final) {
      const form = final.closest('[data-activity-session-edit-form]');
      if (form) deleteSession(form);
    }
  }

  function onSubmit(event) {
    const form = event.target?.closest?.('[data-activity-session-edit-form]');
    if (!form) return;
    event.preventDefault();
    saveEditor(form);
  }

  function onInput(event) {
    const form = event.target?.closest?.('[data-activity-session-edit-form]');
    if (form) updatePreview(form);
  }

  function init() {
    ensureStyles();
    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('input', onInput);
    window.addEventListener('pause:activities-changed', queueScan);
    new MutationObserver((records) => {
      if (records.some((record) => record.addedNodes?.length)) queueScan();
    }).observe(document.documentElement, { childList: true, subtree: true });
    queueScan();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

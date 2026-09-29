import { savePauseState } from './restState.js';

/* Daily Audit delete support.
 * Adds a destructive option only while an existing rest entry is in edit mode.
 * Deletion removes the underlying history entry, then reopens the same Manila day
 * so totals, entry count, credited rest, and score are recalculated by PAUSE.
 */
(() => {
  const STYLE_ID = 'pause-rest-audit-delete-style';
  let scanQueued = false;

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function parseAuditDayKey(panel) {
    const title = String(panel?.querySelector('.system-panel-header h2')?.textContent || '').trim();
    const match = title.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})$/);
    if (!match) return null;
    const months = {
      January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
      July: 7, August: 8, September: 9, October: 10, November: 11, December: 12
    };
    return `${match[3]}-${pad2(months[match[1]])}-${pad2(match[2])}`;
  }

  function historyEntryKey(entry) {
    const explicitId = String(entry?.id || '').trim();
    if (explicitId) return explicitId;

    const startAt = Number(entry?.startAt ?? entry?.endedAt);
    if (!Number.isFinite(startAt)) return '';
    const explicitEndAt = Number(entry?.endedAt);
    const durationMs = Math.max(0, Number(entry?.durationMs || entry?.sessionDurationMs || 0));
    const endedAt = Number.isFinite(explicitEndAt) && explicitEndAt >= startAt
      ? explicitEndAt
      : startAt + durationMs;
    return `rest-${startAt}-${endedAt}`;
  }

  function ensureStyles() {
    if (document.querySelector(`#${STYLE_ID}`)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .pause-audit-delete-zone{margin-top:12px;padding-top:12px;border-top:1px solid rgba(188,98,125,.12)}
      .pause-audit-delete-trigger{appearance:none;width:100%;min-height:40px;border:1px solid rgba(210,92,121,.2);border-radius:10px;background:rgba(125,34,57,.08);color:#c89aa9;font-size:.62rem;font-weight:700;letter-spacing:.04em;cursor:pointer}
      .pause-audit-delete-trigger:hover,.pause-audit-delete-trigger:focus-visible{border-color:rgba(222,111,139,.36);background:rgba(125,34,57,.14);color:#ddb0bd;outline:none}
      .pause-audit-delete-confirm{margin-top:10px;padding:12px;border:1px solid rgba(210,92,121,.18);border-radius:11px;background:rgba(96,26,44,.1)}
      .pause-audit-delete-confirm[hidden]{display:none}
      .pause-audit-delete-confirm p{margin:0 0 11px;color:#a99099;font-size:.62rem;line-height:1.5}
      .pause-audit-delete-confirm-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .pause-audit-delete-confirm-actions button{appearance:none;min-height:38px;border-radius:9px;font-size:.6rem;font-weight:700;cursor:pointer}
      .pause-audit-delete-keep{border:1px solid rgba(158,123,205,.16);background:transparent;color:#978da0}
      .pause-audit-delete-final{border:1px solid rgba(218,101,131,.26);background:rgba(135,40,64,.15);color:#d8a8b6}
      .pause-audit-delete-keep:hover,.pause-audit-delete-keep:focus-visible,.pause-audit-delete-final:hover,.pause-audit-delete-final:focus-visible{outline:none;color:#f0e8f3}
    `;
    document.head.appendChild(style);
  }

  function markup() {
    return `
      <div class="pause-audit-delete-zone" data-pause-audit-delete-zone>
        <button type="button" class="pause-audit-delete-trigger" data-pause-audit-delete-trigger>Delete Rest</button>
        <div class="pause-audit-delete-confirm" data-pause-audit-delete-confirm hidden>
          <p>Delete this rest entry? It will be removed from your rest history and this day’s score and totals will be recalculated.</p>
          <div class="pause-audit-delete-confirm-actions">
            <button type="button" class="pause-audit-delete-keep" data-pause-audit-delete-keep>Keep Rest</button>
            <button type="button" class="pause-audit-delete-final" data-pause-audit-delete-final>Delete Permanently</button>
          </div>
        </div>
      </div>
    `;
  }

  function enhanceForm(form) {
    if (!form || form.dataset.pauseAuditDeleteEnhanced === '1') return;
    form.dataset.pauseAuditDeleteEnhanced = '1';
    const actions = form.querySelector('.pause-audit-edit-actions');
    if (!actions) return;
    actions.insertAdjacentHTML('afterend', markup());
  }

  function scan() {
    scanQueued = false;
    ensureStyles();
    document.querySelectorAll('.pause-view-insights [data-pause-edit-form]:not([data-pause-audit-delete-enhanced="1"])').forEach(enhanceForm);
  }

  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    queueMicrotask(scan);
  }

  function reopenAudit(dayKey) {
    window.__PAUSE__?.openInsights?.();
    const reopen = () => {
      const dayButton = dayKey ? document.querySelector(`.pause-view-insights [data-pause-day-key="${dayKey}"]`) : null;
      if (dayButton) dayButton.click();
    };
    queueMicrotask(() => {
      reopen();
      requestAnimationFrame(reopen);
    });
  }

  function deleteEntry(form) {
    const entryId = String(form?.dataset?.pauseEditForm || '').trim();
    const panel = form?.closest('.pause-view-insights');
    const error = form?.querySelector('[data-pause-edit-error]');
    const dayKey = parseAuditDayKey(panel);
    const state = window.__PAUSE__?.getState?.()?.pauseState;

    if (!entryId || !state || !Array.isArray(state.history)) {
      if (error) error.textContent = 'PAUSE could not access this rest entry. Please try again.';
      return;
    }

    const nextHistory = state.history.filter((entry) => historyEntryKey(entry) !== entryId);
    if (nextHistory.length === state.history.length) {
      if (error) error.textContent = 'This rest entry could not be found.';
      return;
    }

    savePauseState({ ...state, history: nextHistory });
    reopenAudit(dayKey);
  }

  function onClick(event) {
    const trigger = event.target?.closest?.('[data-pause-audit-delete-trigger]');
    if (trigger) {
      const zone = trigger.closest('[data-pause-audit-delete-zone]');
      const confirm = zone?.querySelector('[data-pause-audit-delete-confirm]');
      trigger.hidden = true;
      if (confirm) confirm.hidden = false;
      return;
    }

    const keep = event.target?.closest?.('[data-pause-audit-delete-keep]');
    if (keep) {
      const zone = keep.closest('[data-pause-audit-delete-zone]');
      const confirm = zone?.querySelector('[data-pause-audit-delete-confirm]');
      const triggerButton = zone?.querySelector('[data-pause-audit-delete-trigger]');
      if (confirm) confirm.hidden = true;
      if (triggerButton) triggerButton.hidden = false;
      return;
    }

    const final = event.target?.closest?.('[data-pause-audit-delete-final]');
    if (final) {
      const form = final.closest('[data-pause-edit-form]');
      if (form) deleteEntry(form);
    }
  }

  function init() {
    ensureStyles();
    document.addEventListener('click', onClick);
    new MutationObserver((records) => {
      if (records.some((record) => record.addedNodes?.length)) queueScan();
    }).observe(document.documentElement, { childList: true, subtree: true });
    queueScan();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

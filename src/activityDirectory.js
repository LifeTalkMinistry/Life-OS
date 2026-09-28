/* PAUSE Activity directory + per-activity reporting shell.
 * Keeps Activity creation/timing ownership in activityCommitments.js and only
 * simplifies the management surface into a clean clickable directory.
 */
(() => {
  const PREFIX = 'pause-activity-commitments-v1';
  const USER_KEY = 'pause_backend_user_v1';
  const STYLE_ID = 'pause-activity-directory-style';
  let reportTick = null;

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

  function readState() {
    try {
      const raw = JSON.parse(localStorage.getItem(`${PREFIX}:account:${accountId()}`) || 'null');
      return {
        activities: Array.isArray(raw?.activities) ? raw.activities.filter((item) => item?.id && item?.name) : [],
        sessions: Array.isArray(raw?.sessions) ? raw.sessions.filter((item) => item?.activityId && Number(item?.startAt) && Number(item?.endAt)) : [],
        active: raw?.active?.activityId && Number(raw?.active?.startAt) ? raw.active : null
      };
    } catch {
      return { activities: [], sessions: [], active: null };
    }
  }

  function duration(ms) {
    const minutes = Math.max(0, Math.round(Number(ms || 0) / 60000));
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
  }

  function formatDay(ms) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(ms));
  }

  function formatTime(ms) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(ms));
  }

  function ensureStyles() {
    if (document.querySelector(`#${STYLE_ID}`)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .activity-panel[data-activity-directory-clean],
      .activity-panel[data-activity-report-view]{padding:22px 22px 18px}
      .activity-directory-top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}
      .activity-directory-title{display:flex;align-items:center;gap:10px;min-width:0}
      .activity-directory-title h2{margin:0;color:#eee8f5;font-size:1.35rem;font-weight:520}
      .activity-directory-add{appearance:none;display:grid;place-items:center;width:31px;height:31px;padding:0;border:1px solid rgba(174,126,255,.2);border-radius:50%;background:rgba(91,55,150,.1);color:#d9c8f1;font-size:1.2rem;font-weight:300;line-height:1;cursor:pointer}
      .activity-directory-add:hover,.activity-directory-add:focus-visible{border-color:rgba(191,146,255,.42);background:rgba(102,61,170,.18);color:#fff;outline:none}
      .activity-directory-close{appearance:none;display:grid;place-items:center;width:31px;height:31px;padding:0;border:1px solid rgba(159,121,218,.16);border-radius:50%;background:transparent;color:#8f849a;font-size:.95rem;cursor:pointer}
      .activity-directory-close:hover,.activity-directory-close:focus-visible{border-color:rgba(174,126,255,.3);color:#eee8f5;outline:none}
      .activity-directory-list{display:grid;border-top:1px solid rgba(155,120,219,.11)}
      .activity-directory-row{appearance:none;display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;min-height:54px;padding:0 2px;border:0;border-bottom:1px solid rgba(155,120,219,.11);background:transparent;color:#eee8f5;text-align:left;cursor:pointer}
      .activity-directory-row strong{overflow:hidden;font-size:.88rem;font-weight:500;text-overflow:ellipsis;white-space:nowrap}
      .activity-directory-row span{flex:0 0 auto;color:#6f6578;font-size:1rem}
      .activity-directory-row:hover strong,.activity-directory-row:focus-visible strong{color:#fff}.activity-directory-row:focus-visible{outline:none}
      .activity-directory-empty{margin:0;padding:24px 2px;color:#7f7688;font-size:.73rem;line-height:1.55}
      .activity-report-top{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:18px}
      .activity-report-heading{display:flex;align-items:center;gap:10px;min-width:0}
      .activity-report-back{appearance:none;display:grid;place-items:center;width:31px;height:31px;padding:0;border:1px solid rgba(159,121,218,.15);border-radius:50%;background:rgba(79,47,130,.08);color:#b9afc3;font-size:1rem;cursor:pointer}
      .activity-report-back:hover,.activity-report-back:focus-visible{border-color:rgba(170,128,235,.28);background:rgba(94,55,158,.16);color:#eee7f5;outline:none}
      .activity-report-heading div{min-width:0}.activity-report-heading small{display:block;margin-bottom:3px;color:#84798f;font-size:.55rem;font-weight:650;letter-spacing:.13em;text-transform:uppercase}.activity-report-heading h2{overflow:hidden;margin:0;color:#eee8f5;font-size:1.15rem;font-weight:520;text-overflow:ellipsis;white-space:nowrap}
      .activity-report-total{margin:4px 0 12px;padding:20px 18px 18px;border:1px solid rgba(174,126,255,.2);border-radius:18px;background:linear-gradient(180deg,rgba(74,37,124,.14),rgba(17,10,33,.26));text-align:center}
      .activity-report-total small{color:#92899d;font-size:.61rem;font-weight:650;letter-spacing:.14em}.activity-report-total strong{display:block;margin:6px 0 8px;color:#f3edf9;font-size:clamp(2.45rem,11vw,3.35rem);font-weight:330;line-height:1}.activity-report-total p{margin:0;color:#91879c;font-size:.68rem;line-height:1.5}
      .activity-report-summary{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:22px}.activity-report-summary article{display:grid;gap:7px;min-width:0;padding:14px;border:1px solid rgba(155,120,219,.14);border-radius:13px;background:rgba(16,11,33,.38)}.activity-report-summary small{color:#898190;font-size:.58rem;letter-spacing:.1em}.activity-report-summary strong{color:#eee8f4;font-size:1.02rem;font-weight:430}
      .activity-report-label{margin:0 0 9px;color:#81778b;font-size:.58rem;font-weight:650;letter-spacing:.12em;text-transform:uppercase}
      .activity-report-list{display:grid;gap:9px}.activity-report-entry{padding:14px 15px;border:1px solid rgba(155,120,219,.13);border-radius:14px;background:rgba(15,10,29,.34)}.activity-report-entry-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.activity-report-entry-head strong{color:#e9e2ef;font-size:.8rem;font-weight:520}.activity-report-entry-head b{color:#c6a8f5;font-size:.75rem;font-weight:540}.activity-report-entry p{margin:7px 0 0;color:#81788a;font-size:.67rem;line-height:1.45}.activity-report-entry.is-live{border-color:rgba(187,139,255,.25);background:rgba(28,16,49,.4)}.activity-report-entry.is-live strong::after{content:' · LIVE';color:#9e7ac9;font-size:.54rem;letter-spacing:.08em}
      .activity-report-empty{padding:22px 18px;border:1px solid rgba(155,120,219,.12);border-radius:14px;color:#8f8798;background:rgba(15,10,29,.28);font-size:.73rem;line-height:1.55;text-align:center}
    `;
    document.head.appendChild(style);
  }

  function closeOverlay() {
    clearInterval(reportTick);
    reportTick = null;
    document.querySelector('.activity-backdrop')?.remove();
  }

  function renderDirectory(panel) {
    clearInterval(reportTick);
    reportTick = null;
    const state = readState();
    panel.dataset.activityDirectoryClean = '1';
    delete panel.dataset.activityReportView;
    panel.innerHTML = `
      <div class="activity-directory-top">
        <div class="activity-directory-title">
          <h2>Activities</h2>
          <button type="button" class="activity-directory-add" data-activity-directory-add aria-label="Add activity">+</button>
        </div>
        <button type="button" class="activity-directory-close" data-activity-directory-close aria-label="Close">×</button>
      </div>
      <div class="activity-directory-list">
        ${state.activities.length
          ? state.activities.map((activity) => `
            <button type="button" class="activity-directory-row" data-activity-report="${esc(activity.id)}">
              <strong>${esc(activity.name)}</strong><span aria-hidden="true">›</span>
            </button>`).join('')
          : '<p class="activity-directory-empty">No activities yet. Use + to add one.</p>'}
      </div>`;

    panel.querySelector('[data-activity-directory-add]')?.addEventListener('click', () => {
      window.__PAUSE_ACTIVITIES__?.open?.('add');
    });
    panel.querySelector('[data-activity-directory-close]')?.addEventListener('click', closeOverlay);
    panel.querySelectorAll('[data-activity-report]').forEach((button) => {
      button.addEventListener('click', () => renderReport(panel, button.dataset.activityReport));
    });
  }

  function reportData(activityId) {
    const state = readState();
    const activity = state.activities.find((item) => String(item.id) === String(activityId));
    if (!activity) return null;
    const sessions = state.sessions
      .filter((item) => String(item.activityId) === String(activityId))
      .sort((a, b) => Number(b.endAt) - Number(a.endAt));
    const now = Date.now();
    const active = String(state.active?.activityId) === String(activityId) ? state.active : null;
    const completedMs = sessions.reduce((total, item) => total + Math.max(0, Number(item.durationMs) || Number(item.endAt) - Number(item.startAt)), 0);
    const activeMs = active ? Math.max(0, now - Number(active.startAt)) : 0;
    const since = now - 7 * 86400000;
    const last7Completed = sessions.reduce((total, item) => {
      if (Number(item.endAt) < since) return total;
      return total + Math.max(0, Number(item.durationMs) || Number(item.endAt) - Number(item.startAt));
    }, 0);
    const last7Active = active && Number(active.startAt) >= since ? activeMs : 0;
    return { activity, sessions, active, totalMs: completedMs + activeMs, last7Ms: last7Completed + last7Active };
  }

  function renderReport(panel, activityId) {
    clearInterval(reportTick);
    reportTick = null;
    const data = reportData(activityId);
    if (!data) return renderDirectory(panel);
    delete panel.dataset.activityDirectoryClean;
    panel.dataset.activityReportView = '1';
    const sessionMarkup = [
      ...(data.active ? [{ ...data.active, endAt: Date.now(), durationMs: Date.now() - Number(data.active.startAt), live: true }] : []),
      ...data.sessions.slice(0, 30)
    ];

    panel.innerHTML = `
      <div class="activity-report-top">
        <div class="activity-report-heading">
          <button type="button" class="activity-report-back" data-activity-report-back aria-label="Back to Activities">←</button>
          <div><small>ACTIVITY REPORT</small><h2>${esc(data.activity.name)}</h2></div>
        </div>
        <button type="button" class="activity-directory-close" data-activity-directory-close aria-label="Close">×</button>
      </div>
      <div class="activity-report-total">
        <small>TOTAL TRACKED</small>
        <strong data-activity-report-total>${esc(duration(data.totalMs))}</strong>
        <p>Time recorded for ${esc(data.activity.name)}.</p>
      </div>
      <div class="activity-report-summary">
        <article><small>LAST 7 DAYS</small><strong data-activity-report-seven>${esc(duration(data.last7Ms))}</strong></article>
        <article><small>SESSIONS</small><strong>${data.sessions.length}</strong></article>
      </div>
      <p class="activity-report-label">RECENT SESSIONS</p>
      <div class="activity-report-list">
        ${sessionMarkup.length
          ? sessionMarkup.map((session) => `
            <article class="activity-report-entry${session.live ? ' is-live' : ''}" ${session.live ? 'data-activity-report-live' : ''}>
              <div class="activity-report-entry-head">
                <strong>${esc(formatDay(session.startAt))}</strong>
                <b>${esc(duration(session.durationMs))}</b>
              </div>
              <p>${esc(formatTime(session.startAt))}${session.live ? ' – Now' : ` – ${esc(formatTime(session.endAt))}`}</p>
            </article>`).join('')
          : '<div class="activity-report-empty">No tracked sessions yet.</div>'}
      </div>`;

    panel.querySelector('[data-activity-report-back]')?.addEventListener('click', () => renderDirectory(panel));
    panel.querySelector('[data-activity-directory-close]')?.addEventListener('click', closeOverlay);

    if (data.active) {
      reportTick = setInterval(() => {
        if (!panel.isConnected || !panel.dataset.activityReportView) {
          clearInterval(reportTick);
          reportTick = null;
          return;
        }
        const latest = reportData(activityId);
        if (!latest) return;
        const liveDuration = panel.querySelector('[data-activity-report-live] b');
        if (liveDuration && latest.active) liveDuration.textContent = duration(Date.now() - Number(latest.active.startAt));
        const total = panel.querySelector('[data-activity-report-total]');
        if (total) total.textContent = duration(latest.totalMs);
        const seven = panel.querySelector('[data-activity-report-seven]');
        if (seven) seven.textContent = duration(latest.last7Ms);
      }, 1000);
    }
  }

  function reconcile() {
    ensureStyles();
    const panel = document.querySelector('.activity-panel');
    if (!panel) {
      clearInterval(reportTick);
      reportTick = null;
      return;
    }
    if (panel.dataset.activityDirectoryClean || panel.dataset.activityReportView) return;
    if (panel.querySelector('[data-form]')) return;
    const heading = panel.querySelector('.activity-head h2')?.textContent?.trim();
    if (heading === 'Activities') renderDirectory(panel);
  }

  const observer = new MutationObserver(reconcile);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('pause:activities-changed', () => {
    const panel = document.querySelector('.activity-panel[data-activity-directory-clean]');
    if (panel) renderDirectory(panel);
  });
  window.addEventListener('storage', reconcile);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reconcile, { once: true });
  else reconcile();
})();

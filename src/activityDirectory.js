/* PAUSE Activity directory + Rest-style per-activity reporting. */
(() => {
  const PREFIX = 'pause-activity-commitments-v1';
  const USER_KEY = 'pause_backend_user_v1';
  const STYLE_ID = 'pause-activity-directory-style';
  const DAY_MS = 86400000;
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

  function manilaKey(ms = Date.now()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function dayStart(key) {
    const [year, month, day] = String(key).split('-').map(Number);
    return Date.UTC(year, month - 1, day, -8, 0, 0, 0);
  }

  function addDays(key, days) {
    return manilaKey(dayStart(key) + Number(days || 0) * DAY_MS);
  }

  function formatDateKey(key, withYear = false) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: 'numeric',
      ...(withYear ? { year: 'numeric' } : {})
    }).format(new Date(dayStart(key) + 12 * 3600000));
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

  function weekdayLabel(key) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      weekday: 'short'
    }).format(new Date(dayStart(key) + 12 * 3600000));
  }

  function overlap(startAt, endAt, rangeStart, rangeEnd) {
    return Math.max(0, Math.min(Number(endAt), rangeEnd) - Math.max(Number(startAt), rangeStart));
  }

  function activitySessions(state, activityId, now = Date.now()) {
    const completed = state.sessions
      .filter((item) => String(item.activityId) === String(activityId))
      .map((item) => ({ ...item, live: false, effectiveEndAt: Number(item.endAt) }))
      .sort((a, b) => Number(b.endAt) - Number(a.endAt));
    const active = String(state.active?.activityId) === String(activityId)
      ? { ...state.active, live: true, endAt: now, effectiveEndAt: now, durationMs: Math.max(0, now - Number(state.active.startAt)) }
      : null;
    return active ? [active, ...completed] : completed;
  }

  function totalInRange(sessions, startAt, endAt) {
    return sessions.reduce((sum, session) => sum + overlap(session.startAt, session.effectiveEndAt ?? session.endAt, startAt, endAt), 0);
  }

  function mondayKey(now = Date.now()) {
    const today = manilaKey(now);
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'short' }).format(new Date(now));
    const index = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[weekday] ?? 0;
    return addDays(today, -index);
  }

  function rangeFor(timeframe, activity, now = Date.now()) {
    const today = manilaKey(now);
    let startKey = addDays(today, -6);
    let endKey = today;
    if (timeframe === 'today') startKey = today;
    if (timeframe === 'thisweek') startKey = mondayKey(now);
    if (timeframe === 'all') startKey = manilaKey(Number(activity.createdAt) || now);
    const rangeStart = dayStart(startKey);
    const rangeEnd = Math.min(dayStart(addDays(endKey, 1)), now);
    return { startKey, endKey, rangeStart, rangeEnd };
  }

  function effectiveDays(activity, range) {
    const createdKey = manilaKey(Number(activity.createdAt) || range.rangeStart);
    const firstKey = createdKey > range.startKey ? createdKey : range.startKey;
    const lastKey = activity.endDate && activity.endDate < range.endKey ? activity.endDate : range.endKey;
    if (firstKey > lastKey) return 0;
    return Math.max(1, Math.floor((dayStart(lastKey) - dayStart(firstKey)) / DAY_MS) + 1);
  }

  function passingMinutes(activity) {
    const explicit = Number(activity.passingTargetMinutes);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const full = Number(activity.targetMinutes);
    return Number.isFinite(full) && full > 0 ? Math.round(full * 0.9) : 0;
  }

  function scoreFor(activity, totalMs, dayCount, timeframe = 'last7') {
    const mode = String(activity.targetMode || 'track');
    const targetMs = Math.max(0, Number(activity.targetMinutes || 0) * 60000);
    const passMs = Math.max(0, passingMinutes(activity) * 60000);
    const safeDays = Math.max(1, Number(dayCount || 1));
    if (mode === 'track' || !targetMs) {
      return {
        scored: false,
        status: 'TRACKED',
        percent: null,
        basisMs: totalMs,
        targetMs: 0,
        passMs: 0,
        averageMs: totalMs / safeDays,
        targetLabel: 'TRACKING MODE',
        targetValue: 'Track only'
      };
    }

    let basisMs = totalMs;
    let targetLabel = 'TARGET';
    let targetValue = duration(targetMs);
    if (mode === 'daily') {
      basisMs = totalMs / safeDays;
      targetLabel = 'DAILY TARGET';
      targetValue = duration(targetMs);
    } else if (mode === 'weekly') {
      if (timeframe === 'all') {
        const weeks = Math.max(1, safeDays / 7);
        basisMs = totalMs / weeks;
      }
      targetLabel = 'WEEKLY TARGET';
      targetValue = duration(targetMs);
    } else if (mode === 'total') {
      targetLabel = 'TOTAL TARGET';
      targetValue = duration(targetMs);
    }

    const rawPercent = targetMs ? Math.round((basisMs / targetMs) * 100) : 0;
    const percent = Math.max(0, Math.min(100, rawPercent));
    const status = basisMs >= targetMs ? 'TARGET MET' : basisMs >= passMs ? 'PASS' : 'SHORT';
    return {
      scored: true,
      status,
      percent,
      rawPercent,
      basisMs,
      targetMs,
      passMs,
      averageMs: totalMs / safeDays,
      targetLabel,
      targetValue
    };
  }

  function reportData(activityId, timeframe = 'last7', now = Date.now()) {
    const state = readState();
    const activity = state.activities.find((item) => String(item.id) === String(activityId));
    if (!activity) return null;
    const sessions = activitySessions(state, activityId, now);
    const range = rangeFor(timeframe, activity, now);
    const totalMs = totalInRange(sessions, range.rangeStart, range.rangeEnd);
    const dayCount = effectiveDays(activity, range);
    const score = scoreFor(activity, totalMs, dayCount, timeframe);
    return { state, activity, sessions, range, totalMs, dayCount, score, timeframe, now };
  }

  function sevenDayRows(activityId, now = Date.now()) {
    const state = readState();
    const activity = state.activities.find((item) => String(item.id) === String(activityId));
    if (!activity) return [];
    const sessions = activitySessions(state, activityId, now);
    const today = manilaKey(now);
    const createdKey = manilaKey(Number(activity.createdAt) || now);
    return Array.from({ length: 7 }, (_, index) => {
      const key = addDays(today, index - 6);
      const start = dayStart(key);
      const end = Math.min(start + DAY_MS, now);
      const totalMs = key < createdKey || (activity.endDate && key > activity.endDate) ? 0 : totalInRange(sessions, start, end);
      return { key, totalMs, eligible: key >= createdKey && (!activity.endDate || key <= activity.endDate) };
    });
  }

  function weeklyRows(activityId, now = Date.now()) {
    const state = readState();
    const activity = state.activities.find((item) => String(item.id) === String(activityId));
    if (!activity) return [];
    const sessions = activitySessions(state, activityId, now);
    const currentMonday = mondayKey(now);
    return Array.from({ length: 5 }, (_, index) => {
      const startKey = addDays(currentMonday, -7 * index);
      const endKey = addDays(startKey, 6);
      const start = dayStart(startKey);
      const end = index === 0 ? now : dayStart(addDays(endKey, 1));
      const totalMs = totalInRange(sessions, start, end);
      const range = { startKey, endKey, rangeStart: start, rangeEnd: end };
      const days = effectiveDays(activity, range);
      const score = scoreFor(activity, totalMs, days, 'thisweek');
      return { startKey, endKey, totalMs, days, score, current: index === 0 };
    });
  }

  function ensureStyles() {
    if (document.querySelector(`#${STYLE_ID}`)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .activity-panel[data-activity-directory-clean],.activity-panel[data-activity-report-view]{padding:22px 22px 18px}
      .activity-directory-top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}
      .activity-directory-title{display:flex;align-items:center;gap:10px;min-width:0}.activity-directory-title h2{margin:0;color:#eee8f5;font-size:1.35rem;font-weight:520}
      .activity-directory-add,.activity-directory-close,.activity-report-back{appearance:none;display:grid;place-items:center;width:31px;height:31px;padding:0;border:1px solid rgba(169,124,228,.18);border-radius:50%;background:transparent;color:#a79cad;cursor:pointer}
      .activity-directory-add{background:rgba(91,55,150,.1);color:#d9c8f1;font-size:1.2rem;font-weight:300}.activity-directory-close{font-size:.95rem}.activity-report-back{justify-self:start;background:rgba(79,47,130,.08);font-size:1rem}
      .activity-directory-add:hover,.activity-directory-close:hover,.activity-report-back:hover,.activity-directory-add:focus-visible,.activity-directory-close:focus-visible,.activity-report-back:focus-visible{border-color:rgba(191,146,255,.36);color:#fff;outline:none}
      .activity-directory-list{display:grid;border-top:1px solid rgba(155,120,219,.11)}
      .activity-directory-row{appearance:none;display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;min-height:54px;padding:0 2px;border:0;border-bottom:1px solid rgba(155,120,219,.11);background:transparent;color:#eee8f5;text-align:left;cursor:pointer}.activity-directory-row strong{overflow:hidden;font-size:.88rem;font-weight:500;text-overflow:ellipsis;white-space:nowrap}.activity-directory-row span{color:#6f6578;font-size:1rem}.activity-directory-row:hover strong,.activity-directory-row:focus-visible strong{color:#fff}.activity-directory-row:focus-visible{outline:none}.activity-directory-empty{margin:0;padding:24px 2px;color:#7f7688;font-size:.73rem}
      .activity-report-top{display:grid;grid-template-columns:31px minmax(0,1fr) 31px;align-items:center;gap:12px;margin-bottom:18px}.activity-report-heading{min-width:0;text-align:center}.activity-report-heading small{display:block;margin-bottom:3px;color:#84798f;font-size:.55rem;font-weight:650;letter-spacing:.13em}.activity-report-heading h2{overflow:hidden;margin:0;color:#eee8f5;font-size:1.15rem;font-weight:520;text-overflow:ellipsis;white-space:nowrap}.activity-report-top>.activity-directory-close{justify-self:end}
      .activity-status-card{margin:4px 0 18px;padding:20px 18px 17px;border:1px solid rgba(174,126,255,.2);border-radius:18px;background:linear-gradient(180deg,rgba(74,37,124,.14),rgba(17,10,33,.26));text-align:center}
      .activity-status-eyebrow{display:block;color:#92899d;font-size:.61rem;font-weight:650;letter-spacing:.14em}.activity-timeframe{margin-top:9px;min-height:35px;padding:0 12px;border:1px solid rgba(174,126,255,.22);border-radius:11px;background:rgba(77,47,128,.14);color:#d7cde0;font-size:.64rem;font-weight:650;color-scheme:dark;text-align:center}.activity-status-range{margin:8px 0 0;color:#736b7c;font-size:.58rem}.activity-status-value{display:block;margin:22px 0 5px;color:#f3edf9;font-size:clamp(2.55rem,12vw,3.55rem);font-weight:330;line-height:1;letter-spacing:-.03em}.activity-status-state{display:flex;align-items:center;justify-content:center;gap:6px;color:#ca9feb;font-size:.66rem;font-weight:720;letter-spacing:.13em}.activity-status-info{display:grid;place-items:center;width:15px;height:15px;border:1px solid rgba(190,149,231,.28);border-radius:50%;color:#8d7d9d;font-size:.52rem;letter-spacing:0}.activity-status-progress{display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;margin:22px 0 17px}.activity-status-track{height:5px;overflow:hidden;border-radius:99px;background:rgba(151,119,201,.11)}.activity-status-fill{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,rgba(104,91,255,.9),rgba(210,88,221,.9));box-shadow:0 0 10px rgba(154,91,255,.2)}.activity-status-percent{color:#91879c;font-size:.61rem}.activity-status-unscored{margin:20px 0 5px;color:#81778a;font-size:.67rem}.activity-status-summary{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid rgba(155,120,219,.12);padding-top:15px}.activity-status-summary article{display:grid;gap:5px}.activity-status-summary article+article{border-left:1px solid rgba(155,120,219,.1)}.activity-status-summary small{color:#7e7488;font-size:.55rem;font-weight:650;letter-spacing:.1em}.activity-status-summary strong{color:#e8e0ef;font-size:.92rem;font-weight:520}
      .activity-weekly-button{appearance:none;display:flex;align-items:center;justify-content:space-between;width:100%;min-height:62px;margin:0 0 20px;padding:0 18px;border:1px solid rgba(174,126,255,.18);border-radius:14px;background:rgba(70,38,117,.13);color:#d2c7da;font-size:.73rem;letter-spacing:.04em;cursor:pointer}.activity-weekly-button span:last-child{color:#807486}.activity-weekly-button:hover,.activity-weekly-button:focus-visible{border-color:rgba(190,145,255,.3);background:rgba(82,45,138,.18);outline:none}
      .activity-report-section{margin-top:20px}.activity-report-label{margin:0 0 12px;color:#81778b;font-size:.58rem;font-weight:650;letter-spacing:.12em;text-transform:uppercase}.activity-report-copy{margin:-6px 0 12px;color:#716979;font-size:.62rem;line-height:1.45}
      .activity-rhythm-days{display:grid;gap:6px}.activity-rhythm-day{appearance:none;display:grid;grid-template-columns:70px 1fr 72px;align-items:center;gap:10px;width:100%;min-height:48px;padding:6px 4px;border:1px solid transparent;border-radius:11px;background:transparent;color:#a79fac;text-align:left;cursor:pointer}.activity-rhythm-day:hover,.activity-rhythm-day:focus-visible{border-color:rgba(163,118,229,.14);background:rgba(91,54,148,.1);outline:none}.activity-rhythm-label{display:grid;gap:2px}.activity-rhythm-label strong{color:#c7bfce;font-size:.69rem;font-weight:520}.activity-rhythm-label small{color:#706978;font-size:.57rem}.activity-rhythm-track{height:5px;overflow:hidden;border-radius:999px;background:rgba(151,119,201,.1)}.activity-rhythm-fill{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,rgba(104,91,255,.8),rgba(210,88,221,.88));box-shadow:0 0 10px rgba(154,91,255,.18)}.activity-rhythm-tail{display:flex;justify-content:flex-end;gap:7px;color:#c1b7cb;font-size:.65rem;white-space:nowrap}.activity-rhythm-tail i{color:#655c6f;font-style:normal;font-size:.85rem}
      .activity-report-list{display:grid;gap:9px}.activity-report-entry{padding:14px 15px;border:1px solid rgba(155,120,219,.13);border-radius:14px;background:rgba(15,10,29,.34)}.activity-report-entry-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.activity-report-entry-head strong{color:#e9e2ef;font-size:.8rem;font-weight:520}.activity-report-entry-head b{color:#c6a8f5;font-size:.75rem;font-weight:540}.activity-report-entry p{margin:7px 0 0;color:#81788a;font-size:.67rem}.activity-report-entry.is-live{border-color:rgba(187,139,255,.25);background:rgba(28,16,49,.4)}.activity-report-entry.is-live strong::after{content:' · LIVE';color:#9e7ac9;font-size:.54rem;letter-spacing:.08em}.activity-report-empty{padding:22px 18px;border:1px solid rgba(155,120,219,.12);border-radius:14px;color:#8f8798;background:rgba(15,10,29,.28);font-size:.73rem;line-height:1.55;text-align:center}
      .activity-week-list{display:grid;gap:9px}.activity-week-row{padding:14px 15px;border:1px solid rgba(155,120,219,.13);border-radius:14px;background:rgba(15,10,29,.34)}.activity-week-row-top{display:flex;align-items:center;justify-content:space-between;gap:12px}.activity-week-row strong{color:#e8e0ef;font-size:.78rem;font-weight:520}.activity-week-row b{color:#c6a8f5;font-size:.74rem;font-weight:540}.activity-week-row p{display:flex;justify-content:space-between;gap:10px;margin:8px 0 0;color:#7d7486;font-size:.62rem}.activity-week-status{color:#a988cc;font-weight:650;letter-spacing:.06em}
      @media(max-width:390px){.activity-rhythm-day{grid-template-columns:62px 1fr 68px;gap:8px}}
    `;
    document.head.appendChild(style);
  }

  function closeOverlay() {
    clearInterval(reportTick);
    reportTick = null;
    document.querySelector('.activity-backdrop')?.remove();
  }

  function headerMarkup(activity, label = 'ACTIVITY REPORT') {
    return `<div class="activity-report-top">
      <button type="button" class="activity-report-back" data-activity-report-back aria-label="Back">←</button>
      <div class="activity-report-heading"><small>${esc(label)}</small><h2>${esc(activity.name)}</h2></div>
      <button type="button" class="activity-directory-close activity-close" data-activity-directory-close aria-label="Close">×</button>
    </div>`;
  }

  function renderDirectory(panel) {
    clearInterval(reportTick);
    reportTick = null;
    const state = readState();
    panel.dataset.activityDirectoryClean = '1';
    delete panel.dataset.activityReportView;
    delete panel.dataset.activityReportId;
    panel.innerHTML = `<div class="activity-directory-top">
      <div class="activity-directory-title"><h2>Activities</h2><button type="button" class="activity-directory-add" data-activity-directory-add aria-label="Add activity">+</button></div>
      <button type="button" class="activity-directory-close activity-close" data-activity-directory-close aria-label="Close">×</button>
    </div>
    <div class="activity-directory-list">${state.activities.length ? state.activities.map((activity) => `<button type="button" class="activity-directory-row" data-activity-report="${esc(activity.id)}"><strong>${esc(activity.name)}</strong><span aria-hidden="true">›</span></button>`).join('') : '<p class="activity-directory-empty">No activities yet. Use + to add one.</p>'}</div>`;
    panel.querySelector('[data-activity-directory-add]')?.addEventListener('click', () => window.__PAUSE_ACTIVITIES__?.open?.('add'));
    panel.querySelector('[data-activity-directory-close]')?.addEventListener('click', closeOverlay);
    panel.querySelectorAll('[data-activity-report]').forEach((button) => button.addEventListener('click', () => renderReport(panel, button.dataset.activityReport)));
  }

  function timeframeOptions(selected) {
    return [
      ['last7', 'LAST 7 DAYS'],
      ['today', 'TODAY'],
      ['thisweek', 'THIS WEEK'],
      ['all', 'ALL TIME']
    ].map(([value, label]) => `<option value="${value}"${selected === value ? ' selected' : ''}>${label}</option>`).join('');
  }

  function statusCardMarkup(data) {
    const { score, range, totalMs, activity } = data;
    const rangeText = data.timeframe === 'all'
      ? `${formatDateKey(range.startKey, true)} – Today`
      : range.startKey === range.endKey
        ? formatDateKey(range.startKey, true)
        : `${formatDateKey(range.startKey)} – ${formatDateKey(range.endKey)}, ${range.endKey.slice(0, 4)}`;
    const passCopy = score.scored ? `Passing: ${duration(score.passMs)}${activity.targetMode === 'daily' ? ' / day' : activity.targetMode === 'weekly' ? ' / week' : ''}` : 'This activity records time without a score.';
    return `<section class="activity-status-card">
      <small class="activity-status-eyebrow">ACTIVITY STATUS</small>
      <select class="activity-timeframe" data-activity-timeframe aria-label="Activity report timeframe">${timeframeOptions(data.timeframe)}</select>
      <p class="activity-status-range">${esc(rangeText)}</p>
      <strong class="activity-status-value" data-activity-status-total>${esc(duration(totalMs))}</strong>
      <div class="activity-status-state"><span data-activity-status-state>${esc(score.status)}</span><span class="activity-status-info" title="${esc(passCopy)}">i</span></div>
      ${score.scored ? `<div class="activity-status-progress"><div class="activity-status-track" aria-hidden="true"><span class="activity-status-fill" data-activity-status-fill style="width:${score.percent}%"></span></div><span class="activity-status-percent" data-activity-status-percent>${score.percent}%</span></div>` : '<p class="activity-status-unscored">Track-only activities stay intentionally unscored.</p>'}
      <div class="activity-status-summary">
        <article><small>AVERAGE / DAY</small><strong data-activity-status-average>${esc(duration(score.averageMs))}</strong></article>
        <article><small>${esc(score.targetLabel)}</small><strong>${esc(score.targetValue)}</strong></article>
      </div>
    </section>`;
  }

  function rhythmMarkup(activityId, activity, now = Date.now()) {
    const rows = sevenDayRows(activityId, now);
    const maxMs = Math.max(1, ...rows.map((row) => row.totalMs));
    const targetMs = Math.max(0, Number(activity.targetMinutes || 0) * 60000);
    return rows.map((row) => {
      const width = !row.eligible ? 0 : activity.targetMode === 'daily' && targetMs
        ? Math.min(100, Math.round((row.totalMs / targetMs) * 100))
        : row.totalMs ? Math.max(5, Math.round((row.totalMs / maxMs) * 100)) : 0;
      return `<button type="button" class="activity-rhythm-day" data-activity-day="${esc(row.key)}">
        <span class="activity-rhythm-label"><strong>${esc(weekdayLabel(row.key))}</strong><small>${esc(formatDateKey(row.key))}</small></span>
        <span class="activity-rhythm-track" aria-hidden="true"><span class="activity-rhythm-fill" style="width:${width}%"></span></span>
        <span class="activity-rhythm-tail"><span>${row.eligible && row.totalMs ? esc(duration(row.totalMs)) : '—'}</span><i>›</i></span>
      </button>`;
    }).join('');
  }

  function sessionMarkup(sessions) {
    return sessions.length ? sessions.slice(0, 20).map((session) => `<article class="activity-report-entry${session.live ? ' is-live' : ''}" ${session.live ? 'data-activity-report-live' : ''}>
      <div class="activity-report-entry-head"><strong>${esc(formatDay(session.startAt))}</strong><b>${esc(duration(session.durationMs || (session.effectiveEndAt - Number(session.startAt))))}</b></div>
      <p>${esc(formatTime(session.startAt))}${session.live ? ' – Now' : ` – ${esc(formatTime(session.endAt))}`}</p>
    </article>`).join('') : '<div class="activity-report-empty">No tracked sessions yet.</div>';
  }

  function renderReport(panel, activityId, timeframe = 'last7') {
    clearInterval(reportTick);
    reportTick = null;
    const data = reportData(activityId, timeframe);
    if (!data) return renderDirectory(panel);
    delete panel.dataset.activityDirectoryClean;
    panel.dataset.activityReportView = '1';
    panel.dataset.activityReportId = String(activityId);
    panel.dataset.activityTimeframe = timeframe;
    panel.innerHTML = `${headerMarkup(data.activity)}
      ${statusCardMarkup(data)}
      <button type="button" class="activity-weekly-button" data-activity-weekly><span>WEEKLY REPORTS</span><span>›</span></button>
      <section class="activity-report-section"><p class="activity-report-label">YOUR 7-DAY RHYTHM</p><p class="activity-report-copy">Tap any day to review the sessions credited to that Manila calendar date.</p><div class="activity-rhythm-days">${rhythmMarkup(activityId, data.activity, data.now)}</div></section>
      <section class="activity-report-section"><p class="activity-report-label">RECENT SESSIONS</p><div class="activity-report-list">${sessionMarkup(data.sessions)}</div></section>`;

    panel.querySelector('[data-activity-report-back]')?.addEventListener('click', () => renderDirectory(panel));
    panel.querySelector('[data-activity-directory-close]')?.addEventListener('click', closeOverlay);
    panel.querySelector('[data-activity-timeframe]')?.addEventListener('change', (event) => renderReport(panel, activityId, event.target.value));
    panel.querySelector('[data-activity-weekly]')?.addEventListener('click', () => renderWeeklyReports(panel, activityId));
    panel.querySelectorAll('[data-activity-day]').forEach((button) => button.addEventListener('click', () => renderDayAudit(panel, activityId, button.dataset.activityDay, timeframe)));

    if (data.sessions.some((session) => session.live)) {
      reportTick = setInterval(() => {
        if (!panel.isConnected || panel.dataset.activityReportId !== String(activityId)) return;
        const latest = reportData(activityId, timeframe);
        if (!latest) return;
        const total = panel.querySelector('[data-activity-status-total]');
        const state = panel.querySelector('[data-activity-status-state]');
        const average = panel.querySelector('[data-activity-status-average]');
        const fill = panel.querySelector('[data-activity-status-fill]');
        const percent = panel.querySelector('[data-activity-status-percent]');
        const live = panel.querySelector('[data-activity-report-live] b');
        if (total) total.textContent = duration(latest.totalMs);
        if (state) state.textContent = latest.score.status;
        if (average) average.textContent = duration(latest.score.averageMs);
        if (fill && latest.score.scored) fill.style.width = `${latest.score.percent}%`;
        if (percent && latest.score.scored) percent.textContent = `${latest.score.percent}%`;
        const active = latest.sessions.find((session) => session.live);
        if (live && active) live.textContent = duration(active.durationMs);
      }, 1000);
    }
  }

  function renderWeeklyReports(panel, activityId) {
    clearInterval(reportTick);
    reportTick = null;
    const state = readState();
    const activity = state.activities.find((item) => String(item.id) === String(activityId));
    if (!activity) return renderDirectory(panel);
    panel.dataset.activityReportView = '1';
    panel.dataset.activityReportId = String(activityId);
    const rows = weeklyRows(activityId);
    panel.innerHTML = `${headerMarkup(activity, 'WEEKLY REPORTS')}<div class="activity-week-list">${rows.map((row) => `<article class="activity-week-row"><div class="activity-week-row-top"><strong>${row.current ? 'THIS WEEK' : `${esc(formatDateKey(row.startKey))} – ${esc(formatDateKey(row.endKey))}`}</strong><b>${esc(duration(row.totalMs))}</b></div><p><span>${row.score.scored ? `${row.score.percent}% of target` : 'Tracked time'}</span><span class="activity-week-status">${esc(row.score.status)}</span></p></article>`).join('')}</div>`;
    panel.querySelector('[data-activity-report-back]')?.addEventListener('click', () => renderReport(panel, activityId, 'last7'));
    panel.querySelector('[data-activity-directory-close]')?.addEventListener('click', closeOverlay);
  }

  function renderDayAudit(panel, activityId, dayKey, returnTimeframe = 'last7') {
    clearInterval(reportTick);
    reportTick = null;
    const state = readState();
    const activity = state.activities.find((item) => String(item.id) === String(activityId));
    if (!activity) return renderDirectory(panel);
    const sessions = activitySessions(state, activityId);
    const start = dayStart(dayKey);
    const end = Math.min(start + DAY_MS, Date.now());
    const totalMs = totalInRange(sessions, start, end);
    const score = scoreFor(activity, totalMs, 1, 'today');
    const daySessions = sessions.filter((session) => overlap(session.startAt, session.effectiveEndAt ?? session.endAt, start, end) > 0);
    panel.dataset.activityReportView = '1';
    panel.dataset.activityReportId = String(activityId);
    panel.innerHTML = `${headerMarkup(activity, `${weekdayLabel(dayKey).toUpperCase()} · ${formatDateKey(dayKey, true)}`)}
      <section class="activity-status-card"><small class="activity-status-eyebrow">DAY TOTAL</small><strong class="activity-status-value">${esc(duration(totalMs))}</strong><div class="activity-status-state"><span>${esc(score.status)}</span></div>${score.scored ? `<div class="activity-status-progress"><div class="activity-status-track"><span class="activity-status-fill" style="width:${score.percent}%"></span></div><span class="activity-status-percent">${score.percent}%</span></div>` : ''}<div class="activity-status-summary"><article><small>PASSING</small><strong>${score.scored ? esc(duration(score.passMs)) : '—'}</strong></article><article><small>${esc(score.targetLabel)}</small><strong>${esc(score.targetValue)}</strong></article></div></section>
      <section class="activity-report-section"><p class="activity-report-label">SESSIONS</p><div class="activity-report-list">${sessionMarkup(daySessions)}</div></section>`;
    panel.querySelector('[data-activity-report-back]')?.addEventListener('click', () => renderReport(panel, activityId, returnTimeframe));
    panel.querySelector('[data-activity-directory-close]')?.addEventListener('click', closeOverlay);
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
    const panel = document.querySelector('.activity-panel');
    if (!panel) return;
    if (panel.dataset.activityDirectoryClean) return renderDirectory(panel);
    if (panel.dataset.activityReportId) return renderReport(panel, panel.dataset.activityReportId, panel.dataset.activityTimeframe || 'last7');
  });
  window.addEventListener('storage', reconcile);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reconcile, { once: true });
  else reconcile();
})();

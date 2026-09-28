/* PAUSE Activity Insights.
 * Rest Insights is the visual blueprint only. Activity keeps its own labels,
 * calculations and DOM so the two reports can share structure without one
 * masquerading as the other.
 */
(() => {
  const STYLE_ID = 'pause-activity-insights-style';
  const PREFIX = 'pause-activity-commitments-v1';
  const USER_KEY = 'pause_backend_user_v1';
  const DAY_MS = 86_400_000;
  const selections = new WeakMap();
  let queued = false;
  let liveTick = null;

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

  function validKey(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && Number.isFinite(dayStart(value));
  }

  function addDays(key, days) {
    const start = dayStart(key);
    return Number.isFinite(start) ? manilaKey(start + Number(days || 0) * DAY_MS) : '';
  }

  function weekdayName(key, short = false) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila', weekday: short ? 'short' : 'long'
    }).format(new Date(dayStart(key) + 12 * 3_600_000));
  }

  function dateLabel(key, withYear = false) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila', month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {})
    }).format(new Date(dayStart(key) + 12 * 3_600_000));
  }

  function timeLabel(ms) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit'
    }).format(new Date(ms));
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

  function sessionsFor(state, activityId, now = Date.now()) {
    const sessions = state.sessions
      .filter((session) => String(session?.activityId) === String(activityId))
      .map((session) => ({
        ...session,
        startAt: Number(session.startAt),
        endAt: Number(session.endAt),
        live: false
      }))
      .filter((session) => Number.isFinite(session.startAt) && Number.isFinite(session.endAt) && session.endAt >= session.startAt)
      .sort((a, b) => b.endAt - a.endAt);

    if (String(state.active?.activityId) === String(activityId) && Number(state.active?.startAt)) {
      sessions.unshift({
        ...state.active,
        startAt: Number(state.active.startAt),
        endAt: now,
        live: true
      });
    }
    return sessions;
  }

  function overlap(startAt, endAt, rangeStart, rangeEnd) {
    return Math.max(0, Math.min(Number(endAt), rangeEnd) - Math.max(Number(startAt), rangeStart));
  }

  function totalForRange(sessions, startAt, endAt) {
    return sessions.reduce((sum, session) => sum + overlap(session.startAt, session.endAt, startAt, endAt), 0);
  }

  function totalForDay(sessions, key, now = Date.now()) {
    const start = dayStart(key);
    const end = Math.min(start + DAY_MS, now);
    return end > start ? totalForRange(sessions, start, end) : 0;
  }

  function selectionFor(panel, activityId) {
    const today = manilaKey();
    let selection = selections.get(panel);
    if (!selection || selection.activityId !== String(activityId)) {
      selection = {
        activityId: String(activityId),
        mode: 'quick',
        days: 7,
        customStart: addDays(today, -6),
        customEnd: today,
        menuOpen: false,
        customOpen: false
      };
      selections.set(panel, selection);
    }
    return selection;
  }

  function selectedRange(selection, now = Date.now()) {
    const today = manilaKey(now);
    if (selection.mode === 'custom' && validKey(selection.customStart) && validKey(selection.customEnd)) {
      const startKey = selection.customStart <= selection.customEnd ? selection.customStart : selection.customEnd;
      const requestedEnd = selection.customStart <= selection.customEnd ? selection.customEnd : selection.customStart;
      return { startKey, endKey: requestedEnd > today ? today : requestedEnd };
    }
    const days = Math.max(1, Number(selection.days) || 7);
    return { startKey: addDays(today, -(days - 1)), endKey: today };
  }

  function rangeCaption(range) {
    if (range.startKey === range.endKey) return dateLabel(range.startKey, true);
    return range.startKey.slice(0, 4) === range.endKey.slice(0, 4)
      ? `${dateLabel(range.startKey)} – ${dateLabel(range.endKey, true)}`
      : `${dateLabel(range.startKey, true)} – ${dateLabel(range.endKey, true)}`;
  }

  function selectorLabel(selection) {
    if (selection.mode === 'custom') return 'CUSTOM RANGE';
    if (selection.days === 1) return 'TODAY';
    return `LAST ${selection.days} DAYS`;
  }

  function effectiveDays(activity, range) {
    const createdKey = manilaKey(Number(activity.createdAt) || dayStart(range.startKey));
    const firstKey = createdKey > range.startKey ? createdKey : range.startKey;
    const lastKey = activity.endDate && activity.endDate < range.endKey ? activity.endDate : range.endKey;
    if (firstKey > lastKey) return 0;
    return Math.max(1, Math.floor((dayStart(lastKey) - dayStart(firstKey)) / DAY_MS) + 1);
  }

  function passingMinutes(activity) {
    const explicit = Number(activity.passingTargetMinutes);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const target = Number(activity.targetMinutes);
    return Number.isFinite(target) && target > 0 ? Math.round(target * .9) : 0;
  }

  function reportData(activityId, selection, now = Date.now()) {
    const state = readState();
    const activity = state.activities.find((item) => String(item?.id) === String(activityId));
    if (!activity) return null;

    const sessions = sessionsFor(state, activityId, now);
    const range = selectedRange(selection, now);
    const startAt = dayStart(range.startKey);
    const endAt = Math.min(dayStart(addDays(range.endKey, 1)), now);
    const totalMs = endAt > startAt ? totalForRange(sessions, startAt, endAt) : 0;
    const days = effectiveDays(activity, range);
    const averageMs = days ? totalMs / days : 0;
    const mode = String(activity.targetMode || 'track');
    const targetMs = Math.max(0, Number(activity.targetMinutes || 0) * 60_000);
    const passingMs = Math.max(0, passingMinutes(activity) * 60_000);

    if (mode === 'track' || !targetMs) {
      return {
        state, activity, sessions, range, totalMs, averageMs, days,
        scored: false,
        status: 'TRACKED',
        percent: null,
        targetLabel: 'TRACKING MODE',
        targetValue: 'Track only'
      };
    }

    let basisMs = totalMs;
    let targetLabel = 'TARGET';
    if (mode === 'daily') {
      basisMs = averageMs;
      targetLabel = 'DAILY TARGET';
    } else if (mode === 'weekly') {
      const weeks = Math.max(1, days / 7);
      basisMs = totalMs / weeks;
      targetLabel = 'WEEKLY TARGET';
    } else if (mode === 'total') {
      targetLabel = 'TOTAL TARGET';
    }

    const rawPercent = targetMs ? Math.round((basisMs / targetMs) * 100) : 0;
    const percent = Math.max(0, Math.min(100, rawPercent));
    const status = basisMs >= targetMs ? 'TARGET MET' : basisMs >= passingMs ? 'PASS' : 'SHORT';
    return {
      state, activity, sessions, range, totalMs, averageMs, days,
      scored: true, status, percent, rawPercent,
      targetLabel, targetValue: duration(targetMs), targetMs, passingMs
    };
  }

  function rhythmRows(activity, sessions, now = Date.now()) {
    const today = manilaKey(now);
    const createdKey = manilaKey(Number(activity.createdAt) || now);
    const targetMs = Math.max(0, Number(activity.targetMinutes || 0) * 60_000);
    const chronological = Array.from({ length: 7 }, (_, index) => {
      const key = addDays(today, index - 6);
      const eligible = key >= createdKey && (!activity.endDate || key <= activity.endDate);
      const totalMs = eligible ? totalForDay(sessions, key, now) : 0;
      return { key, eligible, totalMs };
    });
    const maxMs = Math.max(1, ...chronological.map((row) => row.totalMs));
    return chronological.reverse().map((row) => ({
      ...row,
      width: !row.eligible ? 0
        : activity.targetMode === 'daily' && targetMs
          ? Math.min(100, Math.round((row.totalMs / targetMs) * 100))
          : row.totalMs > 0 ? Math.max(5, Math.round((row.totalMs / maxMs) * 100)) : 0
    }));
  }

  function analysisFor(activity, sessions, now = Date.now()) {
    const today = manilaKey(now);
    const createdKey = manilaKey(Number(activity.createdAt) || now);
    const earliest = addDays(today, -27);
    const firstKey = createdKey > earliest ? createdKey : earliest;
    const observed = [];
    for (let key = firstKey; key <= today; key = addDays(key, 1)) {
      if (activity.endDate && key > activity.endDate) break;
      observed.push({ key, totalMs: totalForDay(sessions, key, now) });
    }

    const weekdayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const buckets = new Map(weekdayOrder.map((label) => [label, { label, totalMs: 0, occurrences: 0 }]));
    observed.forEach((day) => {
      const bucket = buckets.get(weekdayName(day.key));
      if (!bucket) return;
      bucket.totalMs += day.totalMs;
      bucket.occurrences += 1;
    });
    const ranked = [...buckets.values()]
      .map((bucket) => ({ ...bucket, averageMs: bucket.occurrences ? bucket.totalMs / bucket.occurrences : 0 }))
      .sort((a, b) => b.averageMs - a.averageMs || weekdayOrder.indexOf(a.label) - weekdayOrder.indexOf(b.label))
      .map((item, index) => ({ ...item, rank: index + 1 }));

    const activityDays = observed.filter((day) => day.totalMs > 0).length;
    const ready = observed.length >= 14 && activityDays >= 4;

    let streak = 0;
    let cursor = totalForDay(sessions, today, now) > 0 ? today : addDays(today, -1);
    for (let index = 0; index < 365 && cursor >= createdKey; index += 1) {
      if (activity.endDate && cursor > activity.endDate) {
        cursor = addDays(cursor, -1);
        continue;
      }
      if (totalForDay(sessions, cursor, now) <= 0) break;
      streak += 1;
      cursor = addDays(cursor, -1);
    }

    const aggregate = (startKey, endKey) => {
      let totalMs = 0;
      let days = 0;
      for (let key = startKey; key <= endKey; key = addDays(key, 1)) {
        if (key < createdKey || (activity.endDate && key > activity.endDate)) continue;
        const value = totalForDay(sessions, key, now);
        totalMs += value;
        if (value > 0) days += 1;
      }
      return { totalMs, days };
    };

    const currentWeek = aggregate(addDays(today, -6), today);
    const previousWeek = aggregate(addDays(today, -13), addDays(today, -7));

    const timeBuckets = { Morning: 0, Afternoon: 0, Evening: 0, 'Late night': 0 };
    sessions.forEach((session) => {
      if (session.startAt < dayStart(earliest)) return;
      const hour = Number(Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila', hour: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date(session.startAt)).map((part) => [part.type, part.value])).hour);
      const label = hour >= 5 && hour < 12 ? 'Morning' : hour >= 12 && hour < 17 ? 'Afternoon' : hour >= 17 && hour < 21 ? 'Evening' : 'Late night';
      timeBuckets[label] += Math.max(0, session.endAt - session.startAt);
    });
    const mostCommon = Object.entries(timeBuckets).sort((a, b) => b[1] - a[1])[0];

    return {
      observedDays: observed.length,
      activityDays,
      ready,
      ranked,
      strongest: ranked[0],
      streak,
      commonTime: mostCommon?.[1] > 0 ? mostCommon[0] : 'Not enough data',
      activityDayChange: currentWeek.days - previousWeek.days,
      totalMsChange: currentWeek.totalMs - previousWeek.totalMs
    };
  }

  function activityDayChangeCopy(value) {
    if (value > 0) return `+${value} day${value === 1 ? '' : 's'}`;
    if (value < 0) return `−${Math.abs(value)} day${Math.abs(value) === 1 ? '' : 's'}`;
    return 'Same number of days';
  }

  function totalChangeCopy(value) {
    if (!value) return 'Same tracked time';
    return `${value > 0 ? '+' : '−'}${duration(Math.abs(value))}`;
  }

  function infoButton(label, title) {
    return `<button type="button" class="activity-insights-info" aria-label="${esc(label)}" title="${esc(title)}">i</button>`;
  }

  function headerMarkup(activity, backLabel = 'Back to Activities') {
    return `<header class="activity-insights-header">
      <button type="button" class="activity-insights-side-button" data-activity-insights-back aria-label="${esc(backLabel)}">←</button>
      <h2>${esc(activity.name)}</h2>
      <button type="button" class="activity-insights-side-button" data-activity-insights-close aria-label="Close">×</button>
    </header>`;
  }

  function statusMarkup(data, selection) {
    const today = manilaKey();
    const statusHelp = data.scored
      ? `Your percentage compares recorded time with the ${data.targetLabel.toLowerCase()} you declared. Passing is ${duration(data.passingMs)}.`
      : 'Track-only activities record time without assigning a score.';
    return `<section class="activity-insights-status-card">
      <div class="activity-insights-status-head">
        <p class="activity-insights-kicker">ACTIVITY STATUS</p>
        <button type="button" class="activity-insights-range-trigger" data-activity-range-trigger aria-expanded="${selection.menuOpen ? 'true' : 'false'}">${esc(selectorLabel(selection))} <span aria-hidden="true">⌄</span></button>
        <p class="activity-insights-range-caption">${esc(rangeCaption(data.range))}</p>
      </div>

      <div class="activity-insights-range-menu" ${selection.menuOpen ? '' : 'hidden'}>
        <div class="activity-insights-quick-ranges" role="group" aria-label="Activity timeframe">
          <button type="button" class="activity-insights-range-option${selection.mode === 'quick' && selection.days === 1 ? ' is-selected' : ''}" data-activity-days="1">1 DAY</button>
          <button type="button" class="activity-insights-range-option${selection.mode === 'quick' && selection.days === 3 ? ' is-selected' : ''}" data-activity-days="3">3 DAYS</button>
          <button type="button" class="activity-insights-range-option${selection.mode === 'quick' && selection.days === 7 ? ' is-selected' : ''}" data-activity-days="7">7 DAYS</button>
          <button type="button" class="activity-insights-range-option${selection.mode === 'custom' ? ' is-selected' : ''}" data-activity-custom-toggle>CUSTOM</button>
        </div>
        <form class="activity-insights-custom-form" data-activity-custom-form ${selection.customOpen ? '' : 'hidden'}>
          <label><span>From</span><input type="date" name="start" max="${today}" value="${esc(selection.customStart)}"></label>
          <label><span>To</span><input type="date" name="end" max="${today}" value="${esc(selection.customEnd)}"></label>
          <button type="submit">APPLY RANGE</button>
          <p data-activity-custom-error aria-live="polite"></p>
        </form>
      </div>

      <div class="activity-insights-status-main">
        <strong data-activity-insights-total>${esc(duration(data.totalMs))}</strong>
        <div class="activity-insights-status-line"><span data-activity-insights-state>${esc(data.status)}</span>${infoButton('How this activity status works', statusHelp)}</div>
      </div>

      ${data.scored ? `<div class="activity-insights-progress-row">
        <div class="activity-insights-progress-track" aria-hidden="true"><span data-activity-insights-fill style="width:${data.percent}%"></span></div>
        <span data-activity-insights-percent>${data.percent}%</span>
      </div>` : '<p class="activity-insights-unscored">Track-only · no score</p>'}

      <div class="activity-insights-status-stats">
        <div><small>AVERAGE / DAY</small><strong data-activity-insights-average>${esc(duration(data.averageMs))}</strong></div>
        <div><small>${esc(data.targetLabel)}</small><strong>${esc(data.targetValue)}</strong></div>
      </div>
    </section>`;
  }

  function rhythmMarkup(data, now = Date.now()) {
    const rows = rhythmRows(data.activity, data.sessions, now);
    const today = manilaKey(now);
    const yesterday = addDays(today, -1);
    return `<section class="activity-insights-rhythm-card">
      <p class="activity-insights-section-title">YOUR 7-DAY RHYTHM</p>
      <div class="activity-insights-rhythm-days">${rows.map((row) => {
        const relative = row.key === today ? ' · Today' : row.key === yesterday ? ' · Yesterday' : '';
        return `<button type="button" class="activity-insights-rhythm-row" data-activity-day="${esc(row.key)}">
          <span class="activity-insights-rhythm-label"><strong>${esc(weekdayName(row.key, true))}</strong><small>${esc(dateLabel(row.key))}${relative}</small></span>
          <span class="activity-insights-rhythm-track" aria-hidden="true"><span style="width:${row.width}%"></span></span>
          <span class="activity-insights-rhythm-tail"><span>${row.eligible && row.totalMs > 0 ? esc(duration(row.totalMs)) : '—'}</span><i aria-hidden="true">›</i></span>
        </button>`;
      }).join('')}</div>
    </section>`;
  }

  function streakMarkup(analysis) {
    const text = analysis.streak === 0
      ? 'No activity streak yet'
      : analysis.streak === 1
        ? '1 activity day in a row'
        : `${analysis.streak} activity days in a row`;
    return `<section class="activity-insights-streak-card"><strong>${esc(text)}</strong>${infoButton('How activity streaks work', 'A day counts when this activity has at least one tracked session on that Manila calendar day. Consecutive tracked days build the streak.')}</section>`;
  }

  function patternMarkup(analysis) {
    const maxAverage = Math.max(1, ...analysis.ranked.map((item) => item.averageMs));
    const body = analysis.ready
      ? `<div class="activity-insights-strongest">
          <small>STRONGEST ACTIVITY DAY</small>
          <strong>${esc(analysis.strongest.label)}</strong>
          <span>${esc(duration(analysis.strongest.averageMs))} average</span>
        </div>
        <div class="activity-insights-weekday-list">${analysis.ranked.map((item) => {
          const width = item.averageMs > 0 ? Math.max(5, Math.round((item.averageMs / maxAverage) * 100)) : 0;
          return `<div class="activity-insights-weekday-row"><span class="activity-insights-rank">#${item.rank}</span><strong>${esc(item.label)}</strong><span class="activity-insights-weekday-track" aria-hidden="true"><span style="width:${width}%"></span></span><span>${esc(duration(item.averageMs))}</span></div>`;
        }).join('')}</div>`
      : `<div class="activity-insights-learning">
          <strong>BUILDING YOUR ACTIVITY PATTERN</strong>
          <p>Keep tracking this activity. Once there is enough history, PAUSE will show which weekdays consistently receive the most time.</p>
          <div><span>${Math.min(analysis.observedDays, 14)} / 14 days observed</span><span>${Math.min(analysis.activityDays, 4)} / 4 active days</span></div>
        </div>`;

    return `<section class="activity-insights-pattern-card">
      <div class="activity-insights-pattern-title"><p>YOUR ACTIVITY PATTERN · BY WEEKDAY</p>${infoButton('How activity weekday patterns work', 'This pattern uses up to the latest four weeks of this activity and ranks weekdays by average tracked time once enough history exists.')}</div>
      ${body}
      <div class="activity-insights-pattern-divider"></div>
      <p class="activity-insights-pattern-subtitle">PATTERN</p>
      <div class="activity-insights-pattern-row"><span>Most common time</span><strong>${esc(analysis.commonTime)}</strong></div>
      <div class="activity-insights-pattern-row"><span>Active days vs last week</span><strong>${esc(activityDayChangeCopy(analysis.activityDayChange))}</strong></div>
      <div class="activity-insights-pattern-row"><span>Tracked time vs last week</span><strong>${esc(totalChangeCopy(analysis.totalMsChange))}</strong></div>
    </section>`;
  }

  function sessionsOnDay(data, key) {
    const start = dayStart(key);
    const end = Math.min(start + DAY_MS, Date.now());
    return data.sessions.filter((session) => overlap(session.startAt, session.endAt, start, end) > 0);
  }

  function scoreForDay(activity, totalMs) {
    const mode = String(activity.targetMode || 'track');
    const targetMs = Math.max(0, Number(activity.targetMinutes || 0) * 60_000);
    const passingMs = Math.max(0, passingMinutes(activity) * 60_000);
    if (mode !== 'daily' || !targetMs) return { scored: false, status: totalMs > 0 ? 'TRACKED' : 'NO TIME', targetMs: 0, passingMs: 0, percent: null };
    const percent = Math.max(0, Math.min(100, Math.round((totalMs / targetMs) * 100)));
    return { scored: true, status: totalMs >= targetMs ? 'TARGET MET' : totalMs >= passingMs ? 'PASS' : 'SHORT', targetMs, passingMs, percent };
  }

  function dayAuditMarkup(data, key) {
    const totalMs = totalForDay(data.sessions, key);
    const score = scoreForDay(data.activity, totalMs);
    const sessions = sessionsOnDay(data, key);
    return `<div data-activity-refined-root>
      ${headerMarkup(data.activity, 'Back to activity report')}
      <section class="activity-insights-day-card">
        <p>${esc(weekdayName(key).toUpperCase())} · ${esc(dateLabel(key, true))}</p>
        <strong>${esc(duration(totalMs))}</strong>
        <span>${esc(score.status)}</span>
        ${score.scored ? `<div class="activity-insights-progress-row"><div class="activity-insights-progress-track"><span style="width:${score.percent}%"></span></div><span>${score.percent}%</span></div>` : ''}
      </section>
      <section class="activity-insights-sessions-card">
        <p class="activity-insights-section-title">SESSIONS</p>
        ${sessions.length ? sessions.map((session) => `<article><div><strong>${session.live ? 'Active session' : dateLabel(manilaKey(session.startAt), true)}</strong><b>${esc(duration(Math.max(0, session.endAt - session.startAt)))}</b></div><p>${esc(timeLabel(session.startAt))} – ${session.live ? 'Now' : esc(timeLabel(session.endAt))}</p></article>`).join('') : '<div class="activity-insights-empty">No tracked sessions on this day.</div>'}
      </section>
    </div>`;
  }

  function ensureStyles() {
    if (document.querySelector(`#${STYLE_ID}`)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .activity-backdrop.activity-insights-backdrop{z-index:90;background:rgba(1,1,6,.62);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
      .activity-panel.activity-insights-panel{box-sizing:border-box;width:min(91vw,390px);max-height:min(84svh,780px);overflow-y:auto;padding:24px 22px 22px;border:1px solid rgba(198,170,255,.25);border-radius:26px;background:radial-gradient(circle at 16% 5%,rgba(93,58,180,.12),transparent 28%),linear-gradient(150deg,rgba(14,12,25,.98),rgba(5,4,12,.995));box-shadow:0 24px 74px rgba(0,0,0,.62),0 0 34px rgba(88,48,190,.1);color:#eee8f5}
      .activity-insights-header{position:relative;display:grid;grid-template-columns:34px minmax(0,1fr) 34px;align-items:center;gap:10px;min-height:44px;margin-bottom:16px}.activity-insights-header h2{margin:0;text-align:center;color:#eee8f5;font-size:1.32rem;font-weight:500;line-height:1.2}.activity-insights-side-button{appearance:none;display:grid;place-items:center;width:30px;height:30px;padding:0;border:1px solid rgba(169,124,228,.18);border-radius:50%;background:transparent;color:#9d93a6;font-size:.95rem;cursor:pointer}.activity-insights-side-button:last-child{justify-self:end}.activity-insights-side-button:hover,.activity-insights-side-button:focus-visible{border-color:rgba(191,146,255,.36);color:#fff;outline:none}
      .activity-insights-status-card{position:relative;margin:4px 0 19px;padding:18px 18px 17px;border:1px solid rgba(174,126,255,.21);border-radius:18px;background:linear-gradient(180deg,rgba(74,37,124,.14),rgba(17,10,33,.27))}.activity-insights-status-head{display:grid;justify-items:center;gap:7px;text-align:center}.activity-insights-kicker{margin:0;color:#92899d;font-size:.61rem;font-weight:700;letter-spacing:.15em}.activity-insights-range-trigger{appearance:none;min-height:34px;padding:0 12px;border:1px solid rgba(167,124,232,.17);border-radius:10px;background:rgba(94,56,156,.08);color:#d8cfdf;font-size:.66rem;font-weight:650;letter-spacing:.09em;cursor:pointer}.activity-insights-range-trigger:hover,.activity-insights-range-trigger:focus-visible,.activity-insights-range-trigger[aria-expanded=true]{border-color:rgba(181,137,247,.34);background:rgba(103,62,172,.16);color:#f1eaf7;outline:none}.activity-insights-range-caption{margin:-1px 0 0;color:#776f80;font-size:.64rem}.activity-insights-range-menu{position:absolute;top:82px;left:18px;right:18px;z-index:8;padding:10px;border:1px solid rgba(170,128,237,.23);border-radius:14px;background:rgba(9,6,19,.98);box-shadow:0 15px 36px rgba(0,0,0,.42);backdrop-filter:blur(16px)}.activity-insights-range-menu[hidden]{display:none}.activity-insights-quick-ranges{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}.activity-insights-range-option{appearance:none;min-height:36px;padding:0 6px;border:1px solid transparent;border-radius:9px;background:transparent;color:#98909f;font-size:.58rem;cursor:pointer}.activity-insights-range-option.is-selected{border-color:rgba(180,137,245,.28);background:rgba(102,61,171,.16);color:#eee7f5}.activity-insights-custom-form{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.activity-insights-custom-form[hidden]{display:none}.activity-insights-custom-form label{display:grid;gap:4px;color:#817987;font-size:.56rem}.activity-insights-custom-form input{box-sizing:border-box;width:100%;min-height:36px;padding:0 8px;border:1px solid rgba(169,124,228,.18);border-radius:9px;background:#0d0918;color:#ded6e7;color-scheme:dark}.activity-insights-custom-form button{grid-column:1/-1;min-height:35px;border:1px solid rgba(174,126,255,.2);border-radius:9px;background:rgba(92,55,153,.13);color:#d8cfdf;font-size:.6rem}.activity-insights-custom-form p{grid-column:1/-1;min-height:12px;margin:0;color:#b999cd;font-size:.57rem;text-align:center}
      .activity-insights-status-main{display:grid;justify-items:center;margin-top:24px}.activity-insights-status-main>strong{color:#f3edf9;font-size:clamp(2.55rem,12vw,3.55rem);font-weight:330;line-height:1;letter-spacing:-.03em}.activity-insights-status-line{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:6px;color:#ca9feb;font-size:.66rem;font-weight:720;letter-spacing:.13em}.activity-insights-info{appearance:none;display:grid;place-items:center;width:16px;height:16px;padding:0;border:1px solid rgba(190,149,231,.3);border-radius:50%;background:transparent;color:#8d7d9d;font-size:.53rem;line-height:1;cursor:help}.activity-insights-progress-row{display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;margin:23px 0 17px}.activity-insights-progress-track{height:5px;overflow:hidden;border-radius:99px;background:rgba(151,119,201,.11)}.activity-insights-progress-track>span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,rgba(104,91,255,.9),rgba(210,88,221,.9));box-shadow:0 0 10px rgba(154,91,255,.2)}.activity-insights-progress-row>span{color:#91879c;font-size:.61rem}.activity-insights-unscored{margin:23px 0 17px;color:#81778a;font-size:.64rem;text-align:center}.activity-insights-status-stats{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid rgba(155,120,219,.12);padding-top:15px}.activity-insights-status-stats>div{display:grid;gap:5px;text-align:center}.activity-insights-status-stats>div+div{border-left:1px solid rgba(155,120,219,.1)}.activity-insights-status-stats small{color:#7e7488;font-size:.55rem;font-weight:650;letter-spacing:.1em}.activity-insights-status-stats strong{color:#e8e0ef;font-size:.92rem;font-weight:520}
      .activity-insights-rhythm-card{box-sizing:border-box;width:100%;margin:18px 0 20px;padding:18px 16px 14px;border:1px solid rgba(174,126,255,.22);border-radius:16px;background:linear-gradient(180deg,rgba(43,25,72,.48),rgba(14,9,29,.6));box-shadow:inset 0 0 30px rgba(111,72,179,.035)}.activity-insights-section-title{margin:0 0 13px;color:#8b8295;font-size:.59rem;font-weight:700;letter-spacing:.15em;text-align:center}.activity-insights-rhythm-days{display:grid;gap:4px}.activity-insights-rhythm-row{appearance:none;display:grid;grid-template-columns:62px minmax(0,1fr) 68px;align-items:center;gap:10px;width:100%;min-height:48px;padding:6px 0;border:0;background:transparent;color:#aba2b3;text-align:left;cursor:pointer}.activity-insights-rhythm-row:focus-visible{outline:1px solid rgba(184,141,249,.3);outline-offset:2px;border-radius:9px}.activity-insights-rhythm-label{display:grid;gap:2px;min-width:0}.activity-insights-rhythm-label strong{color:#c8c0cf;font-size:.68rem;font-weight:550}.activity-insights-rhythm-label small{color:#706978;font-size:.55rem;line-height:1.15;white-space:nowrap}.activity-insights-rhythm-track{display:block;height:5px;overflow:hidden;border-radius:999px;background:rgba(151,119,201,.1)}.activity-insights-rhythm-track>span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,rgba(104,91,255,.84),rgba(210,88,221,.9))}.activity-insights-rhythm-tail{display:flex;align-items:center;justify-content:flex-end;gap:6px;min-width:0;color:#c3bacd;font-size:.62rem;white-space:nowrap}.activity-insights-rhythm-tail i{color:#655c6f;font-style:normal;font-size:.82rem}
      .activity-insights-streak-card{display:flex;align-items:center;justify-content:center;gap:8px;min-height:54px;margin:0 0 18px;padding:0 14px;border:1px solid rgba(174,126,255,.19);border-radius:14px;background:rgba(40,23,68,.32);color:#e7dfea}.activity-insights-streak-card strong{font-size:.92rem;font-weight:450}
      .activity-insights-pattern-card{box-sizing:border-box;width:100%;margin:0 0 20px;padding:18px 16px 16px;border:1px solid rgba(174,126,255,.22);border-radius:16px;background:rgba(24,14,43,.58);box-shadow:inset 0 0 30px rgba(111,72,179,.035)}.activity-insights-pattern-title{display:flex;align-items:center;justify-content:center;gap:7px;margin-bottom:15px}.activity-insights-pattern-title p,.activity-insights-pattern-subtitle{margin:0;color:#8b8295;font-size:.59rem;font-weight:700;letter-spacing:.13em}.activity-insights-strongest{display:grid;justify-items:center;gap:5px;margin-bottom:14px;padding:13px 10px;border:1px solid rgba(166,122,232,.18);border-radius:13px;background:rgba(52,30,88,.18);text-align:center}.activity-insights-strongest small{color:#81778a;font-size:.52rem;font-weight:650;letter-spacing:.13em}.activity-insights-strongest strong{font-size:1.02rem;font-weight:500}.activity-insights-strongest span{color:#8e8598;font-size:.61rem}.activity-insights-weekday-list{display:grid;gap:8px}.activity-insights-weekday-row{display:grid;grid-template-columns:23px 68px minmax(0,1fr) 48px;align-items:center;gap:7px;font-size:.61rem}.activity-insights-rank{color:#675e70}.activity-insights-weekday-row strong{overflow:hidden;color:#c0b8c8;font-size:.62rem;font-weight:550;text-overflow:ellipsis}.activity-insights-weekday-track{height:5px;overflow:hidden;border-radius:999px;background:rgba(151,119,201,.1)}.activity-insights-weekday-track>span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,rgba(104,91,255,.78),rgba(210,88,221,.84))}.activity-insights-weekday-row>span:last-child{color:#c1b7ca;text-align:right;white-space:nowrap}.activity-insights-learning{padding:4px 0 2px}.activity-insights-learning>strong{display:block;margin-bottom:9px;color:#ded5e8;font-size:.77rem;font-weight:650}.activity-insights-learning>p{margin:0;color:#948b9e;font-size:.69rem;line-height:1.55}.activity-insights-learning>div{display:flex;justify-content:space-between;gap:12px;margin-top:12px;color:#8d8497;font-size:.59rem}.activity-insights-pattern-divider{height:1px;margin:17px 0 14px;background:rgba(155,120,219,.11)}.activity-insights-pattern-subtitle{margin-bottom:7px}.activity-insights-pattern-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;min-height:42px;border-bottom:1px solid rgba(155,120,219,.09);font-size:.64rem}.activity-insights-pattern-row:last-child{border-bottom:0}.activity-insights-pattern-row span{color:#8e8598}.activity-insights-pattern-row strong{color:#d2cad9;font-size:.64rem;font-weight:550;text-align:right}.activity-insights-note{margin:4px 0 0;color:#837b8b;font-size:.61rem;line-height:1.45;text-align:center}
      .activity-insights-day-card{display:grid;justify-items:center;gap:6px;margin:4px 0 18px;padding:19px 18px 17px;border:1px solid rgba(174,126,255,.21);border-radius:18px;background:linear-gradient(180deg,rgba(74,37,124,.14),rgba(17,10,33,.27));text-align:center}.activity-insights-day-card>p{margin:0;color:#8c8395;font-size:.6rem;font-weight:650;letter-spacing:.1em}.activity-insights-day-card>strong{margin-top:10px;color:#f3edf9;font-size:2.8rem;font-weight:330;line-height:1}.activity-insights-day-card>span{color:#ca9feb;font-size:.65rem;font-weight:700;letter-spacing:.11em}.activity-insights-sessions-card{padding:17px 15px;border:1px solid rgba(174,126,255,.19);border-radius:16px;background:rgba(24,14,43,.42)}.activity-insights-sessions-card article{padding:12px 0;border-bottom:1px solid rgba(155,120,219,.1)}.activity-insights-sessions-card article:last-child{border-bottom:0}.activity-insights-sessions-card article>div{display:flex;justify-content:space-between;gap:12px}.activity-insights-sessions-card article strong{color:#ddd5e6;font-size:.7rem;font-weight:550}.activity-insights-sessions-card article b{color:#c6a8f5;font-size:.68rem;font-weight:550}.activity-insights-sessions-card article p{margin:5px 0 0;color:#81788a;font-size:.6rem}.activity-insights-empty{padding:18px 0;color:#857d8e;font-size:.68rem;text-align:center}
      @media(max-width:390px){.activity-panel.activity-insights-panel{padding:22px 18px 20px}.activity-insights-rhythm-card,.activity-insights-pattern-card{padding-left:13px;padding-right:13px}.activity-insights-rhythm-row{grid-template-columns:58px minmax(0,1fr) 64px;gap:8px}.activity-insights-weekday-row{grid-template-columns:22px 61px minmax(0,1fr) 45px;gap:6px}}
    `;
    document.head.appendChild(style);
  }

  function openDirectory() {
    window.__PAUSE_ACTIVITIES__?.open?.('hub');
  }

  function closeOverlay() {
    clearInterval(liveTick);
    liveTick = null;
    document.querySelector('.activity-backdrop')?.remove();
  }

  function renderDayAudit(panel, activityId, key) {
    const selection = selectionFor(panel, activityId);
    const data = reportData(activityId, selection);
    if (!data) return openDirectory();
    panel.innerHTML = dayAuditMarkup(data, key);
    panel.querySelector('[data-activity-insights-back]')?.addEventListener('click', () => renderReport(panel, activityId));
    panel.querySelector('[data-activity-insights-close]')?.addEventListener('click', closeOverlay);
  }

  function bindReport(panel, activityId, data, selection) {
    panel.querySelector('[data-activity-insights-back]')?.addEventListener('click', openDirectory);
    panel.querySelector('[data-activity-insights-close]')?.addEventListener('click', closeOverlay);
    panel.querySelector('[data-activity-range-trigger]')?.addEventListener('click', () => {
      selection.menuOpen = !selection.menuOpen;
      renderReport(panel, activityId);
    });
    panel.querySelectorAll('[data-activity-days]').forEach((button) => button.addEventListener('click', () => {
      selection.mode = 'quick';
      selection.days = Number(button.dataset.activityDays) || 7;
      selection.menuOpen = false;
      selection.customOpen = false;
      const range = selectedRange(selection);
      selection.customStart = range.startKey;
      selection.customEnd = range.endKey;
      renderReport(panel, activityId);
    }));
    panel.querySelector('[data-activity-custom-toggle]')?.addEventListener('click', () => {
      selection.customOpen = !selection.customOpen;
      selection.menuOpen = true;
      renderReport(panel, activityId);
      if (selection.customOpen) panel.querySelector('[data-activity-custom-form] input')?.focus();
    });
    panel.querySelector('[data-activity-custom-form]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const start = String(form.get('start') || '');
      const end = String(form.get('end') || '');
      const error = panel.querySelector('[data-activity-custom-error]');
      const today = manilaKey();
      if (!validKey(start) || !validKey(end)) {
        if (error) error.textContent = 'Choose both dates.';
        return;
      }
      if (start > end) {
        if (error) error.textContent = 'Start date must be before end date.';
        return;
      }
      if (end > today) {
        if (error) error.textContent = 'The range cannot include future dates.';
        return;
      }
      selection.mode = 'custom';
      selection.customStart = start;
      selection.customEnd = end;
      selection.menuOpen = false;
      selection.customOpen = false;
      renderReport(panel, activityId);
    });
    panel.querySelectorAll('[data-activity-day]').forEach((button) => button.addEventListener('click', () => renderDayAudit(panel, activityId, button.dataset.activityDay)));
  }

  function updateLive(panel, activityId) {
    const selection = selectionFor(panel, activityId);
    const data = reportData(activityId, selection);
    if (!data) return;
    const total = panel.querySelector('[data-activity-insights-total]');
    const state = panel.querySelector('[data-activity-insights-state]');
    const average = panel.querySelector('[data-activity-insights-average]');
    const fill = panel.querySelector('[data-activity-insights-fill]');
    const percent = panel.querySelector('[data-activity-insights-percent]');
    if (total) total.textContent = duration(data.totalMs);
    if (state) state.textContent = data.status;
    if (average) average.textContent = duration(data.averageMs);
    if (fill && data.scored) fill.style.width = `${data.percent}%`;
    if (percent && data.scored) percent.textContent = `${data.percent}%`;
  }

  function renderReport(panel, activityId) {
    clearInterval(liveTick);
    liveTick = null;
    ensureStyles();
    const selection = selectionFor(panel, activityId);
    const data = reportData(activityId, selection);
    if (!data) return openDirectory();
    const analysis = analysisFor(data.activity, data.sessions);

    panel.classList.remove('system-panel', 'pause-view-insights');
    panel.classList.add('activity-insights-panel');
    panel.closest('.activity-backdrop')?.classList.remove('system-backdrop');
    panel.closest('.activity-backdrop')?.classList.add('activity-insights-backdrop');
    panel.dataset.activityReportView = '1';
    panel.dataset.activityReportId = String(activityId);
    panel.innerHTML = `<div data-activity-refined-root>
      ${headerMarkup(data.activity)}
      ${statusMarkup(data, selection)}
      ${rhythmMarkup(data)}
      ${streakMarkup(analysis)}
      ${patternMarkup(analysis)}
      <p class="activity-insights-note">PAUSE reflects the time you recorded for this activity.</p>
    </div>`;
    bindReport(panel, activityId, data, selection);

    if (String(data.state.active?.activityId) === String(activityId)) {
      liveTick = setInterval(() => {
        if (!panel.isConnected || !panel.querySelector('[data-activity-refined-root]')) return;
        updateLive(panel, activityId);
      }, 1000);
    }
  }

  function cleanupDirectory(panel) {
    clearInterval(liveTick);
    liveTick = null;
    if (!panel) return;
    panel.classList.remove('activity-insights-panel', 'system-panel', 'pause-view-insights');
    panel.closest('.activity-backdrop')?.classList.remove('activity-insights-backdrop', 'system-backdrop');
  }

  function enhance() {
    queued = false;
    const panel = document.querySelector('.activity-panel');
    if (!panel) return cleanupDirectory(null);
    if (!panel.dataset.activityReportView || !panel.dataset.activityReportId) return cleanupDirectory(panel);
    if (panel.querySelector('[data-activity-refined-root]')) return;
    renderReport(panel, panel.dataset.activityReportId);
  }

  function queueEnhance() {
    if (queued) return;
    queued = true;
    queueMicrotask(enhance);
  }

  if (typeof document !== 'undefined') {
    ensureStyles();
    new MutationObserver(queueEnhance).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('pause:activities-changed', queueEnhance);
    window.addEventListener('storage', queueEnhance);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queueEnhance, { once: true });
    else queueEnhance();
  }
})();
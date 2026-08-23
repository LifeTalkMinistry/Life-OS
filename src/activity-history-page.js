/* LIFE OS dedicated Activity History page. */
(() => {
  const TRACKER_KEY = 'life-os-v1-live-activity-tracker';
  let historyPageOpen = false;

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function readLogs() {
    try {
      const raw = localStorage.getItem(TRACKER_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return Array.isArray(parsed?.logs)
        ? parsed.logs.filter(Boolean).sort((a, b) => Number(b.endedAt || 0) - Number(a.endedAt || 0))
        : [];
    } catch {
      return [];
    }
  }

  function durationLabel(ms) {
    const totalMinutes = Math.max(1, Math.round(Number(ms || 0) / 60000));
    if (totalMinutes < 60) return `${totalMinutes}m`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  function timeLabel(timestamp) {
    const date = new Date(Number(timestamp || Date.now()));
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function dayLabel(timestamp) {
    const date = new Date(Number(timestamp || Date.now()));
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const key = date.toDateString();
    if (key === today.toDateString()) return 'Today';
    if (key === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }

  function groupedLogs(logs) {
    const groups = [];
    logs.forEach((log) => {
      const label = dayLabel(log.endedAt);
      let group = groups.find((item) => item.label === label);
      if (!group) {
        group = { label, logs: [] };
        groups.push(group);
      }
      group.logs.push(log);
    });
    return groups;
  }

  function summary(logs) {
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    const recent = logs.filter((log) => Number(log.endedAt || 0) >= sevenDaysAgo);
    const totalMs = recent.reduce((sum, log) => sum + Math.max(0, Number(log.durationMs || 0)), 0);
    return { count: recent.length, totalMs };
  }

  function renderHistoryPage() {
    historyPageOpen = true;
    const logs = readLogs();
    const recentSummary = summary(logs);
    const groups = groupedLogs(logs);
    const appNode = document.querySelector('#app');
    if (!appNode) return;

    appNode.innerHTML = `
      <section class="life-history-page" aria-label="Activity History">
        <header class="life-history-page-header">
          <button type="button" class="life-history-page-back" data-history-page-back aria-label="Back">‹</button>
          <div>
            <p>LIFE OS</p>
            <h1>Activity History</h1>
          </div>
        </header>

        <main class="life-history-page-body">
          <section class="life-history-page-summary" aria-label="Last 7 days summary">
            <div><strong>${recentSummary.count}</strong><span>ACTIVITIES</span></div>
            <div><strong>${recentSummary.count ? durationLabel(recentSummary.totalMs) : '0m'}</strong><span>TRACKED · 7 DAYS</span></div>
          </section>

          ${groups.length ? groups.map((group) => `
            <section class="life-history-day">
              <h2>${escapeHtml(group.label)}</h2>
              <div class="life-history-day-list">
                ${group.logs.map((log) => `
                  <article class="life-history-page-row">
                    <div class="life-history-page-row-main">
                      <strong>${escapeHtml(log.name || 'Activity')}</strong>
                      <span>${escapeHtml(timeLabel(log.startedAt))} – ${escapeHtml(timeLabel(log.endedAt))}</span>
                    </div>
                    <b>${durationLabel(log.durationMs)}</b>
                  </article>
                `).join('')}
              </div>
            </section>
          `).join('') : `
            <div class="life-history-page-empty">
              <strong>No activity yet.</strong>
              <p>Activities you finish will appear here.</p>
            </div>
          `}
        </main>
      </section>
    `;

    appNode.querySelector('[data-history-page-back]')?.addEventListener('click', () => {
      historyPageOpen = false;
      if (typeof render === 'function') render();
    });
  }

  document.addEventListener('click', (event) => {
    const historyControl = event.target.closest('[data-command-select="history"]');
    if (!historyControl) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    renderHistoryPage();
  }, true);

  const style = document.createElement('style');
  style.textContent = `
    .life-history-page{min-height:100svh;background:#030307;color:#fff;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:calc(env(safe-area-inset-top) + 26px) 22px calc(env(safe-area-inset-bottom) + 34px);box-sizing:border-box;overflow-y:auto}
    .life-history-page-header{max-width:680px;margin:0 auto 30px;display:flex;align-items:center;gap:14px}
    .life-history-page-header p{margin:0 0 5px;color:rgba(202,185,229,.48);font-size:.58rem;letter-spacing:.25em}
    .life-history-page-header h1{margin:0;font-size:1.5rem;font-weight:520;letter-spacing:-.02em}
    .life-history-page-back{width:38px;height:38px;display:grid;place-items:center;border:1px solid rgba(210,193,241,.14);border-radius:50%;background:rgba(255,255,255,.025);color:rgba(255,255,255,.88);font:300 1.85rem/1 sans-serif;cursor:pointer;padding:0 0 3px}
    .life-history-page-body{max-width:680px;margin:0 auto}
    .life-history-page-summary{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:34px}
    .life-history-page-summary>div{min-width:0;padding:18px 17px;border:1px solid rgba(199,176,245,.12);border-radius:18px;background:linear-gradient(145deg,rgba(110,75,180,.08),rgba(255,255,255,.018));box-shadow:inset 0 1px rgba(255,255,255,.025)}
    .life-history-page-summary strong{display:block;margin-bottom:7px;font-size:1.25rem;font-weight:560;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .life-history-page-summary span{display:block;color:rgba(211,199,226,.48);font-size:.55rem;letter-spacing:.15em}
    .life-history-day{margin:0 0 30px}
    .life-history-day h2{margin:0 0 11px;color:rgba(226,218,238,.58);font-size:.62rem;font-weight:560;letter-spacing:.16em;text-transform:uppercase}
    .life-history-day-list{border-top:1px solid rgba(214,199,240,.1)}
    .life-history-page-row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:17px 2px;border-bottom:1px solid rgba(214,199,240,.1)}
    .life-history-page-row-main{min-width:0;display:flex;flex-direction:column;gap:5px}
    .life-history-page-row-main strong{font-size:.96rem;font-weight:520;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .life-history-page-row-main span{color:rgba(216,205,229,.48);font-size:.7rem}
    .life-history-page-row>b{flex:0 0 auto;color:rgba(241,235,249,.8);font-size:.78rem;font-weight:540;font-variant-numeric:tabular-nums}
    .life-history-page-empty{padding:60px 10px;text-align:center;color:rgba(230,220,242,.58)}
    .life-history-page-empty strong{display:block;margin-bottom:8px;color:rgba(255,255,255,.85);font-size:1rem;font-weight:520}
    .life-history-page-empty p{margin:0;font-size:.78rem}
    @media (min-width:700px){.life-history-page{padding-left:36px;padding-right:36px}.life-history-page-header{margin-bottom:38px}}
  `;
  document.head.appendChild(style);

  window.__LIFE_OS_ACTIVITY_HISTORY_PAGE__ = {
    open: renderHistoryPage,
    isOpen: () => historyPageOpen
  };
})();

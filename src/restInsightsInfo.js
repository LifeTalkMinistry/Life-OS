let insightsObserver = null;
let scanQueued = false;

function ensureStyles() {
  if (document.querySelector('#pause-rest-insights-info-style')) return;

  const style = document.createElement('style');
  style.id = 'pause-rest-insights-info-style';
  style.textContent = `
    .pause-inline-info {
      appearance: none;
      display: inline-grid;
      place-items: center;
      width: 18px;
      height: 18px;
      margin-left: 7px;
      padding: 0;
      border: 1px solid rgba(176, 135, 239, .24);
      border-radius: 50%;
      background: rgba(102, 62, 166, .08);
      color: #8f839b;
      font: 650 .64rem/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
      text-transform: none;
      vertical-align: 2px;
      cursor: pointer;
      transition: border-color .16s ease, background .16s ease, color .16s ease;
    }

    .pause-inline-info:hover,
    .pause-inline-info:focus-visible {
      border-color: rgba(184, 142, 248, .42);
      background: rgba(111, 69, 184, .17);
      color: #e6dcf0;
      outline: none;
    }

    .pause-recovery-status-kicker .pause-inline-info {
      width: 17px;
      height: 17px;
      margin-left: 6px;
      vertical-align: 1px;
    }

    .pause-recovery-status-main {
      margin-top: 13px !important;
    }

    .pause-info-popover-layer {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(3, 2, 8, .58);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    .pause-info-popover {
      box-sizing: border-box;
      width: min(320px, 100%);
      padding: 18px 18px 16px;
      border: 1px solid rgba(177, 133, 242, .23);
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(20, 13, 38, .99), rgba(9, 6, 18, .99));
      box-shadow: 0 22px 60px rgba(0, 0, 0, .52), 0 0 24px rgba(125, 77, 198, .08);
    }

    .pause-info-popover-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 11px;
    }

    .pause-info-popover-head strong {
      color: #ebe4f2;
      font-size: .82rem;
      font-weight: 570;
      letter-spacing: .02em;
    }

    .pause-info-popover-close {
      appearance: none;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      background: transparent;
      color: #81778b;
      font-size: 1.05rem;
      cursor: pointer;
    }

    .pause-info-popover-close:hover,
    .pause-info-popover-close:focus-visible {
      color: #eee7f5;
      outline: none;
    }

    .pause-info-popover-copy {
      margin: 0;
      color: #9c92a6;
      font-size: .72rem;
      line-height: 1.6;
      white-space: pre-line;
    }
  `;
  document.head.appendChild(style);
}

function closeInfoPopover() {
  document.querySelector('[data-pause-info-popover-layer]')?.remove();
}

function showInfoPopover(title, copy) {
  closeInfoPopover();

  const layer = document.createElement('div');
  layer.className = 'pause-info-popover-layer';
  layer.dataset.pauseInfoPopoverLayer = '';

  const card = document.createElement('div');
  card.className = 'pause-info-popover';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', title);

  const head = document.createElement('div');
  head.className = 'pause-info-popover-head';

  const heading = document.createElement('strong');
  heading.textContent = title;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'pause-info-popover-close';
  close.setAttribute('aria-label', 'Close information');
  close.textContent = '×';

  const text = document.createElement('p');
  text.className = 'pause-info-popover-copy';
  text.textContent = copy;

  head.append(heading, close);
  card.append(head, text);
  layer.appendChild(card);
  document.body.appendChild(layer);

  const onKeyDown = (event) => {
    if (event.key !== 'Escape') return;
    document.removeEventListener('keydown', onKeyDown);
    closeInfoPopover();
  };

  close.addEventListener('click', () => {
    document.removeEventListener('keydown', onKeyDown);
    closeInfoPopover();
  });

  layer.addEventListener('click', (event) => {
    if (event.target !== layer) return;
    document.removeEventListener('keydown', onKeyDown);
    closeInfoPopover();
  });

  document.addEventListener('keydown', onKeyDown);
  close.focus();
}

function normalizedCopy(parts) {
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join('\n\n');
}

function addInfoButton(anchor, title, copy) {
  if (!anchor || !copy || anchor.querySelector(':scope > .pause-inline-info')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pause-inline-info';
  button.textContent = 'i';
  button.setAttribute('aria-label', `About ${title}`);
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    showInfoPopover(title, copy);
  });
  anchor.appendChild(button);
}

function cleanOverviewPanel(panel) {
  const hasOverview = Boolean(panel.querySelector('.pause-recovery-status-card, .pause-rhythm-hero'));
  const isDayAudit = Boolean(panel.querySelector('.pause-audit-score'));
  if (!hasOverview || isDayAudit) return;

  const intro = panel.querySelector(':scope > .system-panel-intro');
  const liveNote = panel.querySelector(':scope > .pause-live-data-note');
  const footerNote = panel.querySelector(':scope > .pause-insight-note');
  const headerCopy = normalizedCopy([
    intro?.textContent,
    liveNote?.textContent,
    footerNote?.textContent
  ]);

  const headerTitle = panel.querySelector('.system-panel-header h2');
  addInfoButton(headerTitle, 'Rest Insights', headerCopy);
  intro?.remove();
  liveNote?.remove();
  footerNote?.remove();

  const recoveryCard = panel.querySelector('.pause-recovery-status-card');
  if (recoveryCard) {
    const recoveryCopy = recoveryCard.querySelector('.pause-recovery-status-copy');
    const kicker = recoveryCard.querySelector('.pause-recovery-status-kicker');
    addInfoButton(kicker, 'Recovery Status', recoveryCopy?.textContent || 'Recovery Status compares your completed rest with the recovery target for the selected timeframe.');
    recoveryCopy?.remove();
  }

  panel.querySelectorAll('.pause-insight-section').forEach((section) => {
    const title = section.querySelector(':scope > .pause-insight-section-title');
    const copy = section.querySelector(':scope > .pause-insight-section-copy');
    if (!title || !copy) return;
    addInfoButton(title, title.childNodes[0]?.textContent?.trim() || 'Section information', copy.textContent);
    copy.remove();
  });
}

function scan() {
  const panels = document.querySelectorAll('.pause-view-insights');
  if (!panels.length) closeInfoPopover();
  panels.forEach(cleanOverviewPanel);
}

function queueScan() {
  if (scanQueued) return;
  scanQueued = true;
  queueMicrotask(() => {
    scanQueued = false;
    scan();
  });
}

export function initializeRestInsightsInfo() {
  if (typeof document === 'undefined' || insightsObserver) return;
  ensureStyles();
  insightsObserver = new MutationObserver(queueScan);
  insightsObserver.observe(document.documentElement, { childList: true, subtree: true });
  queueScan();
}

if (typeof document !== 'undefined') initializeRestInsightsInfo();

/* Activity Insights info behavior.
 * Matches the Rest Insights information affordance without coupling Activity
 * calculations or wording to the Rest implementation.
 */
(() => {
  const STYLE_ID = 'pause-activity-insights-info-behavior-style';
  const LAYER_SELECTOR = '[data-pause-info-popover-layer]';

  function ensureStyles() {
    if (document.querySelector('#pause-rest-insights-info-style') || document.querySelector(`#${STYLE_ID}`)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .activity-insights-info{cursor:pointer}
      .activity-insights-info:hover,.activity-insights-info:focus-visible{border-color:rgba(184,142,248,.42);background:rgba(111,69,184,.17);color:#e6dcf0;outline:none}
      .pause-info-popover-layer{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:24px;background:rgba(3,2,8,.58);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
      .pause-info-popover{box-sizing:border-box;width:min(320px,100%);padding:18px 18px 16px;border:1px solid rgba(177,133,242,.23);border-radius:16px;background:linear-gradient(180deg,rgba(20,13,38,.99),rgba(9,6,18,.99));box-shadow:0 22px 60px rgba(0,0,0,.52),0 0 24px rgba(125,77,198,.08)}
      .pause-info-popover-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:11px}
      .pause-info-popover-head strong{color:#ebe4f2;font-size:.82rem;font-weight:570;letter-spacing:.02em}
      .pause-info-popover-close{appearance:none;width:28px;height:28px;padding:0;border:0;background:transparent;color:#81778b;font-size:1.05rem;cursor:pointer}
      .pause-info-popover-close:hover,.pause-info-popover-close:focus-visible{color:#eee7f5;outline:none}
      .pause-info-popover-copy{margin:0;color:#9c92a6;font-size:.72rem;line-height:1.6;white-space:pre-line}
    `;
    document.head.appendChild(style);
  }

  function closePopover() {
    document.querySelector(LAYER_SELECTOR)?.remove();
  }

  function dialogTitle(button) {
    const label = String(button?.getAttribute('aria-label') || '').trim();
    if (/activity status/i.test(label)) return 'Activity Status';
    if (/streak/i.test(label)) return 'Activity Streak';
    if (/weekday|pattern/i.test(label)) return 'Activity Pattern';
    return 'Activity Information';
  }

  function showPopover(button) {
    const copy = String(button?.getAttribute('title') || '').trim();
    if (!copy) return;
    closePopover();

    const title = dialogTitle(button);
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
      closePopover();
    };

    close.addEventListener('click', () => {
      document.removeEventListener('keydown', onKeyDown);
      closePopover();
    });

    layer.addEventListener('click', (event) => {
      if (event.target !== layer) return;
      document.removeEventListener('keydown', onKeyDown);
      closePopover();
    });

    document.addEventListener('keydown', onKeyDown);
    close.focus();
  }

  function onClick(event) {
    const button = event.target?.closest?.('.activity-insights-info');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    showPopover(button);
  }

  function init() {
    ensureStyles();
    document.addEventListener('click', onClick);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

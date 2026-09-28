/* Activity status info parity.
 * The status ⓘ behaves like Rest Insights: explanation expands inside the
 * status card instead of opening a full-screen information dialog.
 */
(() => {
  const STYLE_ID = 'pause-activity-status-inline-style';

  function ensureStyles() {
    if (document.querySelector(`#${STYLE_ID}`)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .activity-insights-status-help {
        box-sizing: border-box;
        width: 100%;
        margin: 10px auto 0;
        padding: 12px 14px;
        border: 1px solid rgba(174, 126, 255, .22);
        border-radius: 11px;
        background: rgba(15, 9, 29, .34);
        color: #9a90a4;
        font-size: .64rem;
        font-weight: 430;
        line-height: 1.55;
        text-align: center;
      }

      .activity-insights-status-help[hidden] {
        display: none;
      }

      .activity-insights-status-line .activity-insights-info[aria-expanded='true'] {
        border-color: rgba(184, 142, 248, .42);
        background: rgba(111, 69, 184, .17);
        color: #e6dcf0;
      }
    `;
    document.head.appendChild(style);
  }

  function statusButtonFromEvent(event) {
    const button = event.target?.closest?.('.activity-insights-status-line .activity-insights-info');
    return button || null;
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

  function onClick(event) {
    const button = statusButtonFromEvent(event);
    if (!button) return;

    // Capture before activityInsightsInfo.js so this status control never
    // falls through to the modal/popover behavior used by other info icons.
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleInlineStatus(button);
  }

  function onKeyDown(event) {
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

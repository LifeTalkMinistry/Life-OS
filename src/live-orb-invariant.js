/* Raw Finish Sunday diagnostic.
 *
 * This targets the actual dynamically inserted Finish Sunday shortcut from
 * setup-copy-day.js: data-finish-current-day="0". The prior diagnostic looked
 * for data-setup-action="activity-day-next", but that attribute does not exist
 * on this button; its click handler calls handleSetupAction() directly.
 */
(() => {
  function showRawWelcome() {
    clearTimeout(setupTimer);
    clearTimeout(launchTimer);
    clearTimeout(completionTimer);

    screen = 'raw-finish-sunday-diagnostic';

    app.innerHTML = '<div id="raw-finish-sunday-welcome">WELCOME</div>';
    const node = document.getElementById('raw-finish-sunday-welcome');
    if (!node) return;

    node.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483647',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:#000',
      'color:#fff',
      'font-family:Arial,sans-serif',
      'font-size:42px',
      'font-weight:700',
      'letter-spacing:.12em'
    ].join(';');
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element
      ? event.target.closest('[data-finish-current-day="0"]')
      : null;

    if (!target || screen !== 'setup') return;

    event.preventDefault();
    event.stopImmediatePropagation();
    showRawWelcome();
  }, true);
})();

/* Raw Finish Sunday diagnostic.
 *
 * This intercepts the exact final activity-mapping action on Sunday BEFORE
 * LIFE OS attempts to render the Review screen. It intentionally bypasses
 * goSetup('review'), reviewContent(), MainScreen(), Orb(), SVG layering, and
 * bundled CSS so we can isolate whether the Sunday button itself reaches JS.
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
      ? event.target.closest('[data-setup-action="activity-day-next"]')
      : null;

    if (!target || screen !== 'setup' || setupActivityDay !== 0) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    showRawWelcome();
  }, true);
})();

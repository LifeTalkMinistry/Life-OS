/* Raw onboarding completion diagnostic.
 *
 * This intentionally bypasses every LIFE OS render layer after the final
 * onboarding button: no finishLifeSetup(), no MainScreen(), no Orb(), no SVG,
 * no animation, and no app CSS dependency. If this text appears on Android,
 * the final onboarding click is reaching JavaScript and the failure lives in a
 * later render/state layer rather than the click/navigation itself.
 */
(() => {
  function showRawWelcome() {
    clearTimeout(setupTimer);
    clearTimeout(launchTimer);
    clearTimeout(completionTimer);

    screen = 'raw-onboarding-diagnostic';

    app.innerHTML = '<div id="raw-onboarding-welcome">WELCOME</div>';
    const node = document.getElementById('raw-onboarding-welcome');
    if (!node) return;

    // Inline-only styling on purpose: this test must not depend on any bundled
    // stylesheet, Orb stacking context, viewport media query, or animation.
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
      ? event.target.closest('[data-setup-action="review-confirm"]')
      : null;

    if (!target || screen !== 'setup') return;

    event.preventDefault();
    event.stopImmediatePropagation();
    showRawWelcome();
  }, true);
})();

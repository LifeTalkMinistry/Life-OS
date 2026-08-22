/* Temporary post-onboarding diagnostic.
 *
 * After the reconstructed onboarding controller successfully validates,
 * persists, reads back, and builds the completed Life Map, replace the live
 * Orb with a plain WELCOME screen. This isolates the onboarding completion
 * handoff from MainScreen()/Orb() rendering.
 */
(() => {
  const baseFinishLifeSetup = finishLifeSetup;

  function showWelcomeDiagnostic() {
    const view = document.createElement('section');
    view.className = 'screen main-screen';
    view.style.display = 'grid';
    view.style.placeItems = 'center';
    view.style.minHeight = '100dvh';
    view.style.padding = '24px';
    view.innerHTML = `
      <div style="text-align:center;color:white;font-family:system-ui,sans-serif;">
        <h1 style="margin:0;font-size:42px;letter-spacing:.12em;font-weight:600;">WELCOME</h1>
        <p style="margin:16px 0 0;opacity:.65;font-size:14px;letter-spacing:.08em;">ONBOARDING COMPLETED</p>
      </div>
    `;
    app.replaceChildren(view);
  }

  finishLifeSetup = function diagnosticFinishLifeSetup() {
    const completed = baseFinishLifeSetup();
    if (completed === true) {
      screen = 'post-setup-welcome';
      showWelcomeDiagnostic();
    }
    return completed;
  };
})();

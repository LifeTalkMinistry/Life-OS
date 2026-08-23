/* LIFE OS — keep post-activity save decision minimal inside the orb. */
(() => {
  const priorMainScreen = MainScreen;
  MainScreen = function SaveActivityQuestionMainScreen() {
    const view = priorMainScreen();
    const saveButton = view?.querySelector?.('.life-tracker-save .life-tracker-primary');
    if (saveButton) saveButton.textContent = 'SAVE ACTIVITY?';
    return view;
  };

  const style = document.createElement('style');
  style.textContent = `
    .life-tracker-save .orb-kicker,
    .life-tracker-save .orb-title,
    .life-tracker-save .life-tracker-duration,
    .life-tracker-save .life-tracker-save-copy{
      display:none!important;
    }
    .life-tracker-save{
      width:100%!important;
      height:100%!important;
      display:flex!important;
      flex-direction:column!important;
      align-items:center!important;
      justify-content:center!important;
      gap:1rem!important;
    }
    .life-tracker-save .life-tracker-primary{
      margin:0!important;
    }
    .life-tracker-save .life-tracker-secondary{
      margin:0!important;
      padding:.65rem 1rem!important;
    }
  `;
  document.head.appendChild(style);
})();

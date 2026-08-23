/* LIFE OS — Start Activity shows either typing mode or saved activity mode, never both. */
(() => {
  const priorMainScreen = MainScreen;

  MainScreen = function EntrySavedToggleMainScreen() {
    const view = priorMainScreen();
    const entry = view.querySelector?.('.life-tracker-entry-clean');
    if (!entry) return view;

    const savedBlock = entry.querySelector('.life-entry-saved');
    const composer = entry.querySelector('.life-activity-composer');
    if (!savedBlock || !composer) return view;

    savedBlock.classList.add('is-collapsed');

    const openSaved = document.createElement('button');
    openSaved.type = 'button';
    openSaved.className = 'life-entry-saved-toggle';
    openSaved.textContent = 'SAVED ACTIVITY';
    openSaved.setAttribute('aria-expanded', 'false');

    const back = entry.querySelector('.life-view-back');
    entry.insertBefore(openSaved, back || null);

    openSaved.addEventListener('click', (event) => {
      event.stopPropagation();
      savedBlock.classList.add('is-open');
      savedBlock.classList.remove('is-collapsed');
      composer.classList.add('is-hidden-for-saved');
      openSaved.remove();
    });

    return view;
  };

  const style = document.createElement('style');
  style.textContent = `
    .life-entry-saved.is-collapsed{display:none!important}
    .life-entry-saved.is-open{display:flex!important}
    .life-activity-composer.is-hidden-for-saved{display:none!important}
    .life-entry-saved-toggle{
      width:72%;
      max-width:280px;
      padding:.78rem 1rem;
      border:1px solid rgba(202,178,255,.30);
      border-radius:999px;
      background:rgba(112,74,255,.08);
      color:rgba(255,255,255,.92);
      font:600 .74rem/1 Inter,ui-sans-serif,sans-serif;
      letter-spacing:.12em;
      cursor:pointer;
    }
    .life-entry-saved.is-open{
      width:72%;
      max-width:280px;
      max-height:230px;
      overflow-y:auto;
      margin-top:.1rem;
      scrollbar-width:none;
    }
    .life-entry-saved.is-open::-webkit-scrollbar{display:none}
  `;
  document.head.appendChild(style);
})();

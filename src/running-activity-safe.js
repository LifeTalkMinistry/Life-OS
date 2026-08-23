/* LIFE OS — stable running activity layout: activity name outside the orb, timer inside. */
(() => {
  const priorMainScreen = MainScreen;

  MainScreen = function RunningActivityMainScreen() {
    const view = priorMainScreen();
    let state = null;
    try { state = window.__LIFE_OS_TRACKER__?.getState?.(); } catch {}

    if (!state?.active?.name) return view;

    const stage = view.querySelector?.('.life-tracker-screen .orb-stage, .orb-stage');
    const running = view.querySelector?.('.life-tracker-running');
    if (!stage || !running) return view;

    const title = running.querySelector('.orb-title');
    if (title) title.remove();

    const label = document.createElement('div');
    label.className = 'life-running-activity-label';
    label.textContent = String(state.active.name || '').trim();
    label.setAttribute('aria-label', `Running activity: ${label.textContent}`);
    stage.insertBefore(label, stage.firstChild);

    return view;
  };

  const style = document.createElement('style');
  style.textContent = `
    .life-tracker-screen .orb-stage{position:relative}
    .life-tracker-running{gap:.78rem!important}
    .life-running-activity-label{
      position:absolute;
      left:50%;
      top:calc(50% - min(42vw, 260px));
      transform:translateX(-50%);
      width:min(88vw,520px);
      padding:0 18px;
      box-sizing:border-box;
      color:rgba(250,248,255,.94);
      font:560 clamp(1rem,4.2vw,1.3rem)/1.28 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      letter-spacing:.01em;
      text-align:center;
      display:-webkit-box;
      -webkit-box-orient:vertical;
      -webkit-line-clamp:2;
      overflow:hidden;
      text-overflow:ellipsis;
      pointer-events:none;
      z-index:7;
    }
    @media (max-width:420px){
      .life-running-activity-label{
        top:calc(50% - 225px);
        width:90vw;
        font-size:1.02rem;
      }
    }
  `;
  document.head.appendChild(style);
})();

function ensureInsightLinkStyles() {
  if (document.querySelector('#pause-home-insights-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-home-insights-style';
  style.textContent = `
    .pause-menu-carousel {
      position: absolute;
      left: 0;
      top: calc(min(41vw, 195px) + 18px);
      width: min(76vw, 310px);
      margin: 0;
      transform: translateX(-50%);
      z-index: 5;
      display: grid;
      justify-items: center;
      text-align: center;
    }

    .pause-home-insights-button {
      appearance: none;
      display: block;
      width: 100%;
      max-width: 310px;
      margin: 0 auto;
      padding: 12px 14px 11px;
      border: 0;
      border-top: 1px solid rgba(157, 118, 223, .14);
      border-bottom: 1px solid rgba(157, 118, 223, .14);
      background: transparent;
      color: #ece7f2;
      text-align: center;
      cursor: pointer;
    }

    .pause-home-insights-button strong,
    .pause-home-insights-button span {
      width: 100%;
      text-align: center;
    }

    .pause-home-insights-button strong {
      display: block;
      font-size: clamp(.84rem, 3.3vw, 1rem);
      font-weight: 480;
      letter-spacing: .025em;
    }

    .pause-home-insights-button span {
      display: block;
      margin-top: 4px;
      color: #807889;
      font-size: clamp(.58rem, 2.35vw, .68rem);
      letter-spacing: .03em;
    }

    .pause-home-insights-button:hover,
    .pause-home-insights-button:focus-visible {
      color: #fff;
      background: rgba(114, 76, 190, .08);
      outline: none;
    }

    @media (max-height: 620px) {
      .pause-menu-carousel {
        top: calc(min(41vw, 195px) + 10px);
      }
      .pause-home-insights-button {
        padding-block: 9px;
      }
    }
  `;
  document.head.appendChild(style);
}

export function TodayRing(onSelect) {
  ensureInsightLinkStyles();

  const nav = document.createElement('nav');
  nav.className = 'pause-menu-carousel';
  nav.setAttribute('aria-label', 'PAUSE insights');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pause-home-insights-button';
  button.dataset.pauseMenu = 'insights';
  button.innerHTML = '<strong>Rest Insights</strong><span>Understand your rest patterns</span>';
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onSelect?.('insights');
  });

  nav.appendChild(button);
  return nav;
}

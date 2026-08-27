const ITEMS = [
  { id: 'take-rest', label: 'Take a Rest' },
  { id: 'history', label: 'Rest History' },
  { id: 'insights', label: 'Rest Insights' },
  { id: 'my-rests', label: 'My Rests' }
];

function ensureCarouselStyles() {
  if (document.querySelector('#pause-menu-carousel-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-menu-carousel-style';
  style.textContent = `
    .pause-menu-carousel {
      position: absolute;
      left: 0;
      top: calc(min(41vw, 195px) + 14px);
      width: min(76vw, 310px);
      height: clamp(82px, 15svh, 128px);
      transform: translateX(-50%);
      z-index: 5;
      overflow: hidden;
      mask-image: linear-gradient(to bottom, transparent 0, #000 14%, #000 86%, transparent 100%);
      -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 14%, #000 86%, transparent 100%);
    }

    .pause-menu-scroller {
      height: 100%;
      overflow-y: auto;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      scroll-snap-type: y proximity;
      scrollbar-width: none;
      padding: 9px 0;
    }

    .pause-menu-scroller::-webkit-scrollbar {
      display: none;
    }

    .pause-menu-carousel-item {
      appearance: none;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 44px;
      padding: 8px 14px;
      border: 0;
      border-bottom: 1px solid rgba(157, 118, 223, .14);
      background: transparent;
      color: #e9e4ef;
      font-size: clamp(.82rem, 3.3vw, 1rem);
      font-weight: 430;
      letter-spacing: .025em;
      text-align: center;
      cursor: pointer;
      scroll-snap-align: center;
      transition: color 150ms ease, background 150ms ease;
    }

    .pause-menu-carousel-item:last-child {
      border-bottom: 0;
    }

    .pause-menu-carousel-item:hover,
    .pause-menu-carousel-item:focus-visible {
      color: #fff;
      background: rgba(114, 76, 190, .11);
      outline: none;
    }

    @media (max-height: 620px) {
      .pause-menu-carousel {
        top: calc(min(41vw, 195px) + 8px);
        height: 76px;
      }
      .pause-menu-carousel-item {
        min-height: 40px;
        padding-block: 6px;
      }
    }
  `;
  document.head.appendChild(style);
}

export function TodayRing(onSelect) {
  ensureCarouselStyles();

  const carousel = document.createElement('nav');
  carousel.className = 'pause-menu-carousel';
  carousel.setAttribute('aria-label', 'PAUSE main menu');

  const scroller = document.createElement('div');
  scroller.className = 'pause-menu-scroller';
  scroller.setAttribute('role', 'list');

  ITEMS.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pause-menu-carousel-item';
    button.dataset.pauseMenu = item.id;
    button.setAttribute('role', 'listitem');
    button.textContent = item.label;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onSelect?.(item.id);
    });
    button.addEventListener('focus', () => {
      button.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    });
    scroller.appendChild(button);
  });

  carousel.appendChild(scroller);
  return carousel;
}

function ensurePauseStartChooserStyles() {
  if (document.querySelector('#pause-start-chooser-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-start-chooser-style';
  style.textContent = `
    .pause-start-chooser {
      position: absolute;
      left: 0;
      top: 0;
      width: min(96vw, 440px);
      height: min(58svh, 470px);
      min-height: 390px;
      z-index: 6;
      pointer-events: none;
      transform: translate(-50%, -50%);
      animation: pause-start-chooser-in 170ms ease both;
    }

    .pause-start-choice {
      appearance: none;
      position: absolute;
      width: clamp(72px, 20vw, 88px);
      height: clamp(72px, 20vw, 88px);
      padding: 9px;
      border: 1px solid rgba(188, 145, 248, .28);
      border-radius: 50%;
      background: radial-gradient(circle at 50% 28%, rgba(67, 38, 111, .92), rgba(13, 8, 24, .97) 72%);
      color: #eee8f5;
      box-shadow: 0 12px 30px rgba(0, 0, 0, .34), inset 0 0 24px rgba(122, 79, 190, .08);
      display: grid;
      place-items: center;
      text-align: center;
      pointer-events: auto;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transform: translate(-50%, -50%);
      transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
    }

    .pause-start-choice:is(:hover, :focus-visible) {
      border-color: rgba(217, 181, 255, .68);
      background: radial-gradient(circle at 50% 28%, rgba(95, 54, 155, .96), rgba(18, 10, 33, .98) 72%);
      outline: none;
      transform: translate(-50%, -50%) scale(1.055);
    }

    .pause-start-choice strong {
      display: -webkit-box;
      max-width: 100%;
      overflow: hidden;
      color: #f0eaf6;
      font-size: clamp(.62rem, 2.7vw, .74rem);
      font-weight: 620;
      line-height: 1.16;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .pause-start-choice small {
      display: block;
      margin-top: 3px;
      color: #a89db2;
      font-size: .5rem;
      line-height: 1;
    }

    .pause-start-choice.is-rest {
      border-color: rgba(155, 126, 255, .48);
      background: radial-gradient(circle at 50% 28%, rgba(68, 55, 154, .92), rgba(12, 8, 29, .98) 72%);
      box-shadow: 0 0 26px rgba(83, 61, 255, .16), 0 12px 30px rgba(0, 0, 0, .34);
    }

    .pause-start-choice.is-more {
      border-style: dashed;
      color: #c8b7d9;
    }

    @keyframes pause-start-chooser-in {
      from { opacity: 0; transform: translate(-50%, -50%) scale(.97); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }

    @media (max-width: 380px), (max-height: 650px) {
      .pause-start-chooser {
        width: min(96vw, 370px);
        height: min(56svh, 410px);
        min-height: 350px;
      }

      .pause-start-choice {
        width: clamp(64px, 18vw, 76px);
        height: clamp(64px, 18vw, 76px);
        padding: 7px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .pause-start-chooser { animation: none; }
      .pause-start-choice { transition: none; }
    }
  `;
  document.head.appendChild(style);
}

const ACTIVITY_SLOTS = [
  { left: '50%', top: '7%' },
  { left: '12%', top: '28%' },
  { left: '88%', top: '28%' },
  { left: '10%', top: '69%' },
  { left: '90%', top: '69%' }
];
const REST_SLOT = { left: '50%', top: '94%' };

export function getPauseStartChoices(activities = []) {
  return [
    { id: 'rest', type: 'rest', label: 'Rest' },
    ...activities
      .filter((activity) => activity?.id && activity?.name)
      .map((activity) => ({ id: activity.id, type: 'activity', label: String(activity.name) }))
  ];
}

function position(button, slot) {
  button.style.left = slot.left;
  button.style.top = slot.top;
}

export function PauseStartChooser({ activities = [], onRest, onActivity }) {
  ensurePauseStartChooserStyles();

  const nav = document.createElement('nav');
  nav.className = 'pause-start-chooser';
  nav.setAttribute('aria-label', 'Choose Rest or an activity');

  const cleanActivities = activities
    .filter((activity) => activity?.id && activity?.name)
    .map((activity) => ({ ...activity, name: String(activity.name) }));
  const pageSize = cleanActivities.length > ACTIVITY_SLOTS.length ? ACTIVITY_SLOTS.length - 1 : ACTIVITY_SLOTS.length;
  const pageCount = Math.max(1, Math.ceil(cleanActivities.length / pageSize));
  let page = 0;

  const renderPage = () => {
    nav.replaceChildren();

    const rest = document.createElement('button');
    rest.type = 'button';
    rest.className = 'pause-start-choice is-rest';
    rest.dataset.pauseStartChoice = 'rest';
    rest.setAttribute('aria-label', 'Start Rest');
    rest.innerHTML = '<span><strong>Rest</strong><small>PAUSE</small></span>';
    position(rest, REST_SLOT);
    rest.addEventListener('click', (event) => {
      event.stopPropagation();
      onRest?.();
    });
    nav.appendChild(rest);

    const start = page * pageSize;
    const visible = cleanActivities.slice(start, start + pageSize);
    visible.forEach((activity, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pause-start-choice';
      button.dataset.pauseStartChoice = activity.id;
      button.setAttribute('aria-label', `Start ${activity.name}`);
      button.title = activity.name;
      button.innerHTML = `<span><strong></strong><small>ACTIVITY</small></span>`;
      button.querySelector('strong').textContent = activity.name;
      position(button, ACTIVITY_SLOTS[index]);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        onActivity?.(activity.id);
      });
      nav.appendChild(button);
    });

    if (pageCount > 1) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'pause-start-choice is-more';
      more.dataset.pauseStartMore = '1';
      more.setAttribute('aria-label', 'Show more activities');
      more.innerHTML = `<span><strong>More</strong><small>${page + 1}/${pageCount}</small></span>`;
      position(more, ACTIVITY_SLOTS[ACTIVITY_SLOTS.length - 1]);
      more.addEventListener('click', (event) => {
        event.stopPropagation();
        page = (page + 1) % pageCount;
        renderPage();
      });
      nav.appendChild(more);
    }
  };

  renderPage();
  return nav;
}

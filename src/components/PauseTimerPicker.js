function ensurePauseTimerPickerStyles() {
  if (document.querySelector('#pause-timer-picker-style')) return;
  const style = document.createElement('style');
  style.id = 'pause-timer-picker-style';
  style.textContent = `
    .pause-timer-panel {
      width: min(92vw, 380px);
      padding: 22px;
    }

    .pause-timer-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }

    .pause-timer-header p {
      margin: 0 0 6px;
      color: #81788a;
      font-size: .6rem;
      font-weight: 650;
      letter-spacing: .14em;
    }

    .pause-timer-header h2 {
      margin: 0;
      color: #f0eaf5;
      font-size: 1.32rem;
      font-weight: 470;
      letter-spacing: -.015em;
    }

    .pause-timer-close {
      appearance: none;
      display: grid;
      place-items: center;
      flex: 0 0 34px;
      width: 34px;
      height: 34px;
      padding: 0;
      border: 1px solid rgba(159, 121, 218, .16);
      border-radius: 50%;
      background: rgba(79, 47, 130, .08);
      color: #a9a0b3;
      font-size: 1rem;
      cursor: pointer;
    }

    .pause-timer-copy {
      margin: 0 0 17px;
      color: #91889b;
      font-size: .72rem;
      line-height: 1.55;
    }

    .pause-timer-options {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 9px;
    }

    .pause-timer-option,
    .pause-timer-no-limit,
    .pause-timer-custom button {
      appearance: none;
      min-height: 48px;
      border: 1px solid rgba(163, 124, 224, .16);
      border-radius: 13px;
      background: rgba(18, 11, 35, .48);
      color: #ddd4e7;
      font-size: .78rem;
      font-weight: 540;
      cursor: pointer;
    }

    .pause-timer-option:hover,
    .pause-timer-option:focus-visible,
    .pause-timer-no-limit:hover,
    .pause-timer-no-limit:focus-visible,
    .pause-timer-custom button:hover,
    .pause-timer-custom button:focus-visible {
      border-color: rgba(177, 135, 247, .32);
      background: rgba(91, 54, 148, .15);
      outline: none;
    }

    .pause-timer-custom {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 9px;
      margin-top: 10px;
    }

    .pause-timer-custom label {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 10px;
      min-height: 48px;
      padding: 0 13px;
      border: 1px solid rgba(163, 124, 224, .14);
      border-radius: 13px;
      background: rgba(13, 9, 27, .44);
    }

    .pause-timer-custom span {
      color: #91889a;
      font-size: .69rem;
    }

    .pause-timer-custom input {
      width: 72px;
      min-width: 0;
      border: 0;
      background: transparent;
      color: #eee7f5;
      font-size: 1rem;
      text-align: right;
      outline: none;
    }

    .pause-timer-custom button {
      min-width: 74px;
      padding: 0 14px;
    }

    .pause-timer-error {
      min-height: 18px;
      margin: 7px 0 0;
      color: #c6a8d9;
      font-size: .65rem;
      text-align: center;
    }

    .pause-timer-no-limit {
      width: 100%;
      margin-top: 2px;
      border-color: transparent;
      background: transparent;
      color: #81798a;
      font-size: .69rem;
      font-weight: 500;
    }
  `;
  document.head.appendChild(style);
}

export function PauseTimerPicker({ onSelect, onClose }) {
  ensurePauseTimerPickerStyles();

  const backdrop = document.createElement('div');
  backdrop.className = 'system-backdrop pause-backdrop';

  const panel = document.createElement('section');
  panel.className = 'system-panel pause-timer-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Set a pause timer');
  panel.innerHTML = `
    <div class="pause-timer-header">
      <div>
        <p>PAUSE TIMER</p>
        <h2>How long do you want?</h2>
      </div>
      <button type="button" class="pause-timer-close" data-timer-close aria-label="Close timer picker">×</button>
    </div>
    <p class="pause-timer-copy">PAUSE will ring when the timer is done. Your rest will keep running until you choose to end it.</p>
    <div class="pause-timer-options" role="group" aria-label="Quick timer choices">
      <button type="button" class="pause-timer-option" data-timer-minutes="5">5 min</button>
      <button type="button" class="pause-timer-option" data-timer-minutes="10">10 min</button>
      <button type="button" class="pause-timer-option" data-timer-minutes="15">15 min</button>
      <button type="button" class="pause-timer-option" data-timer-minutes="30">30 min</button>
      <button type="button" class="pause-timer-option" data-timer-minutes="45">45 min</button>
      <button type="button" class="pause-timer-option" data-timer-minutes="60">1 hour</button>
    </div>
    <form class="pause-timer-custom">
      <label><span>Custom minutes</span><input name="minutes" type="number" inputmode="numeric" min="1" max="720" placeholder="20" aria-label="Custom timer minutes"></label>
      <button type="submit">Start</button>
    </form>
    <p class="pause-timer-error" aria-live="polite"></p>
    <button type="button" class="pause-timer-no-limit" data-timer-no-limit>Start without a timer</button>
  `;

  panel.querySelectorAll('[data-timer-minutes]').forEach((button) => {
    button.addEventListener('click', () => onSelect?.(Number(button.dataset.timerMinutes)));
  });

  panel.querySelector('[data-timer-no-limit]')?.addEventListener('click', () => onSelect?.(null));
  panel.querySelector('[data-timer-close]')?.addEventListener('click', () => onClose?.());

  panel.querySelector('.pause-timer-custom')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const minutes = Number(form.get('minutes'));
    const error = panel.querySelector('.pause-timer-error');

    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 720) {
      if (error) error.textContent = 'Choose a timer between 1 and 720 minutes.';
      return;
    }

    if (error) error.textContent = '';
    onSelect?.(Math.round(minutes));
  });

  backdrop.addEventListener('pointerdown', (event) => {
    if (event.target === backdrop) onClose?.();
  });

  backdrop.appendChild(panel);
  return backdrop;
}

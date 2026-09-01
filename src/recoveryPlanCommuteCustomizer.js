let pauseCommuteCustomizeOpen = false;
let pauseCommuteCustomizerObserver = null;
let pauseCommuteCustomizerQueued = false;

function pauseIsCommuteSetup(content) {
  const eyebrow = content?.querySelector('.recovery-plan-eyebrow')?.textContent?.trim();
  return eyebrow === 'AFTER SHIFT' && Boolean(content.querySelector('[data-plan-clock="homeAt"]'));
}

function pauseCustomizeCommuteSetup(content) {
  if (!pauseIsCommuteSetup(content)) return;

  const heading = content.querySelector('h1');
  if (heading) heading.textContent = 'How long does it usually take you to get home?';

  const timeGrid = content.querySelector('.recovery-plan-time-grid');
  const options = content.querySelector('.recovery-plan-options');
  if (!timeGrid || !options) return;

  const notes = [...content.querySelectorAll('.recovery-plan-note')];
  const choiceNote = notes.find((note) => note.textContent.includes('Or choose your usual commute length'));
  choiceNote?.remove();

  let customizeButton = options.querySelector('[data-pause-commute-customize]');
  if (!customizeButton) {
    customizeButton = document.createElement('button');
    customizeButton.type = 'button';
    customizeButton.className = 'recovery-plan-option';
    customizeButton.dataset.pauseCommuteCustomize = 'true';
    customizeButton.textContent = 'Customize';
    options.appendChild(customizeButton);
  }

  customizeButton.classList.toggle('is-selected', pauseCommuteCustomizeOpen);
  customizeButton.setAttribute('aria-expanded', pauseCommuteCustomizeOpen ? 'true' : 'false');

  if (pauseCommuteCustomizeOpen) {
    const labels = timeGrid.querySelectorAll('label span');
    if (labels[0]) labels[0].textContent = 'From';
    if (labels[1]) labels[1].textContent = 'To';
    timeGrid.hidden = false;
    options.insertAdjacentElement('afterend', timeGrid);
  } else {
    timeGrid.hidden = true;
  }

  if (!customizeButton.dataset.pauseCommuteBound) {
    customizeButton.dataset.pauseCommuteBound = 'true';
    customizeButton.addEventListener('click', () => {
      pauseCommuteCustomizeOpen = !pauseCommuteCustomizeOpen;
      pauseCustomizeCommuteSetup(content);
      if (pauseCommuteCustomizeOpen) {
        content.querySelector('[data-plan-clock="homeAt"]')?.focus({ preventScroll: true });
      }
    });
  }
}

function pauseScanCommuteSetup() {
  const content = document.querySelector('.recovery-plan-overlay .recovery-plan-content');
  if (!content) {
    pauseCommuteCustomizeOpen = false;
    return;
  }
  if (!pauseIsCommuteSetup(content)) {
    pauseCommuteCustomizeOpen = false;
    return;
  }
  pauseCustomizeCommuteSetup(content);
}

function pauseQueueCommuteSetupScan() {
  if (pauseCommuteCustomizerQueued) return;
  pauseCommuteCustomizerQueued = true;
  queueMicrotask(() => {
    pauseCommuteCustomizerQueued = false;
    pauseScanCommuteSetup();
  });
}

export function initializePauseCommuteCustomizer() {
  if (typeof document === 'undefined' || pauseCommuteCustomizerObserver) return;
  pauseCommuteCustomizerObserver = new MutationObserver(pauseQueueCommuteSetupScan);
  pauseCommuteCustomizerObserver.observe(document.documentElement, { childList: true, subtree: true });
  pauseQueueCommuteSetupScan();
}

if (typeof document !== 'undefined') initializePauseCommuteCustomizer();

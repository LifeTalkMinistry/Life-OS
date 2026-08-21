import { activityIconOptions, activityIconSvgMarkup } from './activity-icons.js';

let setupIconModalRestoreFocus = null;

function setupIconModalSelectedId() {
  return window.__LIFE_OS__?.getState?.()?.setupActivityDraft?.icon || 'general';
}

function setupIconModalClose() {
  const modal = document.querySelector('.setup-icon-modal');
  if (!modal) return;
  modal.remove();
  const restore = setupIconModalRestoreFocus;
  setupIconModalRestoreFocus = null;
  if (restore?.isConnected) restore.focus();
}

function setupIconModalChoose(iconId) {
  const sourceButton = document.querySelector(`.setup-step-activities [data-setup-activity-icon="${CSS.escape(iconId)}"]`);
  setupIconModalClose();
  sourceButton?.click();
}

function setupIconModalBuild(trigger) {
  setupIconModalClose();
  setupIconModalRestoreFocus = trigger;
  const selected = setupIconModalSelectedId();

  const modal = document.createElement('div');
  modal.className = 'setup-icon-modal';
  modal.setAttribute('role', 'presentation');

  const panel = document.createElement('section');
  panel.className = 'setup-icon-modal-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'setup-icon-modal-title');

  const header = document.createElement('div');
  header.className = 'setup-icon-modal-header';

  const headingWrap = document.createElement('div');
  const eyebrow = document.createElement('p');
  eyebrow.className = 'setup-icon-modal-eyebrow';
  eyebrow.textContent = 'ACTIVITY ICON';
  const title = document.createElement('h2');
  title.id = 'setup-icon-modal-title';
  title.textContent = 'Choose an icon';
  headingWrap.append(eyebrow, title);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'setup-icon-modal-close';
  closeButton.setAttribute('aria-label', 'Close icon picker');
  closeButton.textContent = '×';
  closeButton.addEventListener('click', setupIconModalClose);
  header.append(headingWrap, closeButton);

  const grid = document.createElement('div');
  grid.className = 'setup-icon-modal-grid';
  grid.setAttribute('role', 'list');

  activityIconOptions.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `setup-icon-modal-option${selected === option.id ? ' is-selected' : ''}`;
    button.dataset.iconId = option.id;
    button.setAttribute('role', 'listitem');
    button.setAttribute('aria-label', option.label);
    button.setAttribute('aria-pressed', selected === option.id ? 'true' : 'false');

    const icon = document.createElement('span');
    icon.className = 'setup-icon-modal-option-icon';
    icon.innerHTML = activityIconSvgMarkup(option.id);

    const label = document.createElement('span');
    label.className = 'setup-icon-modal-option-label';
    label.textContent = option.label;

    button.append(icon, label);
    button.addEventListener('click', () => setupIconModalChoose(option.id));
    grid.appendChild(button);
  });

  panel.append(header, grid);
  modal.appendChild(panel);

  modal.addEventListener('click', (event) => {
    if (event.target === modal) setupIconModalClose();
  });

  document.body.appendChild(modal);
  closeButton.focus();
}

/* Capture the icon trigger before the old in-Orb popup handler can run. */
document.addEventListener('click', (event) => {
  const trigger = event.target?.closest?.('[data-setup-icon-toggle]');
  if (!trigger) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  setupIconModalBuild(trigger);
}, true);

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !document.querySelector('.setup-icon-modal')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  setupIconModalClose();
}, true);

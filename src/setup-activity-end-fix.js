import { findTimeConflict } from './state/lifeProfile.js';

function refreshSequentialSetupButtons() {
  const shell = document.querySelector('.setup-step-activities, .setup-step-activity-end');
  if (!shell) return;

  const state = window.__LIFE_OS__?.getState?.();
  const draft = state?.setupActivityDraft;
  const profile = state?.lifeProfile;
  const day = state?.setupActivityDay;
  if (!draft || !profile || day === undefined || day === null) return;

  const nameInput = shell.querySelector('[data-setup-draft-field="name"]');
  const endInput = shell.querySelector('[data-setup-draft-field="end"]');
  const name = String(nameInput?.value ?? draft.name ?? '').trim();
  const start = draft.start || '';
  const end = endInput?.value || draft.end || '';

  const nameContinue = shell.querySelector('[data-setup-action="activity-name-continue"]');
  if (nameContinue) {
    nameContinue.disabled = !(name && start);
  }

  const saveButton = shell.querySelector('[data-setup-action="activity-add"]');
  if (!saveButton || !endInput) return;

  const conflict = start && end && start !== end
    ? findTimeConflict(profile, day, start, end)
    : null;

  const conflictNode = shell.querySelector('[data-setup-conflict]');
  if (conflictNode) {
    const message = conflict ? `That time crosses ${conflict.label}.` : '';
    conflictNode.hidden = !conflict;
    if (conflictNode.textContent !== message) conflictNode.textContent = message;
  }

  endInput.setAttribute('aria-invalid', conflict ? 'true' : 'false');
  saveButton.disabled = !(name && start && end && start !== end && !conflict);
}

let refreshFrame = null;
function queueSequentialRefresh() {
  if (refreshFrame !== null) cancelAnimationFrame(refreshFrame);
  refreshFrame = requestAnimationFrame(() => {
    refreshFrame = null;
    refreshSequentialSetupButtons();
  });
}

function isSequentialSetupField(target) {
  return target?.matches?.(
    '.setup-step-activities [data-setup-draft-field="name"], .setup-step-activity-end [data-setup-draft-field="end"]'
  );
}

document.addEventListener('input', (event) => {
  if (isSequentialSetupField(event.target)) queueSequentialRefresh();
});

document.addEventListener('change', (event) => {
  if (isSequentialSetupField(event.target)) queueSequentialRefresh();
});

window.addEventListener('pageshow', queueSequentialRefresh);
queueSequentialRefresh();

import { findTimeConflict } from './state/lifeProfile.js';

function refreshSetupActivityEndButton() {
  const shell = document.querySelector('.setup-step-activity-end');
  if (!shell) return;

  const state = window.__LIFE_OS__?.getState?.();
  const draft = state?.setupActivityDraft;
  const profile = state?.lifeProfile;
  const day = state?.setupActivityDay;
  const endInput = shell.querySelector('[data-setup-draft-field="end"]');
  const saveButton = shell.querySelector('[data-setup-action="activity-add"]');
  if (!draft || !profile || day === undefined || !endInput || !saveButton) return;

  const name = String(draft.name || '').trim();
  const start = draft.start || '';
  const end = endInput.value || draft.end || '';
  const conflict = start && end && start !== end
    ? findTimeConflict(profile, day, start, end)
    : null;

  const conflictNode = shell.querySelector('[data-setup-conflict]');
  if (conflictNode) {
    conflictNode.hidden = !conflict;
    conflictNode.textContent = conflict ? `That time crosses ${conflict.label}.` : '';
  }

  endInput.setAttribute('aria-invalid', conflict ? 'true' : 'false');
  saveButton.disabled = !(name && start && end && start !== end && !conflict);
}

function queueSetupActivityEndRefresh() {
  queueMicrotask(refreshSetupActivityEndButton);
}

document.addEventListener('input', (event) => {
  if (event.target?.matches?.('.setup-step-activity-end [data-setup-draft-field="end"]')) {
    queueSetupActivityEndRefresh();
  }
});

document.addEventListener('change', (event) => {
  if (event.target?.matches?.('.setup-step-activity-end [data-setup-draft-field="end"]')) {
    queueSetupActivityEndRefresh();
  }
});

const setupActivityEndAppRoot = document.querySelector('#app');
if (setupActivityEndAppRoot) {
  const setupActivityEndObserver = new MutationObserver(queueSetupActivityEndRefresh);
  setupActivityEndObserver.observe(setupActivityEndAppRoot, { childList: true, subtree: true });
}

queueSetupActivityEndRefresh();

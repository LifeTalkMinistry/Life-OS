import { DEFAULT_RESTS, formatDuration, restInsights } from '../restState.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function panelHeader(title, eyebrow = 'PAUSE') {
  return `
    <div class="system-panel-header">
      <div>
        <p class="system-panel-eyebrow">${escapeHtml(eyebrow)}</p>
        <h2>${escapeHtml(title)}</h2>
      </div>
      <button type="button" class="system-panel-close" data-pause-panel-action="close" aria-label="Close">×</button>
    </div>
  `;
}

function takeRestContent(state) {
  const customOptions = state.customRests.map((label) => `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`).join('');
  return `
    ${panelHeader('Take a Rest')}
    <p class="system-panel-intro">You decide what rest means. Choose it, set the boundary, then let yourself stop.</p>
    <div class="pause-form">
      <label class="pause-field">
        <span>What kind of rest?</span>
        <select data-pause-rest-select>
          ${DEFAULT_RESTS.map((label) => `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`).join('')}
          ${customOptions}
          <option value="__custom__">+ Create my own…</option>
        </select>
      </label>
      <label class="pause-field pause-custom-field" hidden>
        <span>Name your rest</span>
        <input type="text" maxlength="48" placeholder="e.g. Sit outside" data-pause-custom-name>
      </label>
      <div class="pause-field">
        <span>How long?</span>
        <div class="pause-duration-grid" role="group" aria-label="Rest duration">
          ${[5, 10, 15, 30, 60].map((minutes) => `<button type="button" data-pause-minutes="${minutes}" class="${minutes === 15 ? 'is-selected' : ''}">${minutes < 60 ? `${minutes} min` : '1 hour'}</button>`).join('')}
        </div>
      </div>
      <label class="pause-field">
        <span>Or set minutes</span>
        <input type="number" min="1" max="720" value="15" inputmode="numeric" data-pause-duration>
      </label>
      <p class="system-form-error" data-pause-error aria-live="polite"></p>
      <button type="button" class="system-primary-action pause-start-button" data-pause-panel-action="start">START REST</button>
    </div>
  `;
}

function historyContent(state) {
  const rows = state.history.slice(0, 40).map((entry) => {
    const date = new Date(Number(entry.endedAt || entry.startAt));
    const stamp = date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return `
      <div class="pause-history-row">
        <div><strong>${escapeHtml(entry.label)}</strong><small>${escapeHtml(stamp)}</small></div>
        <span>${escapeHtml(formatDuration(entry.durationMs))}</span>
      </div>
    `;
  }).join('');
  return `
    ${panelHeader('Rest History')}
    <p class="system-panel-intro">Every intentional pause you've taken on this device.</p>
    <div class="pause-history-list">${rows || '<p class="pause-empty">No rests yet. Your first one starts the story.</p>'}</div>
  `;
}

function insightsContent(state) {
  const insights = restInsights(state);
  return `
    ${panelHeader('Rest Insights')}
    <p class="system-panel-intro">A simple 7-day view of how you're making room to stop.</p>
    <div class="pause-insight-grid">
      <article><small>REST TIME</small><strong>${escapeHtml(formatDuration(insights.totalMs))}</strong></article>
      <article><small>SESSIONS</small><strong>${insights.sessions}</strong></article>
      <article><small>AVERAGE</small><strong>${escapeHtml(formatDuration(insights.averageMs))}</strong></article>
      <article><small>MOST USED</small><strong class="pause-insight-label">${escapeHtml(insights.top)}</strong></article>
    </div>
    <p class="pause-insight-note">PAUSE shows your reality. It doesn't score or judge how you choose to rest.</p>
  `;
}

function myRestsContent(state) {
  const defaults = DEFAULT_RESTS.map((label) => `<span class="pause-rest-chip">${escapeHtml(label)}</span>`).join('');
  const custom = state.customRests.map((label) => `
    <div class="pause-custom-row">
      <span>${escapeHtml(label)}</span>
      <button type="button" data-pause-remove-rest="${escapeHtml(label)}" aria-label="Remove ${escapeHtml(label)}">×</button>
    </div>
  `).join('');
  return `
    ${panelHeader('My Rests')}
    <p class="system-panel-intro">Defaults stay available. Add your own language for whatever genuinely feels like rest to you.</p>
    <div class="pause-section-label">DEFAULT</div>
    <div class="pause-rest-chips">${defaults}</div>
    <div class="pause-section-label pause-custom-label">MY CUSTOM RESTS</div>
    <div class="pause-custom-list">${custom || '<p class="pause-empty">You haven’t created a custom rest yet.</p>'}</div>
    <div class="pause-add-rest">
      <input type="text" maxlength="48" placeholder="Create a custom rest" data-pause-new-rest>
      <button type="button" class="system-primary-action" data-pause-panel-action="add-rest">ADD</button>
    </div>
    <p class="system-form-error" data-pause-error aria-live="polite"></p>
  `;
}

export function PausePanel({ view, state, onClose, onStart, onAddRest, onRemoveRest }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'system-backdrop pause-backdrop';

  const panel = document.createElement('section');
  panel.className = `system-panel pause-panel pause-view-${view}`;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  if (view === 'history') panel.innerHTML = historyContent(state);
  else if (view === 'insights') panel.innerHTML = insightsContent(state);
  else if (view === 'my-rests') panel.innerHTML = myRestsContent(state);
  else panel.innerHTML = takeRestContent(state);

  panel.querySelector('[data-pause-panel-action="close"]')?.addEventListener('click', () => onClose?.());

  if (view === 'take-rest') {
    const select = panel.querySelector('[data-pause-rest-select]');
    const customField = panel.querySelector('.pause-custom-field');
    const durationInput = panel.querySelector('[data-pause-duration]');
    const error = panel.querySelector('[data-pause-error]');
    select?.addEventListener('change', () => {
      if (customField) customField.hidden = select.value !== '__custom__';
    });
    panel.querySelectorAll('[data-pause-minutes]').forEach((button) => {
      button.addEventListener('click', () => {
        panel.querySelectorAll('[data-pause-minutes]').forEach((item) => item.classList.remove('is-selected'));
        button.classList.add('is-selected');
        if (durationInput) durationInput.value = button.dataset.pauseMinutes;
      });
    });
    panel.querySelector('[data-pause-panel-action="start"]')?.addEventListener('click', () => {
      let label = select?.value || '';
      const isCustom = label === '__custom__';
      if (isCustom) label = panel.querySelector('[data-pause-custom-name]')?.value?.trim() || '';
      const minutes = Math.round(Number(durationInput?.value || 0));
      if (!label) {
        if (error) error.textContent = 'Name the rest you want to take.';
        return;
      }
      if (!minutes || minutes < 1 || minutes > 720) {
        if (error) error.textContent = 'Choose a rest from 1 to 720 minutes.';
        return;
      }
      onStart?.({ label, minutes, saveCustom: isCustom });
    });
  }

  if (view === 'my-rests') {
    const input = panel.querySelector('[data-pause-new-rest]');
    const error = panel.querySelector('[data-pause-error]');
    panel.querySelector('[data-pause-panel-action="add-rest"]')?.addEventListener('click', () => {
      const label = input?.value?.trim() || '';
      if (!label) {
        if (error) error.textContent = 'Give your rest a name first.';
        return;
      }
      onAddRest?.(label);
    });
    panel.querySelectorAll('[data-pause-remove-rest]').forEach((button) => {
      button.addEventListener('click', () => onRemoveRest?.(button.dataset.pauseRemoveRest));
    });
  }

  backdrop.addEventListener('pointerdown', (event) => {
    if (event.target === backdrop) onClose?.();
  });
  backdrop.appendChild(panel);
  return backdrop;
}

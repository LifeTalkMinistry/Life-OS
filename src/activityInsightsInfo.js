/* Activity Insights info behavior.
 * Matches the Rest Insights information affordance without coupling Activity
 * calculations or wording to the Rest implementation.
 */
(() => {
  const STYLE_ID = 'pause-activity-insights-info-behavior-style';
  const LAYER_SELECTOR = '[data-pause-info-popover-layer]';

  function ensureStyles() {
    if (document.querySelector('#pause-rest-insights-info-style') || document.querySelector(`#${STYLE_ID}`)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .activity-insights-info{cursor:pointer}
      .activity-insights-info:hover,.activity-insights-info:focus-visible{border-color:rgba(184,142,248,.42);background:rgba(111,69,184,.17);color:#e6dcf0;outline:none}
      .pause-info-popover-layer{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:24px;background:rgba(3,2,8,.58);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
      .pause-info-popover{box-sizing:border-box;width:min(320px,100%);padding:18px 18px 16px;border:1px solid rgba(177,133,242,.23);border-radius:16px;background:linear-gradient(180deg,rgba(20,13,38,.99),rgba(9,6,18,.99));box-shadow:0 22px 60px rgba(0,0,0,.52),0 0 24px rgba(125,77,198,.08)}
      .pause-info-popover-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:11px}
      .pause-info-popover-head strong{color:#ebe4f2;font-size:.82rem;font-weight:570;letter-spacing:.02em}
      .pause-info-popover-close{appearance:none;width:28px;height:28px;padding:0;border:0;background:transparent;color:#81778b;font-size:1.05rem;cursor:pointer}
      .pause-info-popover-close:hover,.pause-info-popover-close:focus-visible{color:#eee7f5;outline:none}
      .pause-info-popover-copy{margin:0;color:#9c92a6;font-size:.72rem;line-height:1.6;white-space:pre-line}
    `;
    document.head.appendChild(style);
  }

  function closePopover() {
    document.querySelector(LAYER_SELECTOR)?.remove();
  }

  function dialogTitle(button) {
    const label = String(button?.getAttribute('aria-label') || '').trim();
    if (/activity status/i.test(label)) return 'Activity Status';
    if (/streak/i.test(label)) return 'Activity Streak';
    if (/weekday|pattern/i.test(label)) return 'Activity Pattern';
    return 'Activity Information';
  }

  function showPopover(button) {
    const copy = String(button?.getAttribute('title') || '').trim();
    if (!copy) return;
    closePopover();

    const title = dialogTitle(button);
    const layer = document.createElement('div');
    layer.className = 'pause-info-popover-layer';
    layer.dataset.pauseInfoPopoverLayer = '';

    const card = document.createElement('div');
    card.className = 'pause-info-popover';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-label', title);

    const head = document.createElement('div');
    head.className = 'pause-info-popover-head';

    const heading = document.createElement('strong');
    heading.textContent = title;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'pause-info-popover-close';
    close.setAttribute('aria-label', 'Close information');
    close.textContent = '×';

    const text = document.createElement('p');
    text.className = 'pause-info-popover-copy';
    text.textContent = copy;

    head.append(heading, close);
    card.append(head, text);
    layer.appendChild(card);
    document.body.appendChild(layer);

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      document.removeEventListener('keydown', onKeyDown);
      closePopover();
    };

    close.addEventListener('click', () => {
      document.removeEventListener('keydown', onKeyDown);
      closePopover();
    });

    layer.addEventListener('click', (event) => {
      if (event.target !== layer) return;
      document.removeEventListener('keydown', onKeyDown);
      closePopover();
    });

    document.addEventListener('keydown', onKeyDown);
    close.focus();
  }

  function onClick(event) {
    const button = event.target?.closest?.('.activity-insights-info');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    showPopover(button);
  }

  function init() {
    ensureStyles();
    document.addEventListener('click', onClick);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

/* Activity target display units.
 * Activity targets remain canonically stored in minutes by the existing Activity
 * model. This layer only lets people enter the same duration in Hours or Minutes.
 * Before the existing form handlers run, minute values are translated back to
 * hours so no scoring/storage/backend contract changes are required.
 */
(() => {
  const STYLE_ID = 'pause-activity-target-unit-style';
  const FORM_SELECTOR = '.activity-form[data-form], [data-activity-manage-form]';
  let scanQueued = false;

  function ensureUnitStyles() {
    if (document.querySelector(`#${STYLE_ID}`)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .activity-target-value-row{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;align-items:stretch}
      .activity-target-value-row>input{box-sizing:border-box;width:100%;min-width:0;padding-left:10px!important;padding-right:10px!important}
      .activity-target-unit-select{box-sizing:border-box;width:100%;min-width:0;min-height:36px;padding:0 9px;border:1px solid rgba(169,124,228,.18);border-radius:10px;background:rgba(7,5,14,.68);color:#b9afc3;color-scheme:dark;font:inherit;font-size:.6rem;outline:0;cursor:pointer}
      .activity-target-unit-select:focus{border-color:rgba(190,145,255,.42);background:rgba(12,8,24,.78)}
      .activity-score-target>small,.activity-manage-target>small{min-height:.8em}
    `;
    document.head.appendChild(style);
  }

  function cadence(mode) {
    if (mode === 'daily') return 'per day';
    if (mode === 'weekly') return 'per week';
    if (mode === 'total') return 'for this commitment';
    return '';
  }

  function roundDisplay(value, places = 4) {
    const factor = 10 ** places;
    return Math.round(Number(value) * factor) / factor;
  }

  function configureInput(input, unit, form) {
    if (!input) return;
    const isAdd = form.matches('.activity-form[data-form]');
    if (unit === 'minutes') {
      input.min = isAdd ? '15' : '1';
      input.max = '60000';
      input.step = '1';
    } else {
      input.min = isAdd ? '0.25' : '0.01';
      input.max = '1000';
      input.step = '0.01';
    }
  }

  function convertVisibleValue(input, fromUnit, toUnit) {
    if (!input || fromUnit === toUnit) return;
    const value = Number(input.value);
    if (Number.isFinite(value) && value > 0) {
      input.value = String(roundDisplay(fromUnit === 'hours' ? value * 60 : value / 60));
    }
    const placeholder = Number(input.placeholder);
    if (Number.isFinite(placeholder) && placeholder > 0) {
      input.placeholder = String(roundDisplay(fromUnit === 'hours' ? placeholder * 60 : placeholder / 60));
    }
  }

  function smallNode(form, field) {
    if (form.matches('[data-activity-manage-form]')) {
      return form.querySelector(field === 'target' ? '[data-activity-target-unit]' : '[data-activity-passing-unit]');
    }
    return form.querySelector(field === 'target' ? '[data-full-target-unit]' : '[data-passing-target-unit]');
  }

  function refreshUnitCopy(form) {
    const mode = form.querySelector('input[name="targetMode"]:checked')?.value || 'track';
    const copy = cadence(mode);
    ['target', 'passing'].forEach((field) => {
      const node = smallNode(form, field);
      if (node) node.textContent = copy;
    });
  }

  function initialUnit(input) {
    const value = Number(input?.value);
    return Number.isFinite(value) && value > 0 && value < 1 ? 'minutes' : 'hours';
  }

  function decorateField(form, field, inputName) {
    const input = form.querySelector(`input[name="${inputName}"]`);
    if (!input || input.closest('.activity-target-value-row')) return;

    const unit = initialUnit(input);
    if (unit === 'minutes') convertVisibleValue(input, 'hours', 'minutes');
    configureInput(input, unit, form);

    const select = document.createElement('select');
    select.className = 'activity-target-unit-select';
    select.dataset.activityTargetUnitSelect = field;
    select.dataset.previousUnit = unit;
    select.setAttribute('aria-label', `${field === 'target' ? '100% target' : 'Passing target'} unit`);
    select.innerHTML = `<option value="hours"${unit === 'hours' ? ' selected' : ''}>Hours</option><option value="minutes"${unit === 'minutes' ? ' selected' : ''}>Minutes</option>`;

    const row = document.createElement('div');
    row.className = 'activity-target-value-row';
    input.insertAdjacentElement('beforebegin', row);
    row.append(input, select);
  }

  function enhanceForm(form) {
    if (!form || form.dataset.activityTargetUnitsEnhanced === '1') return;
    form.dataset.activityTargetUnitsEnhanced = '1';
    decorateField(form, 'target', 'targetHours');
    decorateField(form, 'passing', 'passingHours');
    refreshUnitCopy(form);
  }

  function scan() {
    scanQueued = false;
    ensureUnitStyles();
    document.querySelectorAll(`${FORM_SELECTOR}:not([data-activity-target-units-enhanced="1"])`).forEach(enhanceForm);
  }

  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    queueMicrotask(scan);
  }

  function onChange(event) {
    const form = event.target?.closest?.(FORM_SELECTOR);
    if (!form) return;

    const select = event.target.closest?.('[data-activity-target-unit-select]');
    if (select) {
      const previous = select.dataset.previousUnit || 'hours';
      const next = select.value === 'minutes' ? 'minutes' : 'hours';
      const input = select.closest('.activity-target-value-row')?.querySelector('input[type="number"]');
      convertVisibleValue(input, previous, next);
      configureInput(input, next, form);
      select.dataset.previousUnit = next;
    }

    refreshUnitCopy(form);
  }

  function prepareSubmit(event) {
    const form = event.target?.closest?.(FORM_SELECTOR);
    if (!form) return;

    const restore = [];
    form.querySelectorAll('[data-activity-target-unit-select]').forEach((select) => {
      if (select.value !== 'minutes') return;
      const input = select.closest('.activity-target-value-row')?.querySelector('input[type="number"]');
      if (!input || !input.value) return;
      const minutes = Number(input.value);
      if (!Number.isFinite(minutes)) return;
      const visibleValue = input.value;
      input.value = String(roundDisplay(minutes / 60, 6));
      restore.push([input, visibleValue]);
    });

    if (!restore.length) return;
    queueMicrotask(() => {
      if (!form.isConnected) return;
      restore.forEach(([input, value]) => { input.value = value; });
    });
  }

  function init() {
    ensureUnitStyles();
    document.addEventListener('change', onChange);
    document.addEventListener('submit', prepareSubmit, true);
    new MutationObserver((records) => {
      if (records.some((record) => record.addedNodes?.length)) queueScan();
    }).observe(document.documentElement, { childList: true, subtree: true });
    queueScan();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

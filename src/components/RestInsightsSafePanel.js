export function RestInsightsSafePanel({ onClose }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'system-backdrop pause-backdrop';

  const panel = document.createElement('section');
  panel.className = 'system-panel pause-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Rest Insights');

  const header = document.createElement('div');
  header.className = 'system-panel-header';

  const title = document.createElement('h2');
  title.textContent = 'Rest Insights';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'system-panel-close';
  close.setAttribute('aria-label', 'Close Rest Insights');
  close.textContent = '×';
  close.addEventListener('click', () => onClose?.());

  header.append(title, close);

  const intro = document.createElement('p');
  intro.className = 'system-panel-intro';
  intro.textContent = 'Rest Insights safe shell is open.';

  const note = document.createElement('div');
  note.className = 'pause-audit-empty';
  note.textContent = 'No Rest Insights calculations or history rendering are running in this diagnostic build.';

  panel.append(header, intro, note);
  backdrop.appendChild(panel);

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) onClose?.();
  });

  return backdrop;
}

export function WhyPanel(activity, onClose) {
  const backdrop = document.createElement('div');
  backdrop.className = 'why-backdrop';
  backdrop.dataset.testid = 'why-backdrop';

  const panel = document.createElement('section');
  panel.className = 'why-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'why-title');
  panel.innerHTML = `
    <button class="why-close" type="button" aria-label="Close why this now">×</button>
    <p class="eyebrow" id="why-title">WHY THIS NOW?</p>
    <h2>${activity.shortTitle}</h2>
    <div class="why-item">
      <span>CURRENT OBJECTIVE</span>
      <p>${activity.objective}</p>
    </div>
    <div class="why-item">
      <span>WHY IT MATTERS</span>
      <p>${activity.why}</p>
    </div>
    <div class="why-item">
      <span>RECOMMENDED FOCUS</span>
      <strong>${activity.recommendedMinutes} MINUTES</strong>
    </div>
  `;

  backdrop.appendChild(panel);
  const close = () => onClose?.();
  panel.querySelector('.why-close').addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });

  return backdrop;
}

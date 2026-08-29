export function Brand() {
  const wrapper = document.createElement('header');
  wrapper.className = 'brand pause-brand';
  wrapper.innerHTML = `
    <div class="brand-title pause-brand-title" role="img" aria-label="PAUSE">
      <span class="pause-brand-letter" aria-hidden="true">P</span>
      <span class="pause-brand-letter" aria-hidden="true">A</span>
      <span class="pause-brand-use" aria-hidden="true">
        <span class="pause-brand-you">U</span>
        <span class="pause-brand-letter">S</span>
        <span class="pause-brand-letter">E</span>
      </span>
    </div>
    <p>Know When to Stop.</p>
  `;
  return wrapper;
}

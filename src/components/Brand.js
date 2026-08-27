export function Brand() {
  const wrapper = document.createElement('header');
  wrapper.className = 'brand pause-brand';
  wrapper.innerHTML = `
    <div class="brand-title pause-brand-title" aria-label="PAUSE">
      <span>P A U S E</span>
    </div>
    <p>Know When to Stop.</p>
  `;
  return wrapper;
}

export function Brand() {
  const wrapper = document.createElement('header');
  wrapper.className = 'brand';
  wrapper.innerHTML = `
    <div class="brand-title" aria-label="LIFE OS">
      <span>L I F E</span><span class="brand-os">O S</span>
    </div>
    <p>Control your life.</p>
  `;
  return wrapper;
}

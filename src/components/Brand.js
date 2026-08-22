export function Brand() {
  const wrapper = document.createElement('header');
  wrapper.className = 'brand';
  wrapper.innerHTML = `
    <div class="brand-title" aria-label="LIFE OS">
      <span>L I F E</span><span class="brand-os">O S</span>
    </div>
    <p>Control your life.</p>
    <div style="position:fixed;bottom:10px;left:50%;transform:translateX(-50%);z-index:99999;padding:6px 10px;border:1px solid rgba(255,255,255,.35);border-radius:999px;background:rgba(0,0,0,.75);color:white;font:600 11px/1.2 system-ui,sans-serif;letter-spacing:.08em;pointer-events:none;">BUILD TEST · AUG 23</div>
  `;
  return wrapper;
}

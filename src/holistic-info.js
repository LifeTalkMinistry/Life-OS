/* LIFE OS — move Holistic Life explanation into a compact info control. */
(() => {
  const EXPLANATION = 'Your tracked life, divided across the areas that are consuming it.';

  document.addEventListener('click', (event) => {
    const info = event.target.closest?.('[data-holistic-info]');
    if (!info) return;
    event.preventDefault();
    event.stopPropagation();
    const existing = document.querySelector('.holistic-info-popover');
    if (existing) {
      existing.remove();
      return;
    }
    const popover = document.createElement('div');
    popover.className = 'holistic-info-popover';
    popover.textContent = EXPLANATION;
    document.body.appendChild(popover);
  }, true);

  const priorAppend = Element.prototype.appendChild;
  Element.prototype.appendChild = function(node) {
    const result = priorAppend.call(this, node);
    if (this.id === 'app' || this.closest?.('#app')) {
      queueMicrotask(() => {
        const page = document.querySelector('.holistic-page');
        if (!page) return;
        page.querySelector('.holistic-copy')?.remove();
        const header = page.querySelector('.holistic-header');
        if (!header || header.querySelector('[data-holistic-info]')) return;
        const spacer = header.querySelector(':scope > i');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'holistic-info-button';
        button.setAttribute('data-holistic-info', '');
        button.setAttribute('aria-label', 'About Holistic Life');
        button.textContent = 'i';
        if (spacer) spacer.replaceWith(button);
        else header.appendChild(button);
      });
    }
    return result;
  };

  const style = document.createElement('style');
  style.textContent = `
    .holistic-copy{display:none!important}
    .holistic-info-button{
      width:40px;height:40px;border:1px solid rgba(210,190,255,.16);border-radius:50%;
      background:rgba(255,255,255,.025);color:rgba(240,235,248,.88);
      font:600 .95rem/1 Inter,ui-sans-serif,sans-serif;cursor:pointer;
    }
    .holistic-info-popover{
      position:fixed;top:max(76px,calc(env(safe-area-inset-top) + 58px));right:18px;z-index:9999;
      width:min(78vw,300px);padding:14px 16px;border:1px solid rgba(210,190,255,.16);border-radius:16px;
      background:rgba(10,8,18,.96);backdrop-filter:blur(16px);color:rgba(236,230,245,.78);
      font:500 .78rem/1.55 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      box-shadow:0 16px 50px rgba(0,0,0,.38);
    }
  `;
  document.head.appendChild(style);
})();

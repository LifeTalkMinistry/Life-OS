/* LIFE OS — Holistic Life scoring explanation. */
(() => {
  const EXPLANATION = `HOLISTIC HEALTH\n\nYour score looks at how your tracked time is distributed across the 9 areas of life over the last 7 days.\n\nEvery activity becomes part of the same 100% of tracked life. LIFE OS then measures concentration: when one area consumes most of your tracked time while other areas receive little or none, your Holistic Health score falls. As your life becomes more distributed across the major areas, the score rises.\n\nThe calculation uses the squared share of each category to detect imbalance, compares it with the most balanced possible distribution across all 9 categories, then converts that imbalance into a 0–100 Holistic Health score.\n\nSTATUS\n0–49  Critical Imbalance\n50–59  Concerning\n60–69  Needs Attention\n70–79  Improving\n80–89  Stable\n90–99  Healthy\n100  Thriving\n\nThe percentages beside each category show its share of your tracked life. Together, those category percentages always make up 100%.`;

  document.addEventListener('click', (event) => {
    const info = event.target.closest?.('[data-holistic-info]');
    if (!info) return;
    event.preventDefault();
    event.stopPropagation();
    const existing = document.querySelector('.holistic-info-popover');
    if (existing) { existing.remove(); return; }
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
    .holistic-info-button{width:40px;height:40px;border:1px solid rgba(210,190,255,.16);border-radius:50%;background:rgba(255,255,255,.025);color:rgba(240,235,248,.88);font:600 .95rem/1 Inter,ui-sans-serif,sans-serif;cursor:pointer}
    .holistic-info-popover{position:fixed;top:max(76px,calc(env(safe-area-inset-top) + 58px));right:18px;z-index:9999;width:min(82vw,340px);max-height:72svh;overflow:auto;white-space:pre-line;padding:16px 18px;border:1px solid rgba(210,190,255,.16);border-radius:16px;background:rgba(10,8,18,.97);backdrop-filter:blur(16px);color:rgba(236,230,245,.8);font:500 .76rem/1.58 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 16px 50px rgba(0,0,0,.38)}
  `;
  document.head.appendChild(style);
})();
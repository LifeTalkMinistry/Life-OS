const ORB_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" class="orb-artwork" viewBox="0 0 1254 1254" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="body" cx="50%" cy="48%" r="55%"><stop offset="0" stop-color="#01010c"/><stop offset=".58" stop-color="#02010f"/><stop offset=".83" stop-color="#050119"/><stop offset="1" stop-color="#0c0328"/></radialGradient>
    <radialGradient id="top" cx="50%" cy="-4%" r="82%"><stop offset="0" stop-color="#5e2af0" stop-opacity=".34"/><stop offset=".40" stop-color="#35159d" stop-opacity=".48"/><stop offset=".80" stop-color="#1b0958" stop-opacity=".20"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="left" cx="-4%" cy="62%" r="74%"><stop offset="0" stop-color="#243cff" stop-opacity=".58"/><stop offset=".38" stop-color="#1328c7" stop-opacity=".46"/><stop offset=".76" stop-color="#09135f" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="ll" cx="8%" cy="94%" r="64%"><stop offset="0" stop-color="#54a3ff" stop-opacity=".48"/><stop offset=".38" stop-color="#334be0" stop-opacity=".40"/><stop offset=".76" stop-color="#151367" stop-opacity=".16"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="right" cx="104%" cy="52%" r="72%"><stop offset="0" stop-color="#ff6d72" stop-opacity=".48"/><stop offset=".30" stop-color="#e34075" stop-opacity=".46"/><stop offset=".64" stop-color="#9d255e" stop-opacity=".26"/><stop offset=".90" stop-color="#461034" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="lr" cx="84%" cy="96%" r="66%"><stop offset="0" stop-color="#f56cff" stop-opacity=".48"/><stop offset=".38" stop-color="#9b32c6" stop-opacity=".38"/><stop offset=".76" stop-color="#421250" stop-opacity=".14"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="dark" cx="50%" cy="50%" r="51%"><stop offset="0" stop-color="#01010b" stop-opacity=".94"/><stop offset=".48" stop-color="#01010b" stop-opacity=".84"/><stop offset=".75" stop-color="#01010b" stop-opacity=".50"/><stop offset=".94" stop-color="#01010b" stop-opacity=".08"/><stop offset="1" stop-color="#01010b" stop-opacity="0"/></radialGradient>
    <linearGradient id="refl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#214dff"/><stop offset=".30" stop-color="#4a55ff"/><stop offset=".52" stop-color="#9d5cff"/><stop offset=".72" stop-color="#c74ddd"/><stop offset="1" stop-color="#d765c8"/></linearGradient>
    <filter id="ew" x="-35%" y="-35%" width="170%" height="170%"><feGaussianBlur stdDeviation="24"/></filter>
    <filter id="em" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="iw" x="-35%" y="-35%" width="170%" height="170%"><feGaussianBlur stdDeviation="23"/></filter>
    <filter id="im" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="7"/></filter>
    <filter id="loc" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="7"/></filter>
    <filter id="r1" x="-60%" y="-250%" width="220%" height="600%"><feGaussianBlur stdDeviation="34"/></filter>
    <filter id="r2" x="-60%" y="-250%" width="220%" height="600%"><feGaussianBlur stdDeviation="15"/></filter>
    <filter id="r3" x="-60%" y="-250%" width="220%" height="600%"><feGaussianBlur stdDeviation="4"/></filter>
    <clipPath id="clip"><ellipse cx="628" cy="585" rx="409.5" ry="416.5"/></clipPath>
    <linearGradient id="g0" gradientUnits="userSpaceOnUse" x1="1037.5" y1="585.0" x2="917.6" y2="879.5"><stop offset="0" stop-color="#ff9b7f"/><stop offset="1" stop-color="#ff5ead"/></linearGradient>
    <linearGradient id="g1" gradientUnits="userSpaceOnUse" x1="917.6" y1="879.5" x2="628.0" y2="1001.5"><stop offset="0" stop-color="#ff5ead"/><stop offset="1" stop-color="#b440f3"/></linearGradient>
    <linearGradient id="g2" gradientUnits="userSpaceOnUse" x1="628.0" y1="1001.5" x2="338.4" y2="879.5"><stop offset="0" stop-color="#b440f3"/><stop offset="1" stop-color="#416eff"/></linearGradient>
    <linearGradient id="g3" gradientUnits="userSpaceOnUse" x1="338.4" y1="879.5" x2="218.5" y2="585.0"><stop offset="0" stop-color="#416eff"/><stop offset="1" stop-color="#313cff"/></linearGradient>
    <linearGradient id="g4" gradientUnits="userSpaceOnUse" x1="218.5" y1="585.0" x2="338.4" y2="290.5"><stop offset="0" stop-color="#313cff"/><stop offset="1" stop-color="#6a2cff"/></linearGradient>
    <linearGradient id="g5" gradientUnits="userSpaceOnUse" x1="338.4" y1="290.5" x2="628.0" y2="168.5"><stop offset="0" stop-color="#6a2cff"/><stop offset="1" stop-color="#982aff"/></linearGradient>
    <linearGradient id="g6" gradientUnits="userSpaceOnUse" x1="628.0" y1="168.5" x2="917.6" y2="290.5"><stop offset="0" stop-color="#982aff"/><stop offset="1" stop-color="#ed4fa8"/></linearGradient>
    <linearGradient id="g7" gradientUnits="userSpaceOnUse" x1="917.6" y1="290.5" x2="1037.5" y2="585.0"><stop offset="0" stop-color="#ed4fa8"/><stop offset="1" stop-color="#ff8a7f"/></linearGradient>
  </defs>

  <g class="orb-artwork__outer-glow" data-orb-part="outer-glow">
    <path d="M1037.5,585.0 A409.5,416.5 0 0 1 917.6,879.5" fill="none" stroke="url(#g0)" stroke-width="66" stroke-linecap="round" opacity="0.26" filter="url(#ew)"/><path d="M917.6,879.5 A409.5,416.5 0 0 1 628.0,1001.5" fill="none" stroke="url(#g1)" stroke-width="66" stroke-linecap="round" opacity="0.26" filter="url(#ew)"/><path d="M628.0,1001.5 A409.5,416.5 0 0 1 338.4,879.5" fill="none" stroke="url(#g2)" stroke-width="66" stroke-linecap="round" opacity="0.26" filter="url(#ew)"/><path d="M338.4,879.5 A409.5,416.5 0 0 1 218.5,585.0" fill="none" stroke="url(#g3)" stroke-width="66" stroke-linecap="round" opacity="0.26" filter="url(#ew)"/><path d="M218.5,585.0 A409.5,416.5 0 0 1 338.4,290.5" fill="none" stroke="url(#g4)" stroke-width="66" stroke-linecap="round" opacity="0.26" filter="url(#ew)"/><path d="M338.4,290.5 A409.5,416.5 0 0 1 628.0,168.5" fill="none" stroke="url(#g5)" stroke-width="66" stroke-linecap="round" opacity="0.26" filter="url(#ew)"/><path d="M628.0,168.5 A409.5,416.5 0 0 1 917.6,290.5" fill="none" stroke="url(#g6)" stroke-width="66" stroke-linecap="round" opacity="0.26" filter="url(#ew)"/><path d="M917.6,290.5 A409.5,416.5 0 0 1 1037.5,585.0" fill="none" stroke="url(#g7)" stroke-width="66" stroke-linecap="round" opacity="0.26" filter="url(#ew)"/>
    <path d="M1037.5,585.0 A409.5,416.5 0 0 1 917.6,879.5" fill="none" stroke="url(#g0)" stroke-width="27" stroke-linecap="round" opacity="0.58" filter="url(#em)"/><path d="M917.6,879.5 A409.5,416.5 0 0 1 628.0,1001.5" fill="none" stroke="url(#g1)" stroke-width="27" stroke-linecap="round" opacity="0.58" filter="url(#em)"/><path d="M628.0,1001.5 A409.5,416.5 0 0 1 338.4,879.5" fill="none" stroke="url(#g2)" stroke-width="27" stroke-linecap="round" opacity="0.58" filter="url(#em)"/><path d="M338.4,879.5 A409.5,416.5 0 0 1 218.5,585.0" fill="none" stroke="url(#g3)" stroke-width="27" stroke-linecap="round" opacity="0.58" filter="url(#em)"/><path d="M218.5,585.0 A409.5,416.5 0 0 1 338.4,290.5" fill="none" stroke="url(#g4)" stroke-width="27" stroke-linecap="round" opacity="0.58" filter="url(#em)"/><path d="M338.4,290.5 A409.5,416.5 0 0 1 628.0,168.5" fill="none" stroke="url(#g5)" stroke-width="27" stroke-linecap="round" opacity="0.58" filter="url(#em)"/><path d="M628.0,168.5 A409.5,416.5 0 0 1 917.6,290.5" fill="none" stroke="url(#g6)" stroke-width="27" stroke-linecap="round" opacity="0.58" filter="url(#em)"/><path d="M917.6,290.5 A409.5,416.5 0 0 1 1037.5,585.0" fill="none" stroke="url(#g7)" stroke-width="27" stroke-linecap="round" opacity="0.58" filter="url(#em)"/>
  </g>

  <g class="orb-artwork__reflection" data-orb-part="reflection">
    <ellipse cx="640" cy="1078" rx="370" ry="82" fill="url(#refl)" opacity=".32" filter="url(#r1)"/><ellipse cx="640" cy="1072" rx="310" ry="70" fill="url(#refl)" opacity=".50" filter="url(#r1)"/><ellipse cx="640" cy="1067" rx="225" ry="40" fill="url(#refl)" opacity=".70" filter="url(#r2)"/><ellipse cx="640" cy="1062" rx="145" ry="16" fill="url(#refl)" opacity=".92" filter="url(#r3)"/><ellipse cx="640" cy="1059" rx="110" ry="8" fill="#fff2ff" opacity=".98" filter="url(#r3)"/><ellipse cx="525" cy="1070" rx="210" ry="42" fill="#394fff" opacity=".30" filter="url(#r1)"/>
  </g>

  <g class="orb-artwork__sphere" data-orb-part="sphere">
    <ellipse cx="628" cy="585" rx="409.5" ry="416.5" fill="url(#body)"/>
    <g class="orb-artwork__interior" data-orb-part="interior" clip-path="url(#clip)"><rect x="170" y="150" width="920" height="870" fill="url(#top)"/><rect x="170" y="150" width="920" height="870" fill="url(#left)"/><rect x="170" y="150" width="920" height="870" fill="url(#ll)"/><rect x="170" y="150" width="920" height="870" fill="url(#right)"/><rect x="170" y="150" width="920" height="870" fill="url(#lr)"/><rect x="170" y="150" width="920" height="870" fill="url(#dark)"/></g>
    <g class="orb-artwork__inner-glow" data-orb-part="inner-glow" clip-path="url(#clip)">
      <path d="M1037.5,585.0 A409.5,416.5 0 0 1 917.6,879.5" fill="none" stroke="url(#g0)" stroke-width="78" stroke-linecap="round" opacity="0.62" filter="url(#iw)"/><path d="M917.6,879.5 A409.5,416.5 0 0 1 628.0,1001.5" fill="none" stroke="url(#g1)" stroke-width="78" stroke-linecap="round" opacity="0.62" filter="url(#iw)"/><path d="M628.0,1001.5 A409.5,416.5 0 0 1 338.4,879.5" fill="none" stroke="url(#g2)" stroke-width="78" stroke-linecap="round" opacity="0.62" filter="url(#iw)"/><path d="M338.4,879.5 A409.5,416.5 0 0 1 218.5,585.0" fill="none" stroke="url(#g3)" stroke-width="78" stroke-linecap="round" opacity="0.62" filter="url(#iw)"/><path d="M218.5,585.0 A409.5,416.5 0 0 1 338.4,290.5" fill="none" stroke="url(#g4)" stroke-width="78" stroke-linecap="round" opacity="0.62" filter="url(#iw)"/><path d="M338.4,290.5 A409.5,416.5 0 0 1 628.0,168.5" fill="none" stroke="url(#g5)" stroke-width="78" stroke-linecap="round" opacity="0.62" filter="url(#iw)"/><path d="M628.0,168.5 A409.5,416.5 0 0 1 917.6,290.5" fill="none" stroke="url(#g6)" stroke-width="78" stroke-linecap="round" opacity="0.62" filter="url(#iw)"/><path d="M917.6,290.5 A409.5,416.5 0 0 1 1037.5,585.0" fill="none" stroke="url(#g7)" stroke-width="78" stroke-linecap="round" opacity="0.62" filter="url(#iw)"/>
      <path d="M1037.5,585.0 A409.5,416.5 0 0 1 917.6,879.5" fill="none" stroke="url(#g0)" stroke-width="32" stroke-linecap="round" opacity="0.66" filter="url(#im)"/><path d="M917.6,879.5 A409.5,416.5 0 0 1 628.0,1001.5" fill="none" stroke="url(#g1)" stroke-width="32" stroke-linecap="round" opacity="0.66" filter="url(#im)"/><path d="M628.0,1001.5 A409.5,416.5 0 0 1 338.4,879.5" fill="none" stroke="url(#g2)" stroke-width="32" stroke-linecap="round" opacity="0.66" filter="url(#im)"/><path d="M338.4,879.5 A409.5,416.5 0 0 1 218.5,585.0" fill="none" stroke="url(#g3)" stroke-width="32" stroke-linecap="round" opacity="0.66" filter="url(#im)"/><path d="M218.5,585.0 A409.5,416.5 0 0 1 338.4,290.5" fill="none" stroke="url(#g4)" stroke-width="32" stroke-linecap="round" opacity="0.66" filter="url(#im)"/><path d="M338.4,290.5 A409.5,416.5 0 0 1 628.0,168.5" fill="none" stroke="url(#g5)" stroke-width="32" stroke-linecap="round" opacity="0.66" filter="url(#im)"/><path d="M628.0,168.5 A409.5,416.5 0 0 1 917.6,290.5" fill="none" stroke="url(#g6)" stroke-width="32" stroke-linecap="round" opacity="0.66" filter="url(#im)"/><path d="M917.6,290.5 A409.5,416.5 0 0 1 1037.5,585.0" fill="none" stroke="url(#g7)" stroke-width="32" stroke-linecap="round" opacity="0.66" filter="url(#im)"/>
    </g>
  </g>

  <g class="orb-artwork__rim" data-orb-part="rim">
    <path d="M1037.5,585.0 A409.5,416.5 0 0 1 917.6,879.5" fill="none" stroke="url(#g0)" stroke-width="8.5" stroke-linecap="round" opacity=".96"/><path d="M917.6,879.5 A409.5,416.5 0 0 1 628.0,1001.5" fill="none" stroke="url(#g1)" stroke-width="8.5" stroke-linecap="round" opacity=".96"/><path d="M628.0,1001.5 A409.5,416.5 0 0 1 338.4,879.5" fill="none" stroke="url(#g2)" stroke-width="8.5" stroke-linecap="round" opacity=".96"/><path d="M338.4,879.5 A409.5,416.5 0 0 1 218.5,585.0" fill="none" stroke="url(#g3)" stroke-width="8.5" stroke-linecap="round" opacity=".96"/><path d="M218.5,585.0 A409.5,416.5 0 0 1 338.4,290.5" fill="none" stroke="url(#g4)" stroke-width="8.5" stroke-linecap="round" opacity=".96"/><path d="M338.4,290.5 A409.5,416.5 0 0 1 628.0,168.5" fill="none" stroke="url(#g5)" stroke-width="8.5" stroke-linecap="round" opacity=".96"/><path d="M628.0,168.5 A409.5,416.5 0 0 1 917.6,290.5" fill="none" stroke="url(#g6)" stroke-width="8.5" stroke-linecap="round" opacity=".96"/><path d="M917.6,290.5 A409.5,416.5 0 0 1 1037.5,585.0" fill="none" stroke="url(#g7)" stroke-width="8.5" stroke-linecap="round" opacity=".96"/>
    <g class="orb-artwork__rim-energy" data-orb-part="rim-energy"><path d="M917.6,290.5 A409.5,416.5 0 0 1 1037.5,585.0" fill="none" stroke="#ff9d82" stroke-width="12" stroke-linecap="round" opacity=".32" filter="url(#loc)"/><path d="M1037.5,585.0 A409.5,416.5 0 0 1 917.6,879.5" fill="none" stroke="#ff9d82" stroke-width="12" stroke-linecap="round" opacity=".32" filter="url(#loc)"/><path d="M628.0,1001.5 A409.5,416.5 0 0 1 338.4,879.5" fill="none" stroke="#62b8ff" stroke-width="16" stroke-linecap="round" opacity=".52" filter="url(#loc)"/><path d="M338.4,879.5 A409.5,416.5 0 0 1 218.5,585.0" fill="none" stroke="#62b8ff" stroke-width="16" stroke-linecap="round" opacity=".52" filter="url(#loc)"/></g>
    <ellipse class="orb-artwork__hot-core" data-orb-part="hot-core" cx="628" cy="585" rx="409.5" ry="416.5" fill="none" stroke="#fffdfd" stroke-width="4.6" opacity=".99"/>
  </g>
</svg>`;

let orbArtworkInstance = 0;

function scopePaintServers(svg) {
  const prefix = `life-os-orb-${++orbArtworkInstance}-`;
  const idMap = new Map();

  svg.querySelectorAll('[id]').forEach((node) => {
    const original = node.id;
    const scoped = `${prefix}${original}`;
    idMap.set(original, scoped);
    node.id = scoped;
  });

  const attributes = ['fill', 'stroke', 'filter', 'clip-path', 'mask'];
  svg.querySelectorAll('*').forEach((node) => {
    attributes.forEach((name) => {
      const value = node.getAttribute(name);
      if (!value) return;
      const next = value.replace(/url\(#([^)]+)\)/g, (match, id) => idMap.has(id) ? `url(#${idMap.get(id)})` : match);
      if (next !== value) node.setAttribute(name, next);
    });
  });
}

export function OrbArtwork() {
  const template = document.createElement('template');
  template.innerHTML = ORB_SVG.trim();
  const svg = template.content.firstElementChild;
  scopePaintServers(svg);
  return svg;
}
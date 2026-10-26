/* The pen cursor changes colour with the surface under it: light pen over dark surfaces, dark pen over light ones.
   It reads the first opaque background behind the pointer and tells the CSS through html[data-surf]. Visual only. */
(function () {
  if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var root = document.documentElement, last = '', raf = 0, px = 0, py = 0;
  function parse(c) { var m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; var p = m[1].split(/[ ,\/]+/).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; }
  function lum(c) { function f(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); } return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); }
  function surface(x, y) {
    var e = document.elementFromPoint(x, y);
    if (e && /^(IMG|VIDEO|PICTURE)$/.test(e.tagName)) return 'light'; /* screenshots and photos are mostly light */
    while (e && e.nodeType === 1) {
      var cs = getComputedStyle(e), c = parse(cs.backgroundColor);
      if (c && c.a > 0.6) return lum(c) < 0.3 ? 'dark' : 'light';
      e = e.parentElement;
    }
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }
  function update() { raf = 0; var s = surface(px, py); if (s !== last) { last = s; root.setAttribute('data-surf', s); } }
  window.addEventListener('pointermove', function (e) { if (e.pointerType !== 'mouse') return; px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
  window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
})();

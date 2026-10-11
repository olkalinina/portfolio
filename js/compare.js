/* Light/dark comparison slider. Drag (or use the arrow keys) to move the split. A single gentle sweep plays when it
   first comes into view, unless the visitor prefers reduced motion. Contains no project content. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setup(el) {
    var input = el.querySelector('.cs-compare-range'), touched = false, raf = 0;
    function set(v) { el.style.setProperty('--pos', v + '%'); }
    input.addEventListener('input', function () { touched = true; cancelAnimationFrame(raf); set(input.value); });
    if (reduce || !('IntersectionObserver' in window)) return;
    var played = false;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting || en.intersectionRatio < 0.6 || played || touched) return;
        played = true;
        var t0 = null, dur = 2600;
        function step(t) {
          if (touched) return;
          if (t0 === null) t0 = t;
          var k = Math.min(1, (t - t0) / dur);
          var v = 50 + Math.sin(k * Math.PI * 2) * 26 * (1 - k * 0.3);   // 50 -> 76 -> 24 -> back to ~50
          input.value = v; set(v);
          if (k < 1) raf = requestAnimationFrame(step); else { input.value = 50; set(50); }
        }
        raf = requestAnimationFrame(step);
      });
    }, { threshold: [0.6] }).observe(el);
  }
  function init() { Array.prototype.forEach.call(document.querySelectorAll('.cs-compare'), setup); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* Scrollable phone preview. Plays a slow auto-scroll when it comes into view, stops as soon as the visitor
   interacts, and does not autoplay for visitors who prefer reduced motion. Contains no project content. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setup(screen) {
    var stopped = false, running = false, raf = 0, timer = 0;
    function stop() { stopped = true; running = false; cancelAnimationFrame(raf); clearTimeout(timer); screen.classList.add('is-touched'); }
    ['wheel', 'touchstart', 'pointerdown', 'keydown', 'focus'].forEach(function (ev) { screen.addEventListener(ev, stop, { passive: true }); });

    function tween(from, to, ms, done) {
      var t0 = null;
      function step(t) {
        if (stopped) return;
        if (t0 === null) t0 = t;
        var k = Math.min(1, (t - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // ease in-out
        screen.scrollTop = from + (to - from) * e;
        if (k < 1) raf = requestAnimationFrame(step); else done();
      }
      raf = requestAnimationFrame(step);
    }
    function loop() {
      if (stopped || !running) return;
      var max = screen.scrollHeight - screen.clientHeight;
      if (max <= 0) return;
      tween(0, max, Math.max(9000, max * 14), function () {
        timer = setTimeout(function () { tween(max, 0, 2200, function () { timer = setTimeout(loop, 1800); }); }, 1600);
      });
    }
    function start() { if (stopped || running || reduce) return; running = true; timer = setTimeout(loop, 700); }
    function pause() { running = false; cancelAnimationFrame(raf); clearTimeout(timer); }

    if (!('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting && en.intersectionRatio >= 0.55) start(); else if (!stopped) pause(); });
    }, { threshold: [0, 0.55, 1] }).observe(screen);
  }

  function init() { Array.prototype.forEach.call(document.querySelectorAll('.cs-phone-screen'), setup); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

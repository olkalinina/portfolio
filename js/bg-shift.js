/* Page background that follows the section in view: a fixed layer behind the page crossfades to the colour set on
   data-bg ("light", "white", "slate" or "deep") of the section crossing the middle of the screen. Light mode only (CSS decides). */
(function () {
  var map = { light: '#DFE3F2', white: '#FFFFFF', slate: '#9099BA', deep: '#7182AB' };
  var secs = [].slice.call(document.querySelectorAll('[data-bg]'));
  if (!secs.length) return;
  var root = document.documentElement, last = '', ticking = false;
  function pick() {
    ticking = false;
    var mid = window.innerHeight * 0.45, cur = null;
    secs.forEach(function (s) { var r = s.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) cur = s; });
    var key = cur ? cur.getAttribute('data-bg') : (window.scrollY < 40 ? secs[0].getAttribute('data-bg') : last);
    if (!key || key === last || !map[key]) return;
    last = key; root.style.setProperty('--page-bg', map[key]);
  }
  function req() { if (!ticking) { ticking = true; requestAnimationFrame(pick); } }
  window.addEventListener('scroll', req, { passive: true });
  window.addEventListener('resize', req);
  pick();
})();

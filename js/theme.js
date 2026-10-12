/* Light / dark switch. Adds a round button to the top bar and remembers the choice in this browser. Public pages only. */
(function () {
  var root = document.documentElement;
  if (document.body.classList.contains('is-protected')) { root.removeAttribute('data-theme'); return; }
  var nav = document.querySelector('.nav'); if (!nav) return;
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>';
  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'theme-toggle';
  function dark() { return root.getAttribute('data-theme') === 'dark'; }
  function paint() { var d = dark(); btn.innerHTML = d ? SUN : MOON; btn.setAttribute('aria-label', d ? 'Switch to light mode' : 'Switch to dark mode'); btn.setAttribute('aria-pressed', d ? 'true' : 'false'); }
  function apply(next) {
    if (next === 'dark') root.setAttribute('data-theme', 'dark'); else root.removeAttribute('data-theme');
    try { localStorage.setItem('theme', next); } catch (e) {}
    paint();
  }
  btn.addEventListener('click', function () {
    var next = dark() ? 'light' : 'dark';
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || reduce) { apply(next); return; }
    // Circle spread: the new theme grows out of the button like a ripple
    var r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    var end = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    var t = document.startViewTransition(function () { apply(next); });
    t.ready.then(function () {
      root.animate(
        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + end + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 700, easing: 'cubic-bezier(.4, 0, .2, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(function () {});
  });
  var ham = nav.querySelector('.nav-hamburger');
  nav.insertBefore(btn, ham || null);
  paint();
})();

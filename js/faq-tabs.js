/* FAQ topic switcher: two tabs (Product Design / Behavioral CRO Diagnosis), one visible list at a time.
   Arrow keys, Home/End move between tabs. A URL hash (#faq-cro, #faq-product) or data-default picks the starting topic. */
(function () {
  var root = document.querySelector('[data-faq]');
  if (!root) return;
  var tabs = [].slice.call(root.querySelectorAll('[role="tab"]'));
  var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });

  function select(i, focus) {
    tabs.forEach(function (t, k) {
      var on = k === i;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
      if (on) { var all = document.getElementById('faqAll'); if (all) all.href = '/faq#' + (t.getAttribute('data-topic') === 'product' ? 'product-design' : t.getAttribute('data-topic')); }
      var p = panels[k];
      if (on) { p.hidden = false; p.classList.remove('is-in'); void p.offsetWidth; p.classList.add('is-in'); }
      else p.hidden = true;
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { select(i, false); });
    t.addEventListener('keydown', function (e) {
      var k = e.key, n = tabs.length, to = -1;
      if (k === 'ArrowRight' || k === 'ArrowDown') to = (i + 1) % n;
      else if (k === 'ArrowLeft' || k === 'ArrowUp') to = (i - 1 + n) % n;
      else if (k === 'Home') to = 0;
      else if (k === 'End') to = n - 1;
      if (to >= 0) { e.preventDefault(); select(to, true); }
    });
  });

  var start = 0, want = (location.hash || '').replace('#', '') || root.getAttribute('data-default') || '';
  tabs.forEach(function (t, i) { if (t.id === want || t.getAttribute('data-topic') === want) start = i; });
  select(start, false);
  panels.forEach(function (p) { p.classList.remove('is-in'); });
})();

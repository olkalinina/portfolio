/* Scroll reveal, one section at a time: as a section scrolls into view its content fades and rises into place
   (heading first, then the rest in a short stagger). If several sections are in view, the next one waits a moment.
   Scrolling a section out of view resets it, so it plays again when you come back. Skipped with "reduce motion". Visual only. */
(function () {
  if (!('IntersectionObserver' in window) || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  var root = document.querySelector('main .container');
  if (!root) return;
  if (root.children.length === 1 && (root.firstElementChild.classList.contains('pd') || root.firstElementChild.classList.contains('ab'))) root = root.firstElementChild;

  var LISTS = 'ul,ol,.ab-mentor,.ab-cards,.ab-cols,.ab-quotes,.pd-cmp,.help-cards,.pd-svc,.pd-work,.post-list,.faq-list,.pd-faq,.pd-incl,.work-on-list';
  var WRAPS = '.ab-hero-text,.hero-text,.work-on,.work-on-body,.work-on-intro,.cs-section-header,.contact-block,.pd-split,.pd-why-grid,.faq';
  var GAP = 520;   // ms between one section starting and the next one starting

  function items(el, out) {
    [].forEach.call(el.children, function (c) {
      if (c.tagName === 'SCRIPT' || c.tagName === 'STYLE') return;
      if (c.matches(LISTS)) [].forEach.call(c.children, function (x) { out.push(x); });
      else if (c.matches(WRAPS)) items(c, out);
      else out.push(c);
    });
    return out;
  }

  var secs = [], queue = [], timer = null;

  function show(s) {
    s.shown = true;
    s.items.forEach(function (el, i) { el.style.setProperty('--rd', Math.min(i * 90, 720) + 'ms'); el.classList.add('in'); });
  }
  function reset(s) {
    s.shown = false;
    s.items.forEach(function (el) { el.classList.add('rv'); el.classList.remove('in'); el.style.removeProperty('--rd'); });
  }
  function pump() {
    if (timer || !queue.length) return;
    var s = queue.shift();
    if (!s.shown) show(s);
    timer = setTimeout(function () { timer = null; pump(); }, s.shown ? GAP : 0);
  }

  var seeIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var s = e.target._s;
      if (!e.isIntersecting || s.shown || queue.indexOf(s) > -1) return;
      queue.push(s);
      queue.sort(function (a, b) { return secs.indexOf(a) - secs.indexOf(b); });
    });
    pump();
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  var leaveIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var s = e.target._s;
      if (e.isIntersecting) return;
      var q = queue.indexOf(s); if (q > -1) queue.splice(q, 1);
      if (s.shown) reset(s);
    });
  }, { threshold: 0 });

  [].forEach.call(root.children, function (sec) {
    if (sec.tagName === 'SCRIPT' || sec.tagName === 'STYLE') return;
    var list = items(sec, []);
    if (!list.length) list = [sec];
    var s = { el: sec, items: list, shown: false };
    sec._s = s; secs.push(s);
    list.forEach(function (el) {
      el.classList.add('rv');
      el.addEventListener('animationend', function (ev) {
        if (ev.target !== el || ev.animationName !== 'rv-in' || !el.classList.contains('in')) return;
        el.classList.remove('rv', 'in'); el.style.removeProperty('--rd');
      });
    });
    seeIO.observe(sec); leaveIO.observe(sec);
  });
})();

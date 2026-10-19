/* Scroll reveal: the content of each section fades and rises into place as it comes into view,
   heading first, then the rest in a short stagger. Skipped with "reduce motion". Visual only. */
(function () {
  if (!('IntersectionObserver' in window) || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  var root = document.querySelector('main .container');
  if (!root) return;
  if (root.children.length === 1 && root.firstElementChild.classList.contains('pd')) root = root.firstElementChild;

  var LISTS = 'ul,ol,.help-cards,.pd-svc,.pd-work,.post-list,.faq-list,.pd-faq,.pd-incl,.work-on-list';
  var WRAPS = '.hero-text,.work-on,.work-on-body,.work-on-intro,.cs-section-header,.contact-block,.pd-split,.pd-why-grid,.faq';
  function items(el, out) {
    [].forEach.call(el.children, function (c) {
      if (c.tagName === 'SCRIPT' || c.tagName === 'STYLE') return;
      if (c.matches(LISTS)) [].forEach.call(c.children, function (x) { out.push(x); });
      else if (c.matches(WRAPS)) items(c, out);
      else out.push(c);
    });
    return out;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      var list = e.target._rv || [];
      list.forEach(function (el, i) {
        el.style.setProperty('--rd', Math.min(i * 90, 720) + 'ms');
        el.classList.add('in');
      });
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  [].forEach.call(root.children, function (sec) {
    if (sec.tagName === 'SCRIPT' || sec.tagName === 'STYLE') return;
    var list = items(sec, []);
    if (!list.length) list = [sec];
    list.forEach(function (el) {
      el.classList.add('rv');
      el.addEventListener('animationend', function done(ev) {
        if (ev.target !== el || ev.animationName !== 'rv-in') return;
        el.classList.remove('rv', 'in'); el.style.removeProperty('--rd'); el.removeEventListener('animationend', done);
      });
    });
    sec._rv = list; io.observe(sec);
  });
})();

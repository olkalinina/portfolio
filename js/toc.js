/* Highlights the current section in the "On this page" list of a protected case study. Contains no project content. */
(function () {
  function init() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.cs-toc a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (a) { var el = document.getElementById(a.getAttribute('href').slice(1)); if (el) map[el.id] = a; });
    function mark(id) { links.forEach(function (a) { a.classList.toggle('is-active', a === map[id]); }); }
    var visible = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
      var first = Object.keys(map).filter(function (id) { return visible[id]; })[0];
      if (first) mark(first);
    }, { rootMargin: '-20% 0px -65% 0px' });
    Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
    mark(links[0].getAttribute('href').slice(1));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

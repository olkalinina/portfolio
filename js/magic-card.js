/* Spotlight that follows the cursor on cards marked data-magic. Visual only; contains no project content. */
(function () {
  if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  Array.prototype.forEach.call(document.querySelectorAll('[data-magic]'), function (card) {
    var raf = 0;
    function move(e) {
      var r = card.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () { card.style.setProperty('--mx', x + 'px'); card.style.setProperty('--my', y + 'px'); });
    }
    card.addEventListener('mouseenter', function (e) { move(e); card.style.setProperty('--glow', '1'); });
    card.addEventListener('mousemove', move);
    card.addEventListener('mouseleave', function () { card.style.setProperty('--glow', '0'); });
  });
})();

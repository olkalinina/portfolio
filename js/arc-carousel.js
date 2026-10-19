/* Case-study arc carousel: cards sit on a big circle, the active one is in front.
   Arrows, keyboard arrows, swipe/drag and clicking a side card all rotate it. Visual only. */
(function () {
  var root = document.querySelector('[data-arc]');
  if (!root) return;
  var stage = root.querySelector('.arc-stage');
  var cards = [].slice.call(root.querySelectorAll('.arc-card'));
  var infos = [].slice.call(root.querySelectorAll('.arc-info'));
  var count = root.querySelector('.arc-count');
  var n = cards.length, active = 0, half = Math.floor(n / 2);

  function render() {
    cards.forEach(function (c, i) {
      var d = ((i - active + n + half) % n) - half, far = Math.abs(d) > 2, on = d === 0;
      c.style.setProperty('--d', d);
      c.style.setProperty('--sc', on ? 1 : 0.9);
      c.style.setProperty('--br', on ? 1 : 0.55);
      c.style.setProperty('--op', far ? 0 : 1);
      c.style.setProperty('--z', 10 - Math.abs(d));
      c.style.pointerEvents = far ? 'none' : '';
      c.tabIndex = on ? 0 : -1;
      if (on) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
    });
    infos.forEach(function (el, i) { var on = i === active; el.classList.toggle('is-active', on); el.setAttribute('aria-hidden', on ? 'false' : 'true'); });
    if (count) count.textContent = String(active + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0');
  }
  function go(i) { active = (i + n) % n; render(); }

  root.querySelector('[data-arc-prev]').addEventListener('click', function () { go(active - 1); });
  root.querySelector('[data-arc-next]').addEventListener('click', function () { go(active + 1); });
  root.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { go(active - 1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { go(active + 1); e.preventDefault(); }
  });

  // Clicking a side card brings it to the front; only the front card opens its page
  var dragged = false;
  stage.addEventListener('click', function (e) {
    var card = e.target.closest ? e.target.closest('.arc-card') : null;
    if (!card) return;
    var i = cards.indexOf(card);
    if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; return; }
    if (i !== active) { e.preventDefault(); e.stopPropagation(); go(i); }
  }, true);

  // Swipe / drag
  var x0 = null;
  stage.addEventListener('pointerdown', function (e) { x0 = e.clientX; dragged = false; });
  stage.addEventListener('pointermove', function (e) { if (x0 !== null && Math.abs(e.clientX - x0) > 12) dragged = true; });
  function end(e) {
    if (x0 === null) return;
    var dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) { go(active + (dx < 0 ? 1 : -1)); dragged = true; setTimeout(function () { dragged = false; }, 60); }
    else dragged = false;
  }
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', function () { x0 = null; dragged = false; });
  render();
})();

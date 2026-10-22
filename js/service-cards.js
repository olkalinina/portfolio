/* Desktop: the row of cards keeps one fixed height, so the page never shifts and the pointer never falls off a card edge while the cards grow and shrink on hover. */
(function () {
  var box = document.querySelector('.help-cards');
  var cards = box ? [].slice.call(box.querySelectorAll('.help-card')) : [];
  if (!cards.length) return;
  var mq = window.matchMedia('(max-width: 960px), (hover: none)');
  var timer = 0;
  function lock() {
    box.style.minHeight = '';
    if (mq.matches) return;
    var max = 0;
    cards.forEach(function (c) { c.style.transition = 'none'; });
    [null].concat(cards).forEach(function (on) {
      cards.forEach(function (c) { c.style.flexGrow = c === on ? '1.7' : '1'; });
      max = Math.max(max, box.getBoundingClientRect().height);
    });
    cards.forEach(function (c) { c.style.flexGrow = ''; c.style.transition = ''; });
    box.style.minHeight = Math.ceil(max) + 'px';
  }
  function later() { clearTimeout(timer); timer = setTimeout(lock, 120); }
  /* the hover look lingers for a moment after the pointer leaves, so crossing the gap between cards never makes it flicker */
  cards.forEach(function (c) {
    c.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse') return;
      cards.forEach(function (o) { if (o !== c) { clearTimeout(o._hot); o.classList.remove('is-hot'); } });
      clearTimeout(c._hot); c.classList.add('is-hot');
    });
    c.addEventListener('pointerleave', function (e) {
      if (e.pointerType !== 'mouse') return;
      c._hot = setTimeout(function () { c.classList.remove('is-hot'); }, 180);
    });
  });
  lock();
  window.addEventListener('resize', later);
  window.addEventListener('load', later);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(lock);
  if (mq.addEventListener) mq.addEventListener('change', lock);
})();

/* Phones and touch screens: the two service cards are compact; tapping a card opens its details on the page.
   The button inside a card still goes to the service page. On desktop the cards expand on hover instead (CSS only). */
(function () {
  var mq = window.matchMedia('(max-width: 960px), (hover: none)');
  var cards = [].slice.call(document.querySelectorAll('.help-card'));
  if (!cards.length) return;
  function set(card, open) {
    card.classList.toggle('is-open', open);
    var t = card.querySelector('.help-toggle');
    if (t) t.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  cards.forEach(function (card) {
    card.addEventListener('click', function (e) {
      if (!mq.matches) return;
      if (e.target.closest && e.target.closest('a')) return;
      var open = !card.classList.contains('is-open');
      cards.forEach(function (c) { set(c, c === card ? open : false); });
    });
  });
  var reset = function () { if (!mq.matches) cards.forEach(function (c) { set(c, false); }); };
  if (mq.addEventListener) mq.addEventListener('change', reset); else if (mq.addListener) mq.addListener(reset);
})();

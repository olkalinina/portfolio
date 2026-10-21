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

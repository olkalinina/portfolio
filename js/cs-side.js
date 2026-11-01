/* Case studies: an "On this page" list and a short contact line, in a column on the right.
   Headings opt in with data-toc="Short label"; the sentence comes from data-cs-cta on <body>. */
(function () {
  var box = document.querySelector('main .container');
  if (!box || document.querySelector('.cs-side')) return;
  var root = box.firstElementChild;
  if (!root) return;
  var cta = document.body.getAttribute('data-cs-cta') || '';
  var heads = [].slice.call(root.querySelectorAll('[data-toc]'));
  if (!heads.length && !cta) return;

  var used = {};
  var items = heads.map(function (h, i) {
    var label = h.getAttribute('data-toc');
    var id = h.id || 'cs-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    while (used[id]) id += '-' + i;
    used[id] = 1; h.id = id; h.style.scrollMarginTop = '120px';
    return '<li><a href="#' + id + '">' + label + '</a></li>';
  }).join('');

  var side = document.createElement('aside');
  side.className = 'cs-toc cs-side';
  side.setAttribute('aria-label', 'On this page');
  side.innerHTML = (items ? '<p class="cs-side-title">On this page</p><ul>' + items + '</ul>' : '') +
    (cta ? '<div class="cs-side-cta"><p>' + cta + ' <a href="/#contact">Contact me</a></p></div>' : '');

  var lay = document.createElement('div');
  lay.className = 'cs-layout';
  box.insertBefore(lay, root);
  lay.appendChild(root);
  lay.appendChild(side);
})();

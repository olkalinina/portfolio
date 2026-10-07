/* Access-code modal for locked (NDA) case studies.
   Contract with the server (built in the next step):
     GET  /api/access?slug=<slug>            200 {access: true|false} = does this browser already hold a valid session for it
     POST /api/redeem {code, slug}           200 {redirect} | 401 generic failure | 429 too many attempts
   No project content or codes are stored in this file. */
(function () {
  var LOCK = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>';
  var CHECK = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';
  var MSG = {
    invalid: "That code didn’t work. Check it and try again, or ask me for a new one.",
    rate: "Too many attempts. Please wait a few minutes and try again.",
    network: "Couldn’t reach the server. Check your connection and try again."
  };

  var overlay, input, msg, submit, notice, iconEl, titleEl, introEl, formEl, current, lastFocus;

  function build() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="accessTitle" aria-describedby="accessIntro">' +
        '<button type="button" class="modal-close" aria-label="Close">&#x2715;</button>' +
        '<div class="modal-icon" id="accessIcon"></div>' +
        '<h2 id="accessTitle"></h2>' +
        '<p id="accessIntro"></p>' +
        '<div class="modal-notice" id="accessNotice" hidden></div>' +
        '<form id="accessForm" class="modal-field" novalidate>' +
          '<label for="accessCode">Access code</label>' +
          '<input id="accessCode" name="code" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="14" placeholder="XXXX-XXXX-XXXX" aria-describedby="accessMsg" />' +
          '<div id="accessMsg" class="modal-msg" role="alert" aria-live="assertive"></div>' +
          '<div class="modal-actions">' +
            '<button type="button" class="modal-cancel" data-close>Cancel</button>' +
            '<button type="submit" class="modal-submit" id="accessSubmit">View case study</button>' +
          '</div>' +
          '<p class="modal-hint">No code yet? <a href="/contacts.html">Ask me for access</a>. Each code works once.</p>' +
        '</form>' +
      '</div>';
    document.body.appendChild(overlay);
    iconEl = overlay.querySelector('#accessIcon');
    titleEl = overlay.querySelector('#accessTitle');
    introEl = overlay.querySelector('#accessIntro');
    notice = overlay.querySelector('#accessNotice');
    formEl = overlay.querySelector('#accessForm');
    input = overlay.querySelector('#accessCode');
    msg = overlay.querySelector('#accessMsg');
    submit = overlay.querySelector('#accessSubmit');

    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('[data-close]').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    input.addEventListener('input', format);
    formEl.addEventListener('submit', onSubmit);
  }

  // XXXX-XXXX-XXXX: uppercase, drop spaces/dashes/other characters, re-insert dashes. Works for typing and pasting.
  function format() {
    var raw = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    input.value = raw.replace(/(.{4})(?=.)/g, '$1-');
    if (input.getAttribute('aria-invalid')) { input.removeAttribute('aria-invalid'); msg.textContent = ''; msg.className = 'modal-msg'; }
  }

  function setError(text) {
    msg.textContent = text;
    msg.className = 'modal-msg is-error';
    input.setAttribute('aria-invalid', 'true');
    input.focus();
    input.select();
  }

  function setBusy(busy) {
    submit.disabled = busy;
    input.readOnly = busy;
    submit.textContent = busy ? 'Checking…' : 'View case study';
  }

  function open(slug, title, opts) {
    build();
    opts = opts || {};
    current = { slug: slug, title: title };
    lastFocus = document.activeElement;
    iconEl.className = 'modal-icon';
    iconEl.innerHTML = LOCK;
    titleEl.textContent = opts.expired ? 'Your access has expired' : 'Enter your access code';
    introEl.textContent = opts.expired
      ? 'For confidentiality, access ends after a set time. Enter a new code to keep reading' + (title ? ' “' + title + '”' : '') + '.'
      : 'This case study is under NDA' + (title ? ' (“' + title + '”)' : '') + '. Enter the code I sent you to read it.';
    notice.hidden = true;
    formEl.hidden = false;
    input.value = '';
    input.removeAttribute('aria-invalid');
    msg.textContent = '';
    msg.className = 'modal-msg';
    setBusy(false);
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    input.focus();
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onKey(e) {
    if (!overlay || !overlay.classList.contains('active')) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    var f = overlay.querySelectorAll('button:not([disabled]), input:not([readonly]), a[href]');
    f = Array.prototype.filter.call(f, function (n) { return n.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function onSubmit(e) {
    e.preventDefault();
    if (input.value.replace(/-/g, '').length !== 12) { setError(MSG.invalid); return; }
    setBusy(true);
    fetch('/api/redeem', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: input.value, slug: current.slug })
    }).then(function (r) {
      if (r.status === 429) { setBusy(false); setError(MSG.rate); return; }
      if (!r.ok) { setBusy(false); setError(MSG.invalid); return; }
      return r.json().then(function (d) { success(d && d.redirect); });
    }).catch(function () { setBusy(false); setError(MSG.network); });
  }

  function success(redirect) {
    iconEl.className = 'modal-icon is-success';
    iconEl.innerHTML = CHECK;
    titleEl.textContent = 'Access granted';
    introEl.textContent = 'Opening the case study…';
    formEl.hidden = true;
    notice.hidden = true;
    var to = (typeof redirect === 'string' && redirect.charAt(0) === '/' && redirect.charAt(1) !== '/') ? redirect : '/p/' + current.slug;
    setTimeout(function () { window.location.href = to; }, 700);
  }

  // Locked cards: if this browser already holds a valid session, go straight in; otherwise ask for a code.
  function onCardClick(e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.currentTarget;
    e.preventDefault();
    var slug = a.getAttribute('data-slug'), title = a.getAttribute('data-title') || '';
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 1500);
    fetch('/api/access?slug=' + encodeURIComponent(slug), { credentials: 'same-origin', cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(timer); return r.ok ? r.json() : { access: false }; })
      .then(function (d) { if (d && d.access === true) window.location.href = a.getAttribute('href'); else open(slug, title); })
      .catch(function () { clearTimeout(timer); open(slug, title); });
  }

  function init() {
    var cards = document.querySelectorAll('a[data-locked]');
    for (var i = 0; i < cards.length; i++) cards[i].addEventListener('click', onCardClick);
    var gate = document.getElementById('lockedGate');
    if (gate) {
      var slug = gate.getAttribute('data-slug'), title = gate.getAttribute('data-title') || '';
      var expired = /[?&]s=expired\b/.test(location.search);
      var btn = document.getElementById('lockedOpen');
      btn.addEventListener('click', function () { open(slug, title, { expired: expired }); });
      open(slug, title, { expired: expired });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.AccessModal = { open: open, close: close };
})();

/* Google Analytics 4, only after the visitor says yes.
   Nothing from Google is requested before consent. The choice is kept on the visitor's own device for 12 months and can be changed
   from the "Cookie settings" link in the footer. Not used on protected (NDA) case studies. */
(function () {
  var ID = 'G-SGBPXFEKQM', KEY = 'ga-consent', MONTH = 30 * 24 * 3600 * 1000;
  if (document.body && document.body.classList.contains('is-protected')) return;
  function read() { try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && v.t && Date.now() - v.t < 12 * MONTH) return v.v; } catch (e) {} return null; }
  function save(v) { try { localStorage.setItem(KEY, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {} }
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  var loaded = false;
  function load() {
    if (loaded) return; loaded = true;
    if (!/(^|\.)olgakalinina\.me$/.test(location.hostname)) { if (window.console) console.info('Analytics: not loaded on ' + location.hostname + ' (only on olgakalinina.me)'); return; }
    gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('js', new Date());
    gtag('config', ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
    var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID; document.head.appendChild(s);
  }
  function revoke() {
    gtag('consent', 'update', { analytics_storage: 'denied' });
    window['ga-disable-' + ID] = true;
    document.cookie.split(';').forEach(function (c) {
      var n = c.split('=')[0].trim();
      if (n === '_ga' || n.indexOf('_ga_') === 0) { document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'; document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' + location.hostname.replace(/^www\./, '.'); }
    });
  }
  var box = null;
  function close() { if (box) { box.remove(); box = null; } }
  function open() {
    if (box) return;
    box = document.createElement('div'); box.className = 'ck'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-labelledby', 'ckT');
    box.innerHTML = '<p class="ck-t" id="ckT">Cookies and analytics</p><p class="ck-p">May I use Google Analytics to see which pages are visited? It uses cookies and sends anonymous visit data to Google. Nothing is loaded unless you accept. <a href="/privacy">Privacy</a></p><div class="ck-b"><button type="button" class="ck-no">Decline</button><button type="button" class="ck-yes">Accept</button></div>';
    document.body.appendChild(box);
    box.querySelector('.ck-yes').addEventListener('click', function () { save('yes'); load(); close(); });
    box.querySelector('.ck-no').addEventListener('click', function () { save('no'); revoke(); close(); });
    box.querySelector('.ck-yes').focus({ preventScroll: true });
  }
  function init() {
    var c = read();
    if (c === 'yes') load(); else if (c === null) setTimeout(open, 1200);
    [].forEach.call(document.querySelectorAll('[data-consent-open]'), function (b) { b.addEventListener('click', open); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

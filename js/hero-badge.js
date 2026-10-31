/* Home hero: an ID-style badge on a lanyard. It drops in from under the top menu, swings and settles, then keeps a
   very small sway. Moving the pointer across it, or tapping it, sets it swinging again. Visual only; with
   "reduce motion" it simply hangs still. */
(function () {
  var wrap = document.querySelector('.hb-wrap');
  if (!wrap) return;
  var rig = wrap.querySelector('.hb-rig');
  var card = wrap.querySelector('.hb-card');
  if (!rig || !card) return;

  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) { wrap.classList.add('hb-ready'); return; }

  var a = 0, av = 0;      /* lanyard angle (deg) and its speed, hangs from a point hidden under the menu */
  var f = 0, fv = 0;      /* card angle (deg, absolute) and its speed, hangs from the clasp */
  var t0 = null, last = 0, dropped = false, running = false, visible = true;
  var DROP = 1150;        /* ms for the drop */

  function ease(x) {      /* fast start, small overshoot, settles */
    var c1 = 1.15, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  function setHeight() { return rig.offsetHeight; }

  function render(dropY) {
    rig.style.transform = 'translate3d(0,' + dropY.toFixed(1) + 'px,0) rotate(' + a.toFixed(3) + 'deg)';
    card.style.transform = 'rotate(' + (f - a).toFixed(3) + 'deg)';
  }

  function frame(now) {
    if (!running) return;
    if (t0 === null) { t0 = now; last = now; }
    var dt = Math.min((now - last) / 1000, 1 / 30); last = now;
    var el = now - t0;

    /* drop */
    var p = Math.min(el / DROP, 1);
    var dropY = -(1 - ease(p)) * (setHeight() + 40);
    if (p >= 1 && !dropped) { dropped = true; fv += 46; av += 5; }   /* the catch: it swings once it has landed */

    /* a gentle, never-quite-still sway */
    var idle = Math.sin(now / 1700) * 0.9 + Math.sin(now / 2900 + 1) * 0.6;

    /* lanyard: stiff, heavily damped pendulum */
    var aa = -55 * a - 7 * av + 18 * (f - a) * 0.15;
    av += aa * dt; a += av * dt;
    /* card: a looser pendulum hanging from the lanyard */
    var fa = -14 * f - 1.25 * fv + 6 * (a - f) + idle * 20;
    fv += fa * dt; f += fv * dt;
    if (f > 28) { f = 28; fv *= -0.3; } if (f < -28) { f = -28; fv *= -0.3; }

    render(dropY);
    requestAnimationFrame(frame);
  }

  function start() { if (running || !visible || document.hidden) return; running = true; t0 = null; if (dropped) { t0 = performance.now() - DROP; } requestAnimationFrame(frame); }
  function stop() { running = false; }

  /* pointer: moving across the badge pushes it, a tap flicks it */
  var lastX = null;
  wrap.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    var r = card.getBoundingClientRect();
    if (e.clientY < r.top - 20 || e.clientY > r.bottom + 20) { lastX = null; return; }
    if (lastX !== null) {
      var dx = e.clientX - lastX;
      fv += Math.max(-60, Math.min(60, dx * 1.4));
      av += Math.max(-8, Math.min(8, dx * 0.12));
    }
    lastX = e.clientX;
  });
  wrap.addEventListener('pointerleave', function () { lastX = null; });
  wrap.addEventListener('pointerdown', function (e) {
    var r = card.getBoundingClientRect();
    var side = (e.clientX < r.left + r.width / 2) ? 1 : -1;
    fv += side * 70; av += side * 7;
  });

  /* run only while on screen and the tab is open */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible) start(); else stop();
    }).observe(wrap);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });

  /* start hidden above the menu, then drop */
  render(-(setHeight() + 40));
  wrap.classList.add('hb-ready');
  var go = function () { start(); };
  if (document.readyState === 'complete') setTimeout(go, 250);
  else window.addEventListener('load', function () { setTimeout(go, 250); });
})();

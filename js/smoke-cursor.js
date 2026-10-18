/* Smoke that trails the mouse: a small WebGL fluid simulation (stable-fluids method).
   Visual only, no content. Skipped on touch screens, with "reduce motion", on protected pages, and without WebGL2. */
(function () {
  var mq = window.matchMedia;
  if (!mq || !mq('(hover: hover) and (pointer: fine)').matches || mq('(prefers-reduced-motion: reduce)').matches) return;

  var canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:50;';
  var gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return;
  gl.getExtension('OES_texture_float_linear');
  gl.getExtension('OES_texture_half_float_linear');
  document.body.appendChild(canvas);

  var SIM_RES = 128, DYE_RES = 384, PRESSURE_ITER = 18, CURL = 26, VEL_DISS = 0.25, DYE_DISS = 1.6, FORCE = 5200, RADIUS = 0.0022;

  /* ── shaders ── */
  var VERT = '#version 300 es\nprecision highp float;\nuniform vec2 texelSize;out vec2 vUv,vL,vR,vT,vB;' +
    'void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));vUv=p;vL=p-vec2(texelSize.x,0.);vR=p+vec2(texelSize.x,0.);vT=p+vec2(0.,texelSize.y);vB=p-vec2(0.,texelSize.y);gl_Position=vec4(p*2.-1.,0.,1.);}';
  var HEAD = '#version 300 es\nprecision highp float;precision highp sampler2D;in vec2 vUv,vL,vR,vT,vB;out vec4 o;';
  var FRAG = {
    splat: 'uniform sampler2D uTarget;uniform float aspect,radius;uniform vec3 color;uniform vec2 point;' +
      'void main(){vec2 p=vUv-point;p.x*=aspect;o=vec4(texture(uTarget,vUv).xyz+exp(-dot(p,p)/radius)*color,1.);}',
    advect: 'uniform sampler2D uVelocity,uSource;uniform vec2 texelSize;uniform float dt,diss;' +
      'void main(){vec2 c=vUv-dt*texture(uVelocity,vUv).xy*texelSize;o=texture(uSource,c)/(1.+diss*dt);o.a=1.;}',
    div: 'uniform sampler2D uVelocity;void main(){float L=texture(uVelocity,vL).x,R=texture(uVelocity,vR).x,T=texture(uVelocity,vT).y,B=texture(uVelocity,vB).y;' +
      'vec2 C=texture(uVelocity,vUv).xy;if(vL.x<0.)L=-C.x;if(vR.x>1.)R=-C.x;if(vT.y>1.)T=-C.y;if(vB.y<0.)B=-C.y;o=vec4(.5*(R-L+T-B),0.,0.,1.);}',
    curl: 'uniform sampler2D uVelocity;void main(){float L=texture(uVelocity,vL).y,R=texture(uVelocity,vR).y,T=texture(uVelocity,vT).x,B=texture(uVelocity,vB).x;o=vec4(.5*(R-L-T+B),0.,0.,1.);}',
    vort: 'uniform sampler2D uVelocity,uCurl;uniform float curl,dt;void main(){float L=texture(uCurl,vL).x,R=texture(uCurl,vR).x,T=texture(uCurl,vT).x,B=texture(uCurl,vB).x,C=texture(uCurl,vUv).x;' +
      'vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));f/=length(f)+1e-4;f*=curl*C;f.y*=-1.;vec2 v=texture(uVelocity,vUv).xy+f*dt;o=vec4(clamp(v,-1000.,1000.),0.,1.);}',
    press: 'uniform sampler2D uPressure,uDivergence;void main(){float L=texture(uPressure,vL).x,R=texture(uPressure,vR).x,T=texture(uPressure,vT).x,B=texture(uPressure,vB).x;' +
      'o=vec4((L+R+B+T-texture(uDivergence,vUv).x)*.25,0.,0.,1.);}',
    grad: 'uniform sampler2D uPressure,uVelocity;void main(){float L=texture(uPressure,vL).x,R=texture(uPressure,vR).x,T=texture(uPressure,vT).x,B=texture(uPressure,vB).x;' +
      'vec2 v=texture(uVelocity,vUv).xy-vec2(R-L,T-B);o=vec4(v,0.,1.);}',
    clear: 'uniform sampler2D uTexture;uniform float value;void main(){o=value*texture(uTexture,vUv);}',
    show: 'uniform sampler2D uTexture;uniform float cap;void main(){vec3 c=max(texture(uTexture,vUv).rgb,0.);float m=max(c.r,max(c.g,c.b));float a=min(m,cap);' +
      'o=m<.002?vec4(0.):vec4(c/m*a,a);}'
  };

  function compile(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  function program(frag) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, HEAD + frag));
    gl.linkProgram(p);
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
    return { p: p, u: u };
  }
  var P = {};
  for (var k in FRAG) P[k] = program(FRAG[k]);
  if (!gl.getProgramParameter(P.splat.p, gl.LINK_STATUS)) { canvas.remove(); return; }

  /* ── framebuffers ── */
  function size(res) {
    var a = gl.drawingBufferWidth / gl.drawingBufferHeight; if (a < 1) a = 1 / a;
    var mn = Math.round(res), mx = Math.round(res * a);
    return gl.drawingBufferWidth > gl.drawingBufferHeight ? { w: mx, h: mn } : { w: mn, h: mx };
  }
  function fbo(w, h) {
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    var f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    return { t: t, f: f, w: w, h: h, tx: 1 / w, ty: 1 / h };
  }
  function pair(w, h) {
    var a = fbo(w, h), b = fbo(w, h);
    return { get read() { return a; }, get write() { return b; }, swap: function () { var x = a; a = b; b = x; } };
  }
  var vel, dye, div, curl, pres;
  function init() {
    var s = size(SIM_RES), d = size(DYE_RES);
    vel = pair(s.w, s.h); dye = pair(d.w, d.h); div = fbo(s.w, s.h); curl = fbo(s.w, s.h); pres = pair(s.w, s.h);
  }
  function resize() {
    var w = Math.max(2, Math.round(window.innerWidth / 1.5)), h = Math.max(2, Math.round(window.innerHeight / 1.5));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; init(); }
  }

  function blit(target) {
    if (target) { gl.viewport(0, 0, target.w, target.h); gl.bindFramebuffer(gl.FRAMEBUFFER, target.f); }
    else { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function tex(loc, unit, t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); }
  function use(pr, f) { gl.useProgram(pr.p); if (pr.u.texelSize && f) gl.uniform2f(pr.u.texelSize, f.tx, f.ty); return pr.u; }

  function splat(x, y, dx, dy, rgb) {
    var aspect = canvas.width / canvas.height, r = RADIUS * (aspect > 1 ? aspect : 1), u = use(P.splat);
    gl.uniform1f(u.aspect, aspect); gl.uniform2f(u.point, x, y); gl.uniform1f(u.radius, r);
    tex(u.uTarget, 0, vel.read.t); gl.uniform3f(u.color, dx, dy, 0); blit(vel.write); vel.swap();
    tex(u.uTarget, 0, dye.read.t); gl.uniform3f(u.color, rgb[0], rgb[1], rgb[2]); blit(dye.write); dye.swap();
  }

  function step(dt) {
    var u = use(P.curl, vel.read); tex(u.uVelocity, 0, vel.read.t); blit(curl);
    u = use(P.vort, vel.read); tex(u.uVelocity, 0, vel.read.t); tex(u.uCurl, 1, curl.t); gl.uniform1f(u.curl, CURL); gl.uniform1f(u.dt, dt); blit(vel.write); vel.swap();
    u = use(P.div, vel.read); tex(u.uVelocity, 0, vel.read.t); blit(div);
    u = use(P.clear, vel.read); tex(u.uTexture, 0, pres.read.t); gl.uniform1f(u.value, 0.8); blit(pres.write); pres.swap();
    u = use(P.press, vel.read); tex(u.uDivergence, 1, div.t);
    for (var i = 0; i < PRESSURE_ITER; i++) { tex(u.uPressure, 0, pres.read.t); blit(pres.write); pres.swap(); }
    u = use(P.grad, vel.read); tex(u.uPressure, 0, pres.read.t); tex(u.uVelocity, 1, vel.read.t); blit(vel.write); vel.swap();
    u = use(P.advect, vel.read); gl.uniform1f(u.dt, dt);
    tex(u.uVelocity, 0, vel.read.t); tex(u.uSource, 1, vel.read.t); gl.uniform1f(u.diss, VEL_DISS); blit(vel.write); vel.swap();
    gl.uniform2f(u.texelSize, dye.read.tx, dye.read.ty);
    tex(u.uVelocity, 0, vel.read.t); tex(u.uSource, 1, dye.read.t); gl.uniform1f(u.diss, DYE_DISS); blit(dye.write); dye.swap();
  }

  function render() {
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    var u = use(P.show); tex(u.uTexture, 0, dye.read.t); gl.uniform1f(u.cap, isDark() ? 0.42 : 0.3);
    gl.drawArrays(gl.TRIANGLES, 0, 3); gl.disable(gl.BLEND);
  }

  /* ── colours: blue, violet, pink (same family as the card hover) ── */
  function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
  var LIGHT = [[0.39, 0.40, 0.95], [0.66, 0.33, 0.97], [0.93, 0.43, 0.68]];
  var DARK = [[0.51, 0.55, 0.97], [0.75, 0.52, 0.99], [0.96, 0.45, 0.71]];
  function color(t) {
    var pal = isDark() ? DARK : LIGHT, f = (t * 0.00025) % 3, i = Math.floor(f), m = f - i, a = pal[i], b = pal[(i + 1) % 3];
    var k = 0.22; return [(a[0] + (b[0] - a[0]) * m) * k, (a[1] + (b[1] - a[1]) * m) * k, (a[2] + (b[2] - a[2]) * m) * k];
  }

  /* ── loop: runs only while the mouse is moving and the smoke is fading out ── */
  var running = false, last = 0, lastMove = 0, px = -1, py = -1, pending = null;
  function frame(now) {
    var dt = Math.min((now - last) / 1000 || 0.016, 0.0167); last = now;
    resize();
    if (pending) { splat(pending.x, pending.y, pending.dx, pending.dy, color(now)); pending = null; }
    step(dt); render();
    if (now - lastMove < 3500 && !document.hidden) requestAnimationFrame(frame); else running = false;
  }
  function wake() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }

  window.addEventListener('pointermove', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    var x = e.clientX / window.innerWidth, y = 1 - e.clientY / window.innerHeight;
    if (px >= 0) {
      var dx = (x - px) * FORCE, dy = (y - py) * FORCE;
      if (pending) { dx += pending.dx; dy += pending.dy; }
      if (Math.abs(dx) + Math.abs(dy) > 0.5) pending = { x: x, y: y, dx: dx, dy: dy };
    }
    px = x; py = y; lastMove = performance.now(); wake();
  }, { passive: true });
  document.addEventListener('mouseleave', function () { px = -1; });
  resize();
})();

/* ============================================================
   GROWFLO AI — hero shader background
   ------------------------------------------------------------
   Vanilla WebGL2 port of the animated cloud/nebula shader
   (original GLSL by Matthias Hurrle, @atzedent), recoloured
   from its rainbow default to the site's gold-on-black palette.

   Degrades silently: if WebGL2 is unavailable, or the visitor
   prefers reduced motion, the canvas stays hidden and the CSS
   gradient hero background shows through instead.
   ============================================================ */
(function () {
  'use strict';

  var canvas = document.getElementById('heroShader');
  if (!canvas) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return;   // no WebGL2 — leave the CSS background in place

  var VERT = [
    '#version 300 es',
    'precision highp float;',
    'in vec4 position;',
    'void main(){ gl_Position = position; }'
  ].join('\n');

  /* Original shader, unmodified — by Matthias Hurrle (@atzedent).
     Kept verbatim so the hero matches the reference component exactly. */
  var FRAG = [
    '#version 300 es',
    'precision highp float;',
    'out vec4 O;',
    'uniform vec2 resolution;',
    'uniform float time;',
    '#define FC gl_FragCoord.xy',
    '#define T time',
    '#define R resolution',
    '#define MN min(R.x,R.y)',
    'float rnd(vec2 p) {',
    '  p=fract(p*vec2(12.9898,78.233));',
    '  p+=dot(p,p+34.56);',
    '  return fract(p.x*p.y);',
    '}',
    'float noise(in vec2 p) {',
    '  vec2 i=floor(p), f=fract(p), u=f*f*(3.-2.*f);',
    '  float',
    '  a=rnd(i),',
    '  b=rnd(i+vec2(1,0)),',
    '  c=rnd(i+vec2(0,1)),',
    '  d=rnd(i+1.);',
    '  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);',
    '}',
    'float fbm(vec2 p) {',
    '  float t=.0, a=1.; mat2 m=mat2(1.,-.5,.2,1.2);',
    '  for (int i=0; i<5; i++) {',
    '    t+=a*noise(p);',
    '    p*=2.*m;',
    '    a*=.5;',
    '  }',
    '  return t;',
    '}',
    'float clouds(vec2 p) {',
    '  float d=1., t=.0;',
    '  for (float i=.0; i<3.; i++) {',
    '    float a=d*fbm(i*10.+p.x*.2+.2*(1.+i)*p.y+d+i*i+p);',
    '    t=mix(t,d,a);',
    '    d=a;',
    '    p*=2./(i+1.);',
    '  }',
    '  return t;',
    '}',
    'void main(void) {',
    '  vec2 uv=(FC-.5*R)/MN,st=uv*vec2(2,1);',
    '  vec3 col=vec3(0);',
    '  float bg=clouds(vec2(st.x+T*.5,-st.y));',
    '  uv*=1.-.3*(sin(T*.2)*.5+.5);',
    '  for (float i=1.; i<12.; i++) {',
    '    uv+=.1*cos(i*vec2(.1+.01*i, .8)+i*i+T*.5+.1*uv.x);',
    '    vec2 p=uv;',
    '    float d=length(p);',
    '    col+=.00125/d*(cos(sin(i)*vec3(1,2,3))+1.);',
    '    float b=noise(i+p+bg*1.731);',
    '    col+=.002*b/length(max(p,vec2(b*p.x*.02,p.y)));',
    '    col=mix(col,vec3(bg*.25,bg*.137,bg*.05),d);',
    '  }',
    '  O=vec4(col,1);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[GrowFlo shader]', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  var program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('[GrowFlo shader]', gl.getProgramInfoLog(program));
    return;
  }

  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(program, 'resolution');
  var uTime = gl.getUniformLocation(program, 'time');

  /* Render at half device-pixel-ratio: this is a soft, blurry background,
     so the extra resolution costs GPU for no visible gain. */
  function resize() {
    var dpr = Math.min(1.5, Math.max(1, window.devicePixelRatio * 0.5));
    var w = Math.floor(canvas.clientWidth * dpr);
    var h = Math.floor(canvas.clientHeight * dpr);
    if (w === 0 || h === 0) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  var raf = null;
  var running = false;
  var start = performance.now();
  var lastFrame = start;

  function frame(now) {
    if (!running) return;
    lastFrame = now;
    resize();
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (now - start) * 1e-3);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    raf = requestAnimationFrame(frame);
  }

  function play() {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }
  function pause() {
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  resize();
  canvas.classList.add('on');
  window.addEventListener('resize', resize);

  /* Only burn GPU while the hero is actually on screen, and stop
     entirely when the tab is backgrounded. */
  var onScreen = true;

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        onScreen = e.isIntersecting;
        if (onScreen && !document.hidden) play(); else pause();
      });
    }, { threshold: 0 }).observe(canvas);
  } else {
    play();
  }

  document.addEventListener('visibilitychange', function () {
    /* resume only if the hero is still the thing being looked at */
    if (document.hidden) { pause(); }
    else if (onScreen) { start += performance.now() - lastFrame; play(); }
  });
})();

/* ============================================================
   GROWFLO AI — motion + interaction
   Dependency-free. Runs offline. Respects reduced-motion.
   ============================================================ */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* ---------------------------------------------------------
     1. PAGE ENTRY WIPE
     --------------------------------------------------------- */
  var wipe = $('.wipe');
  window.addEventListener('load', function () {
    document.body.classList.add('loaded');
    if (wipe) { wipe.classList.add('out'); }
  });

  /* internal link transitions */
  $$('a[href]').forEach(function (a) {
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || a.target === '_blank' || /^(mailto|tel|http)/.test(href)) return;
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || REDUCED || !wipe) return;
      e.preventDefault();
      wipe.classList.remove('out');
      wipe.classList.add('in');
      setTimeout(function () { window.location.href = href; }, 480);
    });
  });


  /* ---------------------------------------------------------
     3. LIQUID-GLASS REFRACTION FILTER
        Injected once so every page gets it without repeating the
        markup. Only Chromium actually applies an SVG filter inside
        backdrop-filter; elsewhere the CSS blur alone carries it.
     --------------------------------------------------------- */
  /* Optics are handled by assets/js/liquid-glass.js (MIT, Deepika Rao) — it
     builds the displacement map, the multi-pass chromatic filter and the
     Safari/Firefox fallback. We just point it at the nav bar. */
  (function initNavGlass() {
    var bar = $('.nav-in');
    if (!bar || typeof window.liquidGlass !== 'function') return;
    /* the module's documented defaults, unchanged */
    window.__navGlass = window.liquidGlass(bar, {
      scale: -112,
      chroma: 6,
      border: 0.07,
      mapBlur: 12,
      blur: 3,
      saturate: 1.5,
      radius: null,
      fallbackBlur: 16
    });
  })();

  /* ---------------------------------------------------------
     4. NAV
     --------------------------------------------------------- */
  var nav = $('.nav');
  /* The bar stays put at all times — it only firms up its glass once you
     scroll off the hero. It is never hidden on scroll-down. */
  function navScroll() {
    if (nav) nav.classList.toggle('solid', window.scrollY > 40);
  }
  window.addEventListener('scroll', navScroll, { passive: true });
  navScroll();

  var burger = $('.burger');
  var mob = $('.mob');
  if (burger && mob) {
    burger.addEventListener('click', function () {
      var open = mob.classList.toggle('open');
      burger.classList.toggle('on', open);
      document.body.classList.toggle('is-locked', open);
    });
    $$('a', mob).forEach(function (a) {
      a.addEventListener('click', function () {
        mob.classList.remove('open');
        burger.classList.remove('on');
        document.body.classList.remove('is-locked');
      });
    });
  }

  /* ---------------------------------------------------------
     4. SPLIT TEXT (chars) for [data-split]
     --------------------------------------------------------- */
  $$('[data-split]').forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (w, wi) {
      var wrapEl = document.createElement('span');
      wrapEl.style.display = 'inline-block';
      wrapEl.style.whiteSpace = 'nowrap';
      w.split('').forEach(function (c) {
        var s = document.createElement('span');
        s.className = 'ch';
        s.textContent = c;
        wrapEl.appendChild(s);
      });
      el.appendChild(wrapEl);
      if (wi < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  });

  /* ---------------------------------------------------------
     5. REVEAL ON SCROLL
     --------------------------------------------------------- */
  /* Failsafe: no IntersectionObserver (very old browser) = show everything
     immediately. Content must never be stuck at opacity:0. */
  var HAS_IO = 'IntersectionObserver' in window;
  if (!HAS_IO) {
    $$('.rv, .line-mask, .ch').forEach(function (el) { el.classList.add('on'); });
    $$('[data-count]').forEach(function (el) {
      el.textContent = (el.getAttribute('data-pre') || '') + el.getAttribute('data-count') + (el.getAttribute('data-suffix') || '');
    });
    $$('.sys-step, .vis').forEach(function (el) { el.classList.add('live'); });
  }

  var io = HAS_IO && new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;

      if (el.classList.contains('ch-group')) {
        $$('.ch', el).forEach(function (c, i) {
          setTimeout(function () { c.classList.add('on'); }, i * 22);
        });
      } else {
        var d = parseInt(el.getAttribute('data-delay') || '0', 10);
        setTimeout(function () { el.classList.add('on'); }, d);
      }
      io.unobserve(el);
    });
  }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

  if (io) $$('.rv, .line-mask, .ch-group').forEach(function (el) { io.observe(el); });

  /* stagger helper: [data-stagger] children get incremental delay */
  $$('[data-stagger]').forEach(function (parent) {
    var step = parseInt(parent.getAttribute('data-stagger'), 10) || 90;
    $$('.rv', parent).forEach(function (child, i) {
      if (!child.hasAttribute('data-delay')) child.setAttribute('data-delay', i * step);
    });
  });

  /* ---------------------------------------------------------
     6. COUNTERS  [data-count="1240" data-suffix="+"]
     --------------------------------------------------------- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var dec = parseInt(el.getAttribute('data-dec') || '0', 10);
    var pre = el.getAttribute('data-pre') || '';
    var suf = el.getAttribute('data-suffix') || '';
    var dur = 1700;
    var t0 = null;
    if (REDUCED) { el.textContent = pre + target.toFixed(dec) + suf; return; }
    function tick(t) {
      if (!t0) t0 = t;
      var p = clamp((t - t0) / dur, 0, 1);
      var e = 1 - Math.pow(1 - p, 3);
      var v = target * e;
      el.textContent = pre + (dec ? v.toFixed(dec) : Math.round(v).toLocaleString()) + suf;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  if (HAS_IO) {
    var ioCount = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        animateCount(en.target);
        ioCount.unobserve(en.target);
      });
    }, { threshold: 0.5 });
    $$('[data-count]').forEach(function (el) { ioCount.observe(el); });
  }

  /* ---------------------------------------------------------
     7. PINNED SYSTEM SEQUENCE
     --------------------------------------------------------- */
  function initPinned(cfg) {
    var track = $(cfg.track);
    if (!track) return;

    if (REDUCED) {
      $$(cfg.step + ',' + cfg.vis, track).forEach(function (e) { e.classList.add('live'); });
      return;
    }

    var steps = $$(cfg.step, track);
    var viss = $$(cfg.vis, track);
    var bars = $$(cfg.bar, track);
    var counter = cfg.counter ? $(cfg.counter) : null;
    var current = -1;

    function setStep(i) {
      if (i === current) return;
      current = i;
      steps.forEach(function (s, k) { s.classList.toggle('live', k === i); });
      viss.forEach(function (v, k) { v.classList.toggle('live', k === i); });
      bars.forEach(function (b, k) { b.classList.toggle('done', k <= i); });
      if (counter) counter.textContent = (i < 9 ? '0' : '') + (i + 1);
      if (cfg.onStep) cfg.onStep(i, viss[i]);
    }

    function onScroll() {
      if (window.innerWidth <= 900) { steps.forEach(function (s) { s.classList.add('live'); }); return; }
      var r = track.getBoundingClientRect();
      var total = track.offsetHeight - window.innerHeight;
      var p = clamp(-r.top / total, 0, 0.9999);
      setStep(Math.floor(p * steps.length));
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  }

  initPinned({ track: '.sys-track', step: '.sys-step', vis: '.vis', bar: '.sys-prog i', counter: '#sysNow' });

  /* the rules section reuses the same driver, and counts the estimate tally
     up the moment its scoreboard step becomes live */
  initPinned({
    track: '.rules-track', step: '.rule-step', vis: '.rvis', bar: '.rules-prog i', counter: '#ruleNow',
    onStep: function (i, vis) {
      if (!vis) return;
      var el = $('[data-rcount]', vis);
      if (!el || el.dataset.done) return;
      el.dataset.done = '1';
      var target = parseInt(el.getAttribute('data-rcount'), 10) || 0;
      var t0 = performance.now();
      (function tick() {
        var p = clamp((performance.now() - t0) / 900, 0, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      })();
    }
  });

  /* ---------------------------------------------------------
     8. PARALLAX  [data-para="0.14"]
     --------------------------------------------------------- */
  var paras = $$('[data-para]');
  if (paras.length && !REDUCED) {
    var ticking = false;
    function para() {
      paras.forEach(function (el) {
        var sp = parseFloat(el.getAttribute('data-para'));
        var r = el.getBoundingClientRect();
        var off = (r.top + r.height / 2 - window.innerHeight / 2) * sp;
        el.style.transform = 'translate3d(0,' + off.toFixed(1) + 'px,0)';
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(para); }
    }, { passive: true });
    para();
  }

  /* ---------------------------------------------------------
     9. MAGNETIC BUTTONS
     --------------------------------------------------------- */
  if (FINE && !REDUCED) {
    $$('[data-magnet]').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.28;
        var y = (e.clientY - r.top - r.height / 2) * 0.42;
        el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      });
      el.addEventListener('mouseleave', function () {
        el.style.transition = 'transform .5s cubic-bezier(.22,1,.36,1)';
        el.style.transform = '';
        setTimeout(function () { el.style.transition = ''; }, 500);
      });
    });
  }

  /* ---------------------------------------------------------
     10. VIDEO TESTIMONIAL
     --------------------------------------------------------- */
  $$('.vt-player').forEach(function (p) {
    var v = $('video', p);
    p.addEventListener('click', function () {
      if (!v) return;
      if (v.paused) { p.classList.add('playing'); v.controls = true; v.play(); }
      else { v.pause(); p.classList.remove('playing'); }
    });
  });

  /* ---------------------------------------------------------
     12. YEAR
     --------------------------------------------------------- */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();

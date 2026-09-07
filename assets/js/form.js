/* ============================================================
   GROWFLO AI — multi-step qualifying form
   ------------------------------------------------------------
   CONFIGURE ME:  set ENDPOINT to wherever leads should land.
     • Formspree    -> 'https://formspree.io/f/xxxxxxx'
     • GoHighLevel  -> your inbound webhook URL
     • Make/Zapier  -> your catch-hook URL
   Leave it empty and the form still works — it just logs the
   payload to the console instead of sending it.
   ============================================================ */
(function () {
  'use strict';

  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbzvWQQOjhuS3EXPgFW3njum8ZAgRdgBXDenWEHoTOZd2-AP_rO2YVtRgLv2HQ4MnseYKA/exec';
  var REDIRECT_AFTER = '';     // optional: '/thank-you.html' instead of the booking step

  /* Body is always JSON. The header decides whether the browser sends a CORS
     preflight first:
       'text/plain;charset=utf-8'  no preflight — REQUIRED for Google Apps
                                   Script, and fine for Make / Zapier / GHL
       'application/json'          triggers a preflight — use only if your
                                   endpoint answers OPTIONS (e.g. Formspree) */
  var CONTENT_TYPE = 'text/plain;charset=utf-8';

  /* GoHighLevel booking widget shown on the final step. This is a public
     embed URL, not a credential — safe to ship in a public file. */
  var CAL_URL = 'https://api.leadconnectorhq.com/widget/booking/bsc6yBx9MfXKer7SJRe4';

  var form = document.getElementById('gfForm');
  if (!form) return;

  var steps = Array.prototype.slice.call(form.querySelectorAll('.fstep'));
  var bar = document.getElementById('fbar');
  var now = document.getElementById('fnow');
  var back = document.getElementById('fback');
  var next = document.getElementById('fnext');
  var nextTxt = document.getElementById('fnextTxt');
  var err = document.getElementById('ferr');
  var done = document.getElementById('fdone');
  var nav = form.querySelector('.fnav');
  var total = steps.length;
  var i = 0;

  /* NB: use form.elements — form.name would return the <form> name attribute,
     not the input called "name". */
  function el(n) { return form.elements[n]; }
  function val(n) { return (el(n) && el(n).value ? el(n).value : '').trim(); }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* the last step is the booking calendar — it has no nav of its own */
  function isBook(k) { return steps[k] && steps[k].getAttribute('data-req') === 'book'; }

  function paint() {
    steps.forEach(function (s, k) { s.classList.toggle('live', k === i); });
    bar.style.transform = 'scaleX(' + ((i + 1) / total) + ')';
    now.textContent = pad(i + 1);
    back.classList.toggle('hide', i === 0 || isBook(i));
    nav.style.display = isBook(i) ? 'none' : '';
    nextTxt.textContent = (i === total - 2) ? 'Save & pick a time' : 'Continue';
    err.classList.remove('on');
  }

  /* option chips light up */
  form.addEventListener('change', function (e) {
    var input = e.target;
    if (input.type === 'radio') {
      form.querySelectorAll('input[name="' + input.name + '"]').forEach(function (r) {
        r.closest('.opt').classList.toggle('sel', r.checked);
      });
      err.classList.remove('on');
      /* radio steps auto-advance — fewer clicks, higher completion */
      if (i < total - 1) setTimeout(function () { go(1); }, 260);
    } else if (input.type === 'checkbox') {
      input.closest('.opt').classList.toggle('sel', input.checked);
      err.classList.remove('on');
    }
  });

  function fail(msg) {
    err.textContent = msg;
    err.classList.add('on');
    return false;
  }

  function valid() {
    var step = steps[i];
    var req = step.getAttribute('data-req');

    if (req === 'trade' || req === 'spend' || req === 'capacity') {
      var name = req;
      if (!form.querySelector('input[name="' + name + '"]:checked')) return fail('Pick an option to continue.');
    }
    if (req === 'city') {
      if (val('city').length < 2) return fail('Tell us the city you work in.');
    }
    if (req === 'pain') {
      if (!form.querySelectorAll('input[name="pain"]:checked').length) return fail('Tick at least one.');
    }
    if (req === 'contact') {
      if (val('name').length < 2) return fail('We need your name.');
      if (val('company').length < 2) return fail('We need your business name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email'))) return fail('That email doesn\'t look right.');
      if (val('phone').replace(/\D/g, '').length < 7) return fail('We need a working mobile number.');
    }
    return true;
  }

  function go(dir) {
    if (dir > 0 && !valid()) return;
    var target = i + dir;
    if (target < 0 || target >= total) return;
    /* Moving on to the booking step sends the lead first, so an abandoned
       booking is still captured. The step only opens once that succeeds. */
    if (dir > 0 && isBook(target)) { submit(); return; }
    i = target;
    paint();
  }

  next.addEventListener('click', function () { go(1); });
  back.addEventListener('click', function () { go(-1); });

  /* Enter advances, but never submits early */
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); go(1); }
  });

  function collect() {
    return {
      trade: (form.querySelector('input[name="trade"]:checked') || {}).value || '',
      city: val('city'),
      radius: val('radius'),
      adSpend: (form.querySelector('input[name="spend"]:checked') || {}).value || '',
      capacity: (form.querySelector('input[name="capacity"]:checked') || {}).value || '',
      painPoints: Array.prototype.map.call(form.querySelectorAll('input[name="pain"]:checked'), function (c) { return c.value; }).join(', '),
      name: val('name'),
      company: val('company'),
      email: val('email'),
      phone: val('phone'),
      notes: val('notes'),
      source: 'growfloai.com/start',
      submittedAt: new Date().toISOString()
    };
  }

  /* Builds the booking iframe with the visitor's details prefilled, so they
     don't retype what they just gave us. Built with createElement and a
     URL-encoded query string — never innerHTML, so there is no injection
     sink even though this handles user input. */
  function mountCalendar(payload) {
    var slot = document.getElementById('calEmbed');
    if (!slot || slot.getAttribute('data-mounted')) return;
    slot.setAttribute('data-mounted', '1');

    var parts = (payload.name || '').split(/\s+/).filter(Boolean);
    var q = new URLSearchParams({
      first_name: parts[0] || '',
      last_name: parts.slice(1).join(' '),
      email: payload.email || '',
      phone: payload.phone || ''
    });

    var frame = document.createElement('iframe');
    frame.src = CAL_URL + '?' + q.toString();
    frame.title = 'Book your 15-minute fit call';
    frame.setAttribute('scrolling', 'no');
    frame.style.cssText = 'width:100%;border:0;min-height:740px;display:block;border-radius:inherit';
    frame.addEventListener('load', function () {
      var load = document.getElementById('calLoad');
      if (load) load.style.display = 'none';
    });
    slot.appendChild(frame);

    /* GoHighLevel's own resize helper — official snippet, HTTPS only */
    if (!document.getElementById('ghlEmbedJs')) {
      var s = document.createElement('script');
      s.id = 'ghlEmbedJs';
      s.src = 'https://link.msgsndr.com/js/form_embed.js';
      document.body.appendChild(s);
    }
  }

  /* the lead is in — open the booking step */
  function finish(payload) {
    if (REDIRECT_AFTER) { window.location.href = REDIRECT_AFTER; return; }

    var bookIndex = -1;
    steps.forEach(function (s, k) { if (isBook(k)) bookIndex = k; });

    if (bookIndex === -1) {          // no booking step in the markup — fall back
      form.style.display = 'none';
      document.querySelector('.fbar').style.display = 'none';
      document.querySelector('.fmeta').style.display = 'none';
      if (done) { done.classList.add('on'); done.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      return;
    }

    next.style.pointerEvents = '';
    i = bookIndex;
    paint();
    mountCalendar(payload);
    document.querySelector('.fcard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function submit() {
    if (!valid()) return;
    if (val('website')) return;               // honeypot tripped — silently stop

    try {
      var lastSub = parseInt(localStorage.getItem('gf_last_sub') || '0', 10);
      if (Date.now() - lastSub < 30000) return fail('You just submitted — please wait a moment.');
    } catch (e) {}

    err.classList.remove('on');               // clear any leftover validation message
    var payload = collect();
    nextTxt.textContent = 'Sending…';
    next.style.pointerEvents = 'none';

    /* No endpoint configured yet: go straight to the booking step so the flow
       stays testable. Deliberately silent — the payload is lead PII and must
       never reach the console of a live page. */
    if (!ENDPOINT) {
      setTimeout(function () { finish(payload); }, 400);
      return;
    }

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': CONTENT_TYPE },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) throw new Error('bad response');
      try { localStorage.setItem('gf_last_sub', String(Date.now())); } catch (e) {}
      finish(payload);
    }).catch(function () {
      next.style.pointerEvents = '';
      nextTxt.textContent = 'Save & pick a time';
      fail('Something went wrong. Try again, or email ron@growfloai.com.');
    });
  }

  paint();
})();

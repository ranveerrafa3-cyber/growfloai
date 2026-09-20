/**
 * GrowFlo AI — lead receiver: Google Sheet + GoHighLevel
 * ---------------------------------------------------------------
 * Paste this into Extensions > Apps Script on your leads spreadsheet,
 * then Deploy > New deployment > Web app:
 *     Execute as:        Me
 *     Who has access:    Anyone
 * Copy the /exec URL it gives you and paste it into ENDPOINT in
 * assets/js/form.js.
 *
 * That /exec URL is an INBOUND WEBHOOK, not a credential. It is safe in
 * public page source. Never put a Google API key, an OAuth token or a
 * GoHighLevel private token in the website file.
 *
 * ---------------------------------------------------------------
 * TWO KINDS OF POST
 *
 * The form now reports twice over:
 *
 *   kind: 'partial'   sent every time the visitor lands on a new question.
 *                     Writes/updates a row marked "Partial" so you can see
 *                     WHERE people quit. Never touches GoHighLevel — a
 *                     half-filled form has no email to put in the CRM.
 *
 *   kind: 'complete'  sent when they leave step 6, exactly as before.
 *                     Upgrades that same row to "Completed" and pushes to
 *                     GoHighLevel.
 *
 * Both carry the same `session` id, so one visitor is one row that fills in
 * as they go — not six rows.
 *
 * WHAT A PARTIAL ROW CAN AND CANNOT TELL YOU: contact details are question
 * 6, the last one. Anyone who quits before that has no name, email or phone
 * to record, so partial rows are mostly anonymous — they tell you which
 * question loses people, not who to chase.
 *
 * ---------------------------------------------------------------
 * GOHIGHLEVEL SETUP (one time, ~2 minutes)
 *
 * The GHL public API cannot create workflows, so this script talks to
 * the Contacts API directly instead — no workflow needed at all.
 *
 *   1. In GHL: Settings > Private Integrations > Create new integration
 *   2. Give it these two scopes ONLY:  contacts.write   contacts.readonly
 *   3. Copy the token it shows you (starts "pit-"). It is shown ONCE.
 *   4. In this Apps Script editor: Project Settings (gear, left rail)
 *      > Script Properties > Add script property, twice:
 *
 *          GHL_TOKEN        pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 *          GHL_LOCATION_ID  iF7UZK1vVmlM8MmfD7Eu
 *
 * The token lives in Script Properties — server-side, never in this file,
 * never in the repo, never in the browser. That is the whole reason the
 * GHL call happens here rather than in assets/js/form.js.
 *
 * Leave GHL_TOKEN unset and the script still works — it writes the sheet
 * row and just marks the GHL column "skipped".
 * ---------------------------------------------------------------
 *
 * Security notes (report A2 / A5): the browser's checks are only UX, so
 * this script re-validates every field, drops honeypot hits, and writes
 * everything as plain text so a formula pasted into a form field can
 * never execute inside the sheet.
 */

var SHEET_NAME = 'Leads';
var FUNNEL_NAME = 'Funnel';

var GHL_API = 'https://services.leadconnectorhq.com';
var GHL_VERSION = '2021-07-28';

/* The six question steps, in order, as the form reports them. Index + 1 is
   the step number the visitor sees. Kept here so the Funnel tab can list
   every step even when nobody has reached it yet. */
var STEPS = [
  'Trade',
  'Service area',
  'Ad spend',
  'Capacity',
  'What is breaking',
  'Contact details'
];

var COLUMNS = [
  'Received',       // server timestamp — first time we heard from this visitor
  'Stage',          // Partial / Completed — written by this script
  'Reached step',   // e.g. "3 of 6 — Ad spend" — how far they got
  'Name',
  'Business',
  'Email',
  'Phone',
  'Trade',
  'City',
  'Travel radius',
  'Ad spend',
  'Capacity',
  'What is breaking',
  'Notes',
  'Booked call',    // you fill in — Yes / No
  'Status',         // you fill in — New / Contacted / Booked / Won / Passed
  'Source',
  'Submitted (browser)',
  'Last update',    // server timestamp — most recent ping from this visitor
  'Session',        // ties a visitor's partial pings and final submit together
  'GHL'             // written by this script — ok / skipped / an error
];

/** 1-based column number for a header name. */
function col(name) {
  var k = COLUMNS.indexOf(name);
  if (k === -1) throw new Error('unknown column: ' + name);
  return k + 1;
}

/**
 * Turns {header: value} into a full row array in COLUMNS order, so adding
 * or moving a column never means renumbering appendRow() by hand.
 */
function rowFrom(values) {
  return COLUMNS.map(function (name) {
    return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : '';
  });
}

/* ============================================================
   ENTRY POINT
   ============================================================ */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return reply(400, 'no body');

    var d = JSON.parse(e.postData.contents);

    // Honeypot: a real person never fills this. Accept and discard.
    if (d.website) return reply(200, 'ok');

    return String(d.kind || 'complete') === 'partial'
      ? handlePartial(d)
      : handleComplete(d);
  } catch (err) {
    return reply(500, 'error');
  }
}

/* ============================================================
   PARTIAL — they are still filling it in, or they quit
   ============================================================ */

/**
 * Records how far a visitor got. Deliberately lenient about validation:
 * the whole point is to capture a form that was never finished, so empty
 * fields are expected and must not be rejected. Nothing here reaches the
 * CRM — see the header comment.
 */
function handlePartial(d) {
  var session = sessionId(d.session);
  if (!session) return reply(400, 'no session');

  // A visitor sends ~6 of these. Anything past 40 in ten minutes is abuse,
  // not a person filling in a form.
  var cache = CacheService.getScriptCache();
  var key = 'pc_' + session;
  var count = parseInt(cache.get(key) || '0', 10) + 1;
  if (count > 40) return reply(429, 'too many updates');
  cache.put(key, String(count), 600);

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return reply(503, 'busy');
  }

  try {
    var sheet = getSheet();
    var row = findRowBySession(sheet, session);

    // A late partial ping must never drag a finished lead back to "Partial".
    if (row && String(sheet.getRange(row, col('Stage')).getValue()) === 'Completed') {
      return reply(200, 'ok');
    }

    var answers = answerCells(d);
    answers['Stage'] = 'Partial';
    answers['Reached step'] = reachedStep(d);
    answers['Last update'] = new Date();

    if (row) {
      writeCells(sheet, row, answers);
    } else {
      answers['Received'] = new Date();
      answers['Session'] = text(session);
      answers['Status'] = 'Abandoned';
      answers['GHL'] = 'n/a (partial)';
      sheet.appendRow(rowFrom(answers));
    }

    return reply(200, 'ok');
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
   COMPLETE — they finished all six questions
   ============================================================ */

function handleComplete(d) {
  // Re-validate server-side — a bot can POST straight here, skipping the form.
  var email = String(d.email || '').trim();
  var phone = String(d.phone || '').replace(/\D/g, '');
  if (String(d.name || '').trim().length < 2) return reply(422, 'name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return reply(422, 'email');
  if (phone.length < 7) return reply(422, 'phone');

  var cache = CacheService.getScriptCache();
  var cacheKey = 'rl_' + email.toLowerCase().replace(/[^a-z0-9@.]/g, '');
  if (cache.get(cacheKey)) return reply(429, 'duplicate — try again in a few minutes');
  cache.put(cacheKey, '1', 300);

  var session = sessionId(d.session);

  /* The sheet is the source of truth and gets written FIRST. If GHL is
     down, rate-limiting us, or the token has been rotated, the lead is
     still captured — we only lose the CRM copy, and the GHL column says
     so. Never let a CRM failure lose a lead. */
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return reply(503, 'busy');
  }

  var sheet, row;
  try {
    sheet = getSheet();

    var values = answerCells(d);
    values['Stage'] = 'Completed';
    values['Reached step'] = STEPS.length + ' of ' + STEPS.length + ' — ' + STEPS[STEPS.length - 1];
    values['Email'] = text(email);
    values['Last update'] = new Date();

    // Upgrade the partial row this visitor already has, if there is one.
    row = session ? findRowBySession(sheet, session) : 0;

    if (row) {
      values['Status'] = 'New';          // was "Abandoned" while partial
      values['GHL'] = 'sending…';
      writeCells(sheet, row, values);
    } else {
      values['Received'] = new Date();
      values['Session'] = text(session);
      values['Booked call'] = '';
      values['Status'] = 'New';
      values['GHL'] = 'sending…';
      sheet.appendRow(rowFrom(values));
      row = sheet.getLastRow();
    }
  } finally {
    lock.releaseLock();
  }

  var status;
  try {
    status = pushToGHL(d, email);
  } catch (err) {
    status = 'error: ' + (err && err.message ? err.message : err);
  }
  sheet.getRange(row, col('GHL')).setValue(text(status));

  return reply(200, 'ok');
}

/* ============================================================
   ROW HELPERS
   ============================================================ */

/** The answer fields shared by both kinds of post. */
function answerCells(d) {
  return {
    'Name': text(d.name),
    'Business': text(d.company),
    'Email': text(d.email),
    'Phone': text(d.phone),
    'Trade': text(d.trade),
    'City': text(d.city),
    'Travel radius': text(d.radius),
    'Ad spend': text(d.adSpend),
    'Capacity': text(d.capacity),
    'What is breaking': text(d.painPoints),
    'Notes': text(d.notes),
    'Source': text(d.source),
    'Submitted (browser)': text(d.submittedAt)
  };
}

/** "3 of 6 — Ad spend", from whatever the browser reported. */
function reachedStep(d) {
  var n = parseInt(d.step, 10);
  if (!n || n < 1) n = 1;
  if (n > STEPS.length) n = STEPS.length;
  var label = String(d.stepName || '').trim() || STEPS[n - 1];
  return n + ' of ' + STEPS.length + ' — ' + label;
}

/**
 * Writes only the cells we have values for, leaving everything else — the
 * columns you fill in by hand, like "Booked call" — untouched.
 */
function writeCells(sheet, row, values) {
  Object.keys(values).forEach(function (name) {
    sheet.getRange(row, col(name)).setValue(values[name]);
  });
}

/** Row number for a session id, or 0. One read of the Session column. */
function findRowBySession(sheet, session) {
  if (!session) return 0;
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var column = sheet.getRange(2, col('Session'), last - 1, 1).getValues();
  for (var k = 0; k < column.length; k++) {
    if (String(column[k][0]) === session) return k + 2;
  }
  return 0;
}

/** Session ids are generated by us; accept only our own shape. */
function sessionId(v) {
  var s = String(v || '').trim();
  return /^[A-Za-z0-9._-]{8,80}$/.test(s) ? s : '';
}

/* ============================================================
   GOHIGHLEVEL
   ============================================================ */

/**
 * Upserts the lead as a GHL contact, then attaches the qualifying answers
 * as a note. Upsert (not create) so a homeowner who submits twice updates
 * one contact instead of spawning a duplicate.
 *
 * The qualifying answers go in a NOTE rather than custom fields on purpose:
 * custom fields have to be addressed by their GHL-internal id, which would
 * break silently the moment anyone edits the field in the UI. A note always
 * survives and is always readable.
 */
function pushToGHL(d, email) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('GHL_TOKEN');
  var locationId = props.getProperty('GHL_LOCATION_ID');

  if (!token || !locationId) return 'skipped (no token)';

  var parts = String(d.name || '').trim().split(/\s+/).filter(String);

  var body = {
    locationId: locationId,
    firstName: parts.shift() || '',
    lastName: parts.join(' '),
    name: String(d.name || '').trim(),
    email: email,
    phone: e164(d.phone),
    companyName: String(d.company || '').trim(),
    city: String(d.city || '').trim(),
    source: String(d.source || 'growflo website form'),
    tags: ['website form', 'qualifying form']
      .concat(d.trade ? ['trade: ' + String(d.trade).toLowerCase()] : [])
      .concat(d.adSpend ? ['ad spend: ' + String(d.adSpend).toLowerCase()] : [])
  };

  var res = ghlFetch('/contacts/upsert', token, body);
  if (res.getResponseCode() >= 300) {
    return 'error ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 180);
  }

  var parsed = JSON.parse(res.getContentText());
  var contactId = parsed && parsed.contact && parsed.contact.id;
  if (!contactId) return 'ok (no note — no contact id returned)';

  var note = ghlFetch('/contacts/' + contactId + '/notes', token, {
    body: noteBody(d)
  });

  return note.getResponseCode() < 300
    ? 'ok'
    : 'contact ok, note failed ' + note.getResponseCode();
}

function ghlFetch(path, token, payload) {
  return UrlFetchApp.fetch(GHL_API + path, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token,
      Version: GHL_VERSION,
      Accept: 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

/** The qualifying answers, as one readable block on the contact. */
function noteBody(d) {
  return [
    'GrowFlo qualifying form',
    '',
    'Trade:            ' + (d.trade || '—'),
    'City:             ' + (d.city || '—'),
    'Travel radius:    ' + (d.radius || '—'),
    'Monthly ad spend: ' + (d.adSpend || '—'),
    'Capacity:         ' + (d.capacity || '—'),
    'What is breaking: ' + (d.painPoints || '—'),
    '',
    'Notes: ' + (d.notes || '—'),
    '',
    'Submitted: ' + (d.submittedAt || '—') + '  ·  Source: ' + (d.source || '—')
  ].join('\n');
}

/**
 * GHL matches and dials on E.164. The form accepts "(555) 123-4567", so
 * normalise here rather than nagging the visitor mid-form. Anything that
 * isn't a recognisable US/CA number is passed through untouched — better
 * a slightly odd number in the CRM than a dropped lead.
 */
function e164(v) {
  var s = String(v || '').trim();
  if (s.charAt(0) === '+') return s;
  var n = s.replace(/\D/g, '');
  if (n.length === 10) return '+1' + n;
  if (n.length === 11 && n.charAt(0) === '1') return '+' + n;
  return s;
}

/* ============================================================
   SHEET
   ============================================================ */

/** Visiting the /exec URL in a browser should not look broken. */
function doGet() {
  return ContentService
    .createTextOutput('GrowFlo lead endpoint is live. POST JSON here.')
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Neutralise spreadsheet formula injection: a value starting with = + - @
 * would otherwise be evaluated as a formula when the sheet renders it.
 */
function text(v) {
  var s = (v === null || v === undefined) ? '' : String(v);
  s = s.slice(0, 2000);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS);
    var header = sheet.getRange(1, 1, 1, COLUMNS.length);
    header.setFontWeight('bold')
          .setBackground('#111111')
          .setFontColor('#E5A729');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(col('Received'), 150);
    sheet.setColumnWidth(col('Reached step'), 190);
    sheet.setColumnWidth(col('Email'), 220);
    sheet.setColumnWidth(col('What is breaking'), 300);
    sheet.setColumnWidth(col('Notes'), 320);
    sheet.setColumnWidth(col('Last update'), 150);
    sheet.setColumnWidth(col('Session'), 90);
    paintStageColours(sheet);
  }
  return sheet;
}

/**
 * Completed rows green, abandoned ones amber, so the two groups separate at
 * a glance without anyone having to sort or filter.
 */
function paintStageColours(sheet) {
  var range = sheet.getRange(2, 1, sheet.getMaxRows() - 1, COLUMNS.length);
  var letter = columnLetter(col('Stage'));

  var completed = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$' + letter + '2="Completed"')
    .setBackground('#12301C')
    .setRanges([range])
    .build();

  var partial = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$' + letter + '2="Partial"')
    .setBackground('#3A2A08')
    .setRanges([range])
    .build();

  sheet.setConditionalFormatRules([completed, partial]);
}

/** 1 -> A, 27 -> AA. */
function columnLetter(n) {
  var s = '';
  while (n > 0) {
    var r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = (n - r - 1) / 26;
  }
  return s;
}

function reply(code, msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: code === 200, status: code, message: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   THE FUNNEL TAB
   ============================================================ */

/**
 * A live read-out of who finished and who did not, and which question loses
 * them. Every cell is a formula over the Leads tab, so it updates itself as
 * rows arrive — there is nothing to re-run.
 */
function buildFunnel() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(FUNNEL_NAME) || ss.insertSheet(FUNNEL_NAME);
  sheet.clear();
  sheet.setHiddenGridlines(true);

  var stage = "'" + SHEET_NAME + "'!$" + columnLetter(col('Stage')) + '$2:$' + columnLetter(col('Stage'));
  var step = "'" + SHEET_NAME + "'!$" + columnLetter(col('Reached step')) + '$2:$' + columnLetter(col('Reached step'));

  var started = 'COUNTIF(' + stage + ',"<>")';
  var done = 'COUNTIF(' + stage + ',"Completed")';
  var quit = 'COUNTIF(' + stage + ',"Partial")';

  var rows = [
    ['GrowFlo AI — form funnel', ''],
    ['', ''],
    ['Started the form', '=' + started],
    ['Finished all 6 questions', '=' + done],
    ['Quit part-way', '=' + quit],
    ['Completion rate', '=IFERROR(' + done + '/' + started + ',0)'],
    ['', ''],
    ['Where people quit', 'Still sitting there']
  ];

  STEPS.forEach(function (label, k) {
    rows.push([
      (k + 1) + '. ' + label,
      '=COUNTIFS(' + stage + ',"Partial",' + step + ',"' + (k + 1) + ' of ' + STEPS.length + '*")'
    ]);
  });

  sheet.getRange(1, 1, rows.length, 2).setValues(rows);

  sheet.getRange('A1:B1').merge()
       .setFontSize(14).setFontWeight('bold')
       .setBackground('#111111').setFontColor('#E5A729');
  sheet.getRange('A8:B8').setFontWeight('bold');
  sheet.getRange('A3:A6').setFontWeight('bold');
  sheet.getRange('B6').setNumberFormat('0.0%');
  sheet.setColumnWidth(1, 240);
  sheet.setColumnWidth(2, 140);

  return sheet;
}

/* ============================================================
   RUN THESE FROM THE EDITOR
   ============================================================ */

/**
 * Run once to create the sheet and header row before any lead arrives.
 * Select setup() and press Run.
 */
function setup() {
  getSheet();
  buildFunnel();
}

/**
 * ONE-TIME, for a sheet created before the Stage / Reached step / Last
 * update / Session columns existed.
 *
 * Reads the existing header, rewrites it to the current COLUMNS, and moves
 * every existing row's values to wherever their column now lives — matching
 * by header NAME, so nothing lands in the wrong place. Old rows have no
 * session and were all finished forms, so they are marked "Completed".
 *
 * Safe to run twice: a sheet already on the current columns is left alone.
 */
function migrate() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) { setup(); return 'created a fresh sheet'; }

  var width = sheet.getLastColumn();
  var old = width ? sheet.getRange(1, 1, 1, width).getValues()[0].map(String) : [];

  if (old.join('\u0000') === COLUMNS.join('\u0000')) {
    buildFunnel();
    return 'already up to date';
  }

  var lastRow = sheet.getLastRow();
  var body = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, width).getValues() : [];

  var moved = body.map(function (r) {
    var byName = {};
    old.forEach(function (name, k) { byName[name] = r[k]; });
    byName['Stage'] = byName['Stage'] || 'Completed';
    byName['Reached step'] = byName['Reached step'] ||
      (STEPS.length + ' of ' + STEPS.length + ' — ' + STEPS[STEPS.length - 1]);
    return rowFrom(byName);
  });

  sheet.clear();
  sheet.appendRow(COLUMNS);
  sheet.getRange(1, 1, 1, COLUMNS.length)
       .setFontWeight('bold').setBackground('#111111').setFontColor('#E5A729');
  sheet.setFrozenRows(1);
  if (moved.length) {
    sheet.getRange(2, 1, moved.length, COLUMNS.length).setValues(moved);
  }
  paintStageColours(sheet);
  buildFunnel();

  return 'migrated ' + moved.length + ' row(s)';
}

/**
 * Run this after setting GHL_TOKEN to prove the CRM leg works end to end.
 * It creates a real contact named "GrowFlo Test" — delete it in GHL after.
 * Check View > Logs for the result.
 */
function testGHL() {
  var out = pushToGHL({
    name: 'GrowFlo Test',
    company: 'Test Roofing Co',
    phone: '5551234567',
    trade: 'Roofing',
    city: 'Austin, TX',
    radius: '25 miles',
    adSpend: '$5k–10k',
    capacity: '10–20 jobs/mo',
    painPoints: 'Leads go cold, no follow-up',
    notes: 'This is a test row. Safe to delete.',
    source: 'apps-script test',
    submittedAt: new Date().toISOString()
  }, 'test@growfloai.com');
  Logger.log(out);
  return out;
}

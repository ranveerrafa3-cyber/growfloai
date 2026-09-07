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

var GHL_API = 'https://services.leadconnectorhq.com';
var GHL_VERSION = '2021-07-28';

var COLUMNS = [
  'Received',       // server timestamp — the one you can trust
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
  'GHL'             // written by this script — ok / skipped / an error
];

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return reply(400, 'no body');

    var d = JSON.parse(e.postData.contents);

    // Honeypot: a real person never fills this. Accept and discard.
    if (d.website) return reply(200, 'ok');

    // Re-validate server-side — a bot can POST straight here, skipping the form.
    var email = String(d.email || '').trim();
    var phone = String(d.phone || '').replace(/\D/g, '');
    if (String(d.name || '').trim().length < 2) return reply(422, 'name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return reply(422, 'email');
    if (phone.length < 7) return reply(422, 'phone');

    /* The sheet is the source of truth and gets written FIRST. If GHL is
       down, rate-limiting us, or the token has been rotated, the lead is
       still captured — we only lose the CRM copy, and the GHL column says
       so. Never let a CRM failure lose a lead. */
    var sheet = getSheet();
    sheet.appendRow([
      new Date(),
      text(d.name),
      text(d.company),
      text(email),
      text(d.phone),
      text(d.trade),
      text(d.city),
      text(d.radius),
      text(d.adSpend),
      text(d.capacity),
      text(d.painPoints),
      text(d.notes),
      '',                       // Booked call
      'New',                    // Status
      text(d.source),
      text(d.submittedAt),
      'sending…'
    ]);
    var row = sheet.getLastRow();

    var status;
    try {
      status = pushToGHL(d, email);
    } catch (err) {
      status = 'error: ' + (err && err.message ? err.message : err);
    }
    sheet.getRange(row, COLUMNS.length).setValue(text(status));

    return reply(200, 'ok');
  } catch (err) {
    return reply(500, 'error');
  }
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
    sheet.setColumnWidth(1, 150);   // Received
    sheet.setColumnWidth(4, 220);   // Email
    sheet.setColumnWidth(11, 300);  // What is breaking
    sheet.setColumnWidth(12, 320);  // Notes
  }
  return sheet;
}

function reply(code, msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: code === 200, status: code, message: msg }))
    .setMimeType(ContentService.MimeType.JSON);
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

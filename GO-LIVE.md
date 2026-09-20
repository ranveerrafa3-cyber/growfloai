# GrowFlo AI — go-live runbook

Covers the security report actions, the leads spreadsheet, and the booking step.
Work top to bottom. Nothing here needs a backend, a database, or any npm package —
that absence is most of why this site is low-risk. Keep it that way.

---

## 1. Wire up the leads spreadsheet (30 min, do this first)

The form has no server, so leads reach a Google Sheet through an Apps Script
web app. That web app URL is an **inbound webhook** — safe to ship in public
page source. A Google API key or GoHighLevel private token is **not**, and must
never go in any file in this folder.

**Steps**

1. Create a new Google Sheet. Name it `GrowFlo — Leads`.
2. **Extensions → Apps Script**. Delete the placeholder code.
3. Paste all of [`leads-sheet/apps-script.gs`](leads-sheet/apps-script.gs). Save.
4. In the editor, select the `setup` function and press **Run**. Approve the
   permission prompt. This creates the `Leads` tab and the header row.
5. **Deploy → New deployment → Web app**
   - Description: `GrowFlo lead receiver`
   - Execute as: **Me**
   - Who has access: **Anyone**  ← required; "Anyone with Google account" breaks it
6. Copy the **Web app URL** (ends in `/exec`).
7. Open [`assets/js/form.js`](assets/js/form.js) and paste it in:

   ```js
   var ENDPOINT = 'https://script.google.com/macros/s/AKfy..../exec';
   ```

8. Submit a real test lead and confirm the row lands in the sheet.

> **Re-deploying after you edit the script:** Deploy → Manage deployments →
> pencil icon → Version: **New version** → Deploy. Editing the code alone does
> not update the live URL.

**Columns you get:** Received · Stage · Reached step · Name · Business · Email ·
Phone · Trade · City · Travel radius · Ad spend · Capacity · What is breaking ·
Notes · Booked call · Status · Source · Submitted (browser) · Last update ·
Session · GHL

`Booked call` and `Status` are yours to fill in — the script leaves `Status`
as `New` on a finished form and `Abandoned` on one that was never completed.
[`leads-sheet/growflo-leads-template.csv`](leads-sheet/growflo-leads-template.csv)
shows the exact layout with example rows if you'd rather start from an import.

### Who finished and who didn't

`setup()` also builds a **Funnel** tab: how many started, how many finished, the
completion rate, and a count of how many are still sitting on each question.
Every cell is a formula over the `Leads` tab, so it updates itself — there is
nothing to re-run.

On the `Leads` tab itself, **Stage** is the column that matters:

| Stage | Means | Status starts as |
|---|---|---|
| `Partial` | Started the form, never finished it. Amber row. | `Abandoned` |
| `Completed` | Answered all six questions. Green row. | `New` |

**Reached step** tells you exactly where a partial one stopped, e.g.
`3 of 6 — Ad spend`. Sort or filter on **Stage** to split the two groups.

**What a partial row can't tell you:** contact details are question 6, the last
one. Anyone who quits before that has no name, email or phone to record, so
most partial rows are anonymous. They show you *which question loses people*,
not who to chase. Partial rows are never pushed to GoHighLevel.

> **Upgrading a sheet you already have:** the `Stage`, `Reached step`,
> `Last update` and `Session` columns are new. Paste the current script, then
> select **`migrate`** in the editor and press Run — once. It rewrites the
> header and moves every existing row's values to their new positions by
> matching on column *name*, marks your existing leads `Completed`, and builds
> the Funnel tab. Running it twice is harmless; it reports
> `already up to date` and changes nothing.

**Don't change `CONTENT_TYPE` in form.js** unless you switch endpoints. It's set
to `text/plain;charset=utf-8` so the browser skips the CORS preflight that Apps
Script can't answer. The body is still JSON. Formspree is the exception — it
wants `application/json`.

---

## 2. Security report — what's already done

| Item | Status |
|---|---|
| **A1** No secrets in the source | ✅ Verified — scan for `api_key`/`secret`/`Bearer`/`sk_`/`AIza`/`Authorization` returns zero hits; `ENDPOINT` left empty for you |
| **A4** Lead PII logged to console | ✅ Fixed — the `console.log(payload)` is gone; the no-endpoint path is now silent |
| **A5** DOM-injection sinks | ✅ Verified — no `innerHTML`, `insertAdjacentHTML`, `document.write` or `eval` anywhere. The new calendar embed uses `createElement`, so it stays clean |
| **A5** Server-side re-validation | ✅ Done — `apps-script.gs` re-checks name/email/phone and drops honeypot hits, because a bot can POST straight past the browser |
| **A5** Formula injection into the sheet | ✅ Done — values starting `=` `+` `-` `@` are prefixed with `'` so they can't execute as spreadsheet formulas |
| **A8** `charset` + `viewport` | ✅ Already present in all four pages |
| **A3** Header configs written | ✅ [`_headers`](_headers) (Netlify / Cloudflare Pages) and [`vercel.json`](vercel.json) — **but see step 3** |

## 3. Security report — what you still have to do

### A3 — deploy the headers ✅ edited, still needs deploying
Both config files are now filled in for **Google Apps Script**:

```
https://script.google.com https://script.googleusercontent.com
```

is set in **both** `connect-src` and `form-action`. Both hosts are needed —
`/exec` is served from the first and redirects to the second, so listing only
one kills the POST on the redirect.

GoHighLevel is deliberately **not** in `connect-src`. The CRM push runs
server-side inside `leads-sheet/apps-script.gs`, so the browser never talks to
GHL and the API token never leaves Google. `api.leadconnectorhq.com` remains in
`frame-src` for the booking calendar iframe only.

Deploy, then scan the live URL at
[securityheaders.com](https://securityheaders.com) — aim for A/A+.

The CSP already allows `https://api.leadconnectorhq.com` and
`https://link.msgsndr.com` in `frame-src`/`script-src` for the booking widget.

> **Test on staging first.** A too-tight CSP fails silently — fonts stop
> loading, the form POST dies, or the calendar shows blank. Check all three
> before pointing the domain at it.

### A2 — spam protection 🟠
The honeypot is still there and still worth keeping, but it only stops bots
that fill the form *in a browser*. Once the endpoint URL is visible in page
source, a bot can POST straight to it.

The Apps Script already drops honeypot hits and malformed payloads, which
handles most of it. If junk still gets through, add **Cloudflare Turnstile**
and verify the token inside `doPost` — never in the browser.

### A7 — placeholders 🟠
Done:

- ✅ Contact details — now `ron@growfloai.com` in all three footers and in the
  `form.js` error message. The phone line was removed entirely.
- ✅ The four `NEEDS CONFIRMING` FAQ answers — confirmed correct by the user,
  flags removed, copy final.

Still in the source — **all of these are invented content and must not ship**:

- ~~the three case studies~~ — ✅ real clients as of 2026-09-06. Three `TODO`
  markers remain in the markup: NB Garage's city/state, NB Garage's ad spend
  (its ROAS shows an em dash until then), and all three `case-N.jpg`
  screenshots.
- The `⚠ PLACEHOLDER NUMBERS` block on `results.html` line 71
- The founder story on `about.html` — three placeholder paragraphs under
  "The pattern we kept seeing"

### Out of scope, but don't skip it
Your AI qualification and CRM automation run in **GoHighLevel**, not on this
site. The expensive risks from the report live there: put a **hard budget cap
and billing alerts** on the AI provider, and rate-limit anything downstream of
this form so a spammed endpoint can't trigger unlimited AI runs.

On keys: the GHL Private Integration token lives in **Apps Script Script
Properties**, server-side. Scope it to `contacts.write` + `contacts.readonly`
and nothing more. If it ever leaks, rotate it in GHL — that instantly
invalidates the old one.

---

## 4. The booking step

Step 7 of the form is the GoHighLevel calendar
(`sZ7Ccm8VUwYUJhvCtGPv`), configured in `CAL_URL` at the top of `form.js`.

**How the flow works:** the lead is POSTed to your spreadsheet when they leave
step 6 — *before* the calendar appears. So someone who fills in the form and
then abandons the booking still reaches you. The booking step only opens once
that submission succeeds.

As they move through questions 2-6 the form also sends a lightweight progress
ping, so a form that is *never* finished still lands in the sheet as a
`Partial` row. Those pings are fire-and-forget: if one fails it is silently
dropped rather than interrupting someone mid-form.

The iframe is built with the visitor's name, email and phone prefilled from
what they just typed, so they don't enter it twice.

If the calendar can't load, an "Open it in a new tab" link sits underneath it.

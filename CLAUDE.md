# GrowFlo AI — project context

Auto-loaded by every Claude Code session started in this folder. Read it before
touching anything; it records decisions that aren't visible in the code.

---

## What this is

A one-page marketing site (plus the `start.html` form) for **GrowFlo AI** — a done-for-you growth system for
**home service contractors** (roofing, HVAC, remodeling, windows, solar…).

The offer, in the client's own words: run the ads → contact every homeowner
**within 60 seconds** → a **human** sales team qualifies them against the
contractor's criteria → only qualified homeowners get **booked onto the
contractor's calendar** → review generation → monthly follow-up/reactivation.
Guarantee is a booked-estimate target scaled to ad spend, plus **one contractor
per trade, per city**. Pricing is deliberately hidden — the CTA is a qualifying
form, then a fit call, then a sales call.

The whole pitch is **"booked estimates, not leads."** Keep copy on that line.

## Hard constraints — do not violate

- **Static HTML/CSS/JS only.** No React, no Tailwind, no TypeScript, no build
  step, no npm packages, no framework. The user has pasted React components
  three times; each time the technique was ported to vanilla by hand. Do that
  again rather than introducing a framework.
- **No backend, no database, no auth, no payments.** Most of this site's
  safety comes from how little it does. A security audit (see `GO-LIVE.md`)
  explicitly says not to add these.
- **Dark / near-monochrome.** Black ground, bone text, one gold accent.
- Heavy animation is wanted, but **the user rejects things that drift from what
  they asked for.** Direct quote: *"and dont just change becaue you want to."*
  Change what was asked, nothing adjacent.

## File map

```
index.html      home     ONE PAGE: hero, #system (pinned 6-step motion scenes),
                         #results (numbers, screenshots, video, chat screenshots),
                         #problem, #how, #guarantee, #faq, CTA
start.html      form     7-step qualifying form + GHL booking calendar
confirmation.html        post-booking page with VSL slot
assets/css/style.css     single stylesheet, CSS custom properties as tokens
assets/js/main.js        reveals, counters, pinned-scroll driver, nav glass
assets/js/form.js        the 7-step form — ENDPOINT lives here
assets/js/shader.js      WebGL2 hero nebula (verbatim @atzedent shader)
assets/js/liquid-glass.js  MIT, Deepika Rao — nav bar refraction
leads-sheet/             Google Apps Script + CSV template for the leads sheet
.claude/og-image.html    SOURCE for assets/img/og.png (1200x630 share card).
                         Deploy-excluded. Regenerate with headless Chrome —
                         the exact command is in a comment at the top of it.
_headers, vercel.json    security headers — CSP set to Apps Script, done
GO-LIVE.md               the runbook — read this before deploying
.claude-session/         session transcript. NEVER DEPLOY. See DO-NOT-DEPLOY.txt
```

Design tokens (premium pass, 2026-10-07): `--ink #000` `--ink-1 #0A0A0B`
`--ink-2 #111113` `--ink-3 #18181B` `--bone #F2F0EB` (warm ivory)
`--bone-dim #BDB9B1` `--muted #8F8B83` `--gold #D6B06B` (champagne)
`--gold-lit #EBCB8F` `--gold-dp #A07E3F`. Fonts: **Inter Tight** (display)
+ **Inter** (text), replacing Space Grotesk at the user's request for "more
professional fonts". Instrument Serif is only loaded on start.html and confirmation.html (their italic accent words).
The wordmark is "GrowFlo AI" in mixed case (G and F capital), never all caps.
The hero kept its layout but lost its Tailwind orange/yellow/red: ivory →
champagne headline, gold-lit button, smoky warm shader. One accent only:
no blue/purple anywhere (the header CTA ring used to be indigo).
`.claude/og-image.html` / `og.png` still use the old look; regenerate if asked.

## Decisions already made — don't re-litigate

- **The hero stays as it is.** A pinned scroll-story hero was fully built,
  verified, and then **reverted at the user's request** — they preferred the
  original. Direct quote: *"I think I'll stick with the old hero, and I don't
  want anything extra in this one."* Don't rebuild it.
- **Page structure follows the user's own landing-page framework:** hero →
  social proof → problem → solution → features → how it works → FAQ → CTA →
  footer. That order is intentional; it was specified explicitly.
- **One page, no About, no Results page (2026-10-06).** The user asked for the
  contractorai.co pattern: everything on one scroll, the nav jumps to sections
  (`#results #system #how #faq`), and far less copy. `about.html` and
  `results.html` were deleted; `vercel.json` 301s them to `/` and `/#results`.
  Don't re-add pages or pad sections back out. Sections without a nav link carry
  `data-nav` so the scroll-spy keeps the right link underlined.
- **The System comes straight after the hero, and is motion-only (2026-10-07).**
  User's call: no descriptions, no tags — each step is a huge title plus a
  looping CSS scene in `.sx-stage` (leads streaming in and popping, ringing
  phone + 0:47 clock, human checkpoint, calendar filling, stars, padlock that
  clicks shut). Step 06's title is "One contractor per city." (2026-10-07: the
  user found "Your city, locked" unclear).
  Scenes are sized in `cqmin` and only animate under `.sx-step.live`. Base
  styles are the final frame, which is what reduced-motion shows. The case
  study cards were removed at the user's request ("random clutter").
- **Type floor (2026-10-07, Apple HIG + apple.com's own CSS as the reference).**
  Body 17px/1.55. No label below 12px; uppercase labels track .08–.12em, never
  .14–.2em. Reading copy 16–17px. Headline tracking −.018 to −.03em (tighter as
  size grows). `--muted-2` is for lines/decoration only, never text (3.7:1 on
  black); text greys use `--muted` or lighter. Form inputs are 17px so iOS
  Safari doesn't zoom on focus (it zooms below 16px). Don't reintroduce
  10–11px labels. Scene labels inside `.sx-stage` use `max(<px>, Ncqmin)` floors.
- **VSL motion kit** lives in the vault: `Brand/VSL Motion Kit/` (standalone
  `system-scenes.html` + `Motion Spec.md`). If the System scenes change here,
  regenerate the kit so the VSL and the site stay in sync.
- **Background + intro pass (2026-10-07), approved as a set but each block is
  separately removable.** The user asked for it this way: if they dislike one,
  delete exactly that block, nothing else. Blocks are labelled at the end of
  style.css: [BG-1] streak-free band behind the hero subtitle (canvas mask +
  deeper scrim), [BG-2] vignette hero-only, [BG-3] grain static + hero-only,
  [INTRO] ~1s intro with no scroll lock (timings also in main.js §1, old values
  in its comment), [BG-5] champagne-glow hero fallback, [BG-6] glow behind
  Results numbers + ink-1 bands on #problem and #guarantee.
- **The video testimonial is click-to-load** (thumbnail + play button). A live
  YouTube iframe pushed the load event from ~1s to 4–6s, and the intro loader
  waits for that event. Keep it a facade.
- **Form sends the lead when leaving step 6, before the calendar appears**, so
  an abandoned booking is still captured.
- **The form also pings progress on every question from 2 onwards**
  (`kind:'partial'` + a per-visit `session` id), so a form that is never
  finished still lands in the sheet as a `Partial` row and you can see which
  question loses people. The pings are fire-and-forget — a failed one must
  never interrupt someone filling the form. Partial rows are **never** pushed
  to GHL: there is no email to push before question 6.
- **The artifact bundle** (`claude.ai/code/artifact/786e6b81-f195-4db4-ab44-a745040bb98e`)
  is a single-file build of all 4 pages with a hash router, rebuilt by
  `bundle.js` in the scratchpad. The calendar iframe cannot work there —
  artifact CSP blocks third-party frames — hence the "open in a new tab" link.

## Lead flow — Apps Script is the hub

```
start.html form  ──POST──>  Apps Script /exec  ──┬──> Google Sheet row
                                                 └──> GHL contact + note
```

**The GHL public API cannot create workflows** — the whole `workflows` domain
is one read-only `get-workflow` operation. Don't go looking for a create
endpoint or promise the user one. That is why the CRM push is a direct
Contacts-API call from `apps-script.gs` instead of an inbound webhook into a
workflow: it needs no workflow at all.

**The leads spreadsheet** does not have a fixed URL — the user creates it
themselves via sheets.new, in their own Google account, and pastes
`apps-script.gs` into its Extensions > Apps Script editor. (A first attempt at
creating one through a Drive MCP connector produced a file the user's own
account couldn't open — 2026-09-06 — so don't offer to create it via a
connector again; direct the user to sheets.new instead.)

The sheet should stay **empty** until `setup()` is run — `apps-script.gs`'s
`setup()` builds the `Leads` tab and its styled header row itself, so the
columns can never drift from the script. Don't hand-create headers there.

The GHL Private Integration token lives in **Apps Script Script Properties**
(`GHL_TOKEN`, `GHL_LOCATION_ID`), server-side. It must never move into
`form.js` or any other file the browser downloads. Location id is
`iF7UZK1vVmlM8MmfD7Eu`.

The sheet row is written **before** the GHL call, and the GHL result is
recorded in the sheet's `GHL` column. A CRM outage must never lose a lead.

One visitor is **one row**, keyed by `session`: the partial pings create it and
fill it in, the final submit upgrades the same row to `Completed`. A late
partial ping can never drag a completed row back — that guard is tested. The
`Funnel` tab is pure formulas over `Leads`, so it never needs re-running.
`migrate()` moves an older 17-column sheet onto the current columns by matching
header *names*, and is safe to run twice.

**"Booked call" is filled by a second, separate webhook**, not by anything
form.js sends. A GHL Workflow (built by hand in the GHL UI, on the
"Qualified Estimates Strategy Call" calendar, trigger "Customer Booked
Appointment") POSTs to the same `/exec` URL with `?source=ghl_booking&key=…`
on it. `doPost()` routes on that query string — added 2026-09-24 — never on
the JSON body, because a GHL workflow's payload shape isn't documented
anywhere reliable and isn't ours to control. The `key` is checked against
Script Property `BOOKING_WEBHOOK_KEY` so a stranger who finds the public
`/exec` URL can't fake a booking. The handler matches by **email** (GHL
doesn't know our `session` id) against the most recent row for that email,
and never creates a new row — an unmatched email is logged and dropped.
`bookingEmail()`/`bookingTime()` guess at several plausible GHL payload
shapes; if the real payload doesn't match any of them, `Logger.log` records
the raw body so the guess can be corrected from a real example rather than
from GHL's documentation.

## Open items (need the user, not code)

- ~~`ENDPOINT` in `assets/js/form.js` is empty~~ — ✅ **set 2026-09-06,
  re-pointed 2026-09-20.** The original sheet and its Apps Script deployment
  lived in a *third party's* Google account, which the user no longer has a
  relationship with. Leads and the `GHL_TOKEN` were sitting in someone else's
  Drive. Replaced on 2026-09-20 with a sheet called **"leads tracker -
  website"** in the user's own account (`ron@growfloai.com`), a fresh
  deployment, and a **rotated** GHL Private Integration token — the old
  integration was deleted. The old `/exec` URL (`AKfycbzv…`) is defunct; never
  restore it. The leads captured before that date remain in the third party's
  spreadsheet and are unrecoverable without their cooperation. If you ever need to
  re-verify: a POST to `/exec` 302-redirects to a `script.googleusercontent.com`
  echo URL, and the real JSON reply is on THAT url, not on `/exec` itself.
  `curl -L` mangles this — it can 405 on a perfectly working deployment. Curl
  without `-L`, read the `Location` header, then `curl` that URL separately.
  Don't mistake a curl redirect artifact for a broken script twice.
- The three case studies (removed from the site 2026-10-07; data kept in git history) are **real clients** (Grand City
  Epoxy, NB Garage, Twin Brothers), added 2026-09-06. Three gaps remain, all
  marked `TODO` in the markup — **do not invent values for them**:
    1. NB Garage's city and state (its `case-tag` has no location; the other
       two do).
    2. NB Garage's ad spend, so its ROAS renders as an em dash `&mdash;`.
    3. All three `assets/img/case-N.jpg` screenshots. The slot falls back to a
       placeholder until the file exists, so nothing breaks meanwhile.
- **Cases 1 and 2 report `Leads / mo` and `Cost per lead`; case 3 reports
  `Estimates booked / mo`.** That inconsistency is the user's own data, flagged
  to them 2026-09-06 and not yet resolved. It cuts against the site's
  "booked estimates, not leads" line, on the page meant to prove it.

## Settled — don't redo

- **The domain is `growfloai.com`** — not `growflo.ai`. Confirmed 2026-09-05.
  It appears in the `start.html` footer link and as the `source` tag on every
  lead (`growfloai.com/start`). Don't "correct" it back to the `.ai` spelling.
- Contact details: `ron@growfloai.com`, in all three footers and the `form.js`
  error message. The phone number line was removed entirely, by request.
- The four `NEEDS CONFIRMING` FAQ answers were confirmed correct by the user
  on 2026-09-05; the flags are gone and the copy is final.
- CSP `connect-src` / `form-action` point at Apps Script (both
  `script.google.com` and `script.googleusercontent.com` — `/exec` redirects).
  GHL is in `frame-src` for the calendar only.
- **Link previews are done.** All four pages carry a full `og:` + `twitter:`
  set with **absolute** URLs — scrapers are not browsers and silently ignore a
  relative `og:image`, which is how the original `assets/img/og.jpg` was broken
  (it also didn't exist). Canonical is on the three indexable pages;
  `start.html` is `noindex`, so it deliberately has none.
- The share card `assets/img/og.png` is generated, not hand-drawn. Edit
  `.claude/og-image.html` and re-render rather than editing the PNG.

## Traps — already hit once, don't repeat

- **`liquid-glass.js` contains `</script>` inside a comment.** Inlining it into
  a single HTML file closes the tag early and kills every script on the page.
  The bundler neutralises it; anything else that inlines JS must too.
- **Over-broad selectors split numbers onto two lines.** `.stat span` also
  matched the counter `<span>` *inside* `<b>`. Always use direct-child
  selectors (`.proof-num > span`) for stat labels.
- **A grid item's automatic minimum size can silently defeat `object-fit:cover`.**
  `.shot img` had `width:100%;height:100%;object-fit:cover` but no
  `min-height:0`. A landscape photo happened to work by coincidence (its
  intrinsic ratio never demanded more height than the box). A portrait photo
  doesn't: the grid item's automatic minimum size is computed from its own
  intrinsic ratio, which for a tall image exceeds `height:100%`, so the img
  silently grows past the box instead of being cropped — `object-position`
  then does nothing, because there's no size mismatch left for it to act on.
  Fixed by adding `min-width:0;min-height:0;` to `.shot img`. If a future
  `.shot`-like component ever fights `object-fit:cover` again, check this
  first before reaching for `object-position`.
- **Google Apps Script can't answer a CORS preflight.** `form.js` sends
  `Content-Type: text/plain;charset=utf-8` (body still JSON) so no preflight
  fires. Don't "fix" this to `application/json`.
- **The in-app preview pane suspends `requestAnimationFrame` and returns torn
  screenshots after scrolling.** It will show a shader as dead and reveals as
  never firing on a page that works fine in a real browser. Verify motion by
  comparing against the original in the same pane, or ask the user to look.
  Don't report animation as broken based on that pane alone.
- ~~This machine's Bash tool is missing coreutils~~ — **stale.** That was the
  original Windows machine. The project now lives on macOS at
  `~/Downloads/growflo` and the full GNU/BSD toolchain works normally.
- `--muted-2` (#6B6B65) on black fails WCAG contrast for body text. Use
  `--bone-dim` for anything meant to be read.

## Running it

```bash
node ".claude/serve.js"       # http://localhost:4321
```

Dev server sends no-cache headers — it was added because browser caching
repeatedly made the user think changes hadn't applied.

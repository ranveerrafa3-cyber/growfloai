# GrowFlo AI — project context

Auto-loaded by every Claude Code session started in this folder. Read it before
touching anything; it records decisions that aren't visible in the code.

---

## What this is

A 4-page marketing site for **GrowFlo AI** — a done-for-you growth system for
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
index.html      home     hero, proof, marquee, problem, better-way,
                         features (pinned 6-step), how-it-works, guarantee, FAQ, CTA
results.html    proof    top stats, 30-day result w/ real screenshots,
                         video testimonial, 3 case studies, 3 chat screenshots
about.html      story    founder story, pinned 3-rule counter-scroll section
start.html      form     7-step qualifying form + GHL booking calendar
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

Design tokens: `--ink #000` `--bone #F4F4F2` `--bone-dim #C9C9C2`
`--muted #9A9A93` `--gold #E5A729`. Fonts: Space Grotesk + Instrument Serif
(taken from contractorai.co at the user's request).

## Decisions already made — don't re-litigate

- **The hero stays as it is.** A pinned scroll-story hero was fully built,
  verified, and then **reverted at the user's request** — they preferred the
  original. Direct quote: *"I think I'll stick with the old hero, and I don't
  want anything extra in this one."* Don't rebuild it.
- **Page structure follows the user's own landing-page framework:** hero →
  social proof → problem → solution → features → how it works → FAQ → CTA →
  footer. That order is intentional; it was specified explicitly.
- **The homepage proof section is a condensed teaser on purpose.** The user
  earlier said to strip anything duplicated from Results. The homepage keeps
  small screenshots + 4 numbers + one quote, all linking out to `results.html`.
- **Form sends the lead when leaving step 6, before the calendar appears**, so
  an abandoned booking is still captured.
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

## Open items (need the user, not code)

- ~~`ENDPOINT` in `assets/js/form.js` is empty~~ — ✅ **set 2026-09-06.**
  Deployed `/exec` URL confirmed live end-to-end with a manual POST that
  returned `{"ok":true,"status":200,"message":"ok"}`. If you ever need to
  re-verify: a POST to `/exec` 302-redirects to a `script.googleusercontent.com`
  echo URL, and the real JSON reply is on THAT url, not on `/exec` itself.
  `curl -L` mangles this — it can 405 on a perfectly working deployment. Curl
  without `-L`, read the `Location` header, then `curl` that URL separately.
  Don't mistake a curl redirect artifact for a broken script twice.
- The three case studies in `results.html` are now **real clients** (Grand City
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

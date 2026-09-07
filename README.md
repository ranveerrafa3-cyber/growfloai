# GrowFlo AI — website

Static HTML/CSS/JS. No build step, no dependencies, no framework. Drag the folder onto
Netlify, Vercel, Cloudflare Pages, Hostinger, or any host that serves files.

```
index.html          Home — hero, problem, the 5-step system, results, testimonials, guarantee, CTA
results.html        Proof — top-line numbers, video testimonial, 3 case studies, 6 text testimonials
about.html          Story, three operating rules, what you actually run
start.html          The conversion page — 6-step qualifying form, then the calendar
assets/css/style.css
assets/js/main.js   Animation + interaction
assets/js/form.js   The form (CONFIGURE THIS — see below)
growflo logo.png    Your original file. The site draws the mark as inline SVG so it stays
                    crisp and can be tinted; the PNG is used as the favicon.
.claude/            Local preview helper only. Safe to delete before deploying.
```

**Preview locally:**

```bash
node .claude/serve.js
```

Then open http://localhost:4321

---

## ⚠️ Replace before launch

Everything below is placeholder. Search the files for `⚠` to find each one in place.

### 1. Numbers

**Real and confirmed by you** — the Twin Brothers Coatings block on `results.html`
(`$2,982` spend → `339` leads → `$280,059` closed → `93×` ROAS), backed by the two
screenshots in `assets/img/`. Bobby Whitus: `$170k` in six weeks, `80×` ROAS.

**Still your call** — the four top-line summary figures on `results.html`:

| Figure | Status |
|---|---|
| `600+` estimates booked | you gave this |
| `47s` avg. speed to contact | **still a placeholder** |
| `4.9` avg. review rating | **still a placeholder** |
| `50×` avg. return on ad spend | you gave this |

They're written as `data-count="600"` — change that attribute, not the text between the
tags. `data-dec="1"` means "show one decimal place".

The three generic case studies further down `results.html` are still `data-count="00"`
on purpose, so they're obviously unset.

### 2. Contact details ✅ done
`ron@growfloai.com` is in the footer of all three content pages and in the
`form.js` error message. The phone number line was removed by request.

### 3. Founder story
`about.html` — three placeholder paragraphs under "The pattern we kept seeing". Written as
instructions to you rather than as fake copy, so it can't be published by accident.

### 4. Case studies
`results.html` — three blocks, each with trade, city, a headline, a short before/after
paragraph, three numbers, and a screenshot slot.

---

## 📹 What to send me for testimonials

### Video testimonial (you have 1)
- **The file** → save as `assets/video/testimonial-1.mp4` (1080p, H.264)
- **A poster frame** → `assets/img/testimonial-1-poster.jpg` (16:9). Pick a frame where
  they're looking at the camera and mid-expression, not blinking.
- **The strongest single sentence they say** — this becomes the big pull-quote next to the
  player. Currently placeholder text on both `index.html` and `results.html`.
- **Their name, role, company, city** → replaces "Client Name / Owner · Company · City"
- **A square headshot** → `assets/img/client-1.jpg` (400×400 min)
- Optional: the timestamp of their best 20–30 seconds, if you want a short cut version.

### Text testimonials (send 4–6)
For each one I need:
1. **Name**
2. **Role and company** — or `Owner, 3-truck HVAC company` if they won't be named
3. **The quote** — 2–3 sentences max
4. **A square headshot** → `assets/img/t1.jpg` … `t6.jpg` (400×400 min)
5. **One hard number** → goes in the copper `metric` line above the quote

That metric line is the part that converts. Aim for things like:
- `31 estimates in 30 days`
- `$0 → $84k in 90 days`
- `Cut cost per booked job by 61%`

A testimonial that says "great to work with" does almost nothing. One that says
"we went from 4 estimates a week to 19" does the selling for you.

### Also useful
- **Result screenshots** → `assets/img/case-1.jpg`, `case-2.jpg`, `case-3.jpg`
  (Ads Manager, CRM calendar view, review dashboard — blur anything sensitive)
- **Client logos** → transparent PNGs
- **Founder photo** → `assets/img/founder.jpg` (4:5 portrait)
- **A social share image** → `assets/img/og.jpg` (1200×630)

Note: until you drop these files in, the browser console shows 404s for them and avatars
render blank. That's expected, not a bug — it clears the moment the files exist.

---

## 🔌 Connecting the form

Open `assets/js/form.js`. Line 12:

```js
var ENDPOINT = '';   // <-- paste your webhook / form URL here
```

Set it to whichever you use:
- **GoHighLevel** — an inbound webhook URL (most likely, given your stack)
- **Formspree** — `https://formspree.io/f/xxxxxxx`
- **Make / Zapier** — a catch-hook URL

It POSTs JSON with these fields: `trade`, `city`, `radius`, `adSpend`, `capacity`,
`painPoints`, `name`, `company`, `email`, `phone`, `notes`, `source`, `submittedAt`.

Leave `ENDPOINT` empty and the form still runs end-to-end — it just logs the payload to
the console instead of sending. Useful for testing.

**Calendar:** in `start.html`, find the `<div class="cal-embed" id="calEmbed">` block and
replace the whole div with your Calendly / Cal.com / GHL embed snippet. It appears right
after the form is submitted, which is the flow you asked for: form first, then booking,
then the sales call.

There's a hidden honeypot field to absorb bot submissions. Leave it alone.

---

## Design notes

- **Palette:** near-black `#070605` with burnt copper `#B4552A`. No cool tones anywhere —
  every accent, glow and gradient is warm. All colours are CSS variables at the top of
  `style.css`, so the whole site retints from about six lines.
- **Type:** Oswald (condensed uppercase) for display, Inter for body, JetBrains Mono for
  labels and numbers — the mono gives it the "system/dashboard" read that fits the AI name.
- **Motion:** custom cursor, page-transition wipe, line-masked headline reveals, magnetic
  buttons, parallax glows, counting numbers, film grain, and the scroll-pinned 5-step
  system section (the centrepiece — the visual on the right changes as you scroll through
  the steps).
- **Reduced motion:** if a visitor has "reduce motion" on at the OS level, all animation is
  disabled and everything renders static. Nothing is ever stuck invisible.
- **Mobile:** the pinned section unpins and stacks; the abstract stage visuals are hidden
  rather than shrunk.

## Editing text

All copy is plain HTML — open the file, find the sentence, change it. No templating.
The only thing to be careful with is `data-count`, where the number lives in the attribute
rather than between the tags.

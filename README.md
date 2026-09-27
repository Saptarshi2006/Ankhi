# Happy 19th, Ankhi

A birthday site for Ankhi Debnath. Next.js, statically exported, built to deploy
to Cloudflare Workers.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

To see the real artefact rather than the dev server:

```bash
npm run build
npm run serve        # http://localhost:3100
```

## Checks

```bash
npm run typecheck
npm run lint
npm run test:e2e     # builds, then tests out/ in Chromium + iPhone/WebKit
```

`test:e2e` runs against the export on purpose: the dev server compiles on demand
and hides prerender-time problems.

## How the intro works

Everything in the intro lives in **one** section with one sticky viewport. Both
the balloon and the heading share the frame, so it is never empty while pinned.

| Range (vh) | Phase |
| --- | --- |
| `0 → 1.25` | Balloon grows from `scale(0.34)` toward the viewer. Scroll locks at the end. |
| `1.25 → 1.5` | Pop. Canvas burst, synthesised pop, lock released, page glides to the title. |
| `1.5 → 1.7` | "Happy 19th" fades in at centre, crossfading with the reprise. |
| `1.7 → 2.7` | The two words travel to opposite edges and hold. |
| `2.7 → 3.2` | They hold while the frame is still pinned. |
| `3.2 → 4.2` | They fade as the frame scrolls away into the letter. |

Those numbers are constants in `lib/stage-ranges.ts`, in viewport heights so they
behave the same on a phone and a desktop. The track height in `globals.css`
(`--track-stage`) must stay equal to `STAGE.trackVh × 100vh`.

State lives in `components/intro/Intro.tsx` as
`approach → armed → popping → settled`. Everything else takes props off that.

### The crowd

From the balloon appearing through to "Happy 19th", with a silence in the
middle. Three parts, all scheduled against the audio clock rather than with
timers, so the gap is the length it claims to be:

```
crowd gain → 0 over 120ms  ──┐
playPop at +130ms           ─┘
crowd surges back over 900ms, landing as the title arrives
```

A `setTimeout` between two audio events drifts by however long the main thread
was busy, and a pop that lands early — on the crowd's tail — does not land.

Loudness **and** brightness both follow the balloon's growth, so it reads as a
room filling up rather than a volume knob turning. Measured: gain 0.07 → 0.90
while the lowpass opens 985Hz → 5197Hz.

**Two recordings, not one.** The pre-pop swell is a mid-level murmur; the return
is a fuller crowd. Coming back out of the silence then reads as the room getting
bigger rather than the same loop turned up.

### The one thing audio cannot do

Browsers will not start audio from a scroll, and the first click in this design
is the pop. So whether the pre-pop swell plays at all depends on the reader
having touched something first — `lib/sound-unlock.ts` takes whichever gesture
arrives first, and there is no gate in the UI.

On a phone that is nearly always a tap. On a desktop, where the likeliest first
interaction is a scroll that unlocks nothing, a reader whose only interaction is
the pop click gets the silence and the pop, and the crowd for the title. That is
a browser rule rather than a choice; if it turns out to matter, the fix is one
small visible affordance before the balloon, not a change in `sound-unlock.ts`.

Muted means no `AudioContext` is created at all, rather than one sitting silent.

### The crowd audio itself

Real recordings, not synthesis. A crowd is thousands of overlapping voices, and
bandpassed noise gets you the shape of one but not the grain — and the grain is
most of why a stadium sounds like a stadium. The pop stays synthesised, because
a pop genuinely is two layers.

- `scripts/fetch-audio.mjs` pulls two files from the USC Cinema / Sunset
  Editorial collection on the Internet Archive, **CC0 1.0** — no attribution, no
  restriction. Not committed; the fetch script is the record of where they came
  from.
- `scripts/encode-audio.mjs` cuts a steady segment from each (chosen by measuring
  the RMS envelope, to stay off the tape's head and tail) and builds a seamless
  loop by crossfading the tail into the head.
- Mono AAC, 80kbps, 16s each: **165KB apiece, 329KB for both**, 9% of the page.

The seams were checked rather than assumed — a hard cut on a diffuse crowd is a
click every sixteen seconds. The largest sample-to-sample step at the wrap
(1073, 1563) measures *below* the file's typical step (1302, 1427).

## The timeline

Sits between the title and the letter. The letter is the emotional peak, so the
timeline goes *before* it — that way the letter is the arrival and the ending
rather than the midpoint.

Six beats, declared in `content/years.ts`. **The copy is placeholder**; the
colour journey and the media contract are real.

### A beat is a scene, not a card

Each beat is a nine-stage sequence scrubbed by scroll, declared once as a table
in `lib/timeline-scroll.ts` and shared by everything that has to stay in step.
One unit of timeline time is one screen of scroll, so a stage's position in the
animation and its position on the page are the same number.

| # | stage | what happens |
|---|---|---|
| 0 | `travel` | the track slides to this beat, the figure is at full strength, the colour drips in |
| 1 | `title` | the beat's title grows out of the middle of the frame |
| 2 | `curtain` | a slab of ink crosses the screen, title leaving under it and the year revealed behind it |
| 3 | `year` | the year, alone |
| 4 | `yearOut` | the year leaves sideways |
| 5 | `turn` | the one sentence that is the beat, in the middle |
| 6 | `quads` | four photographs arrive from the sides into the four corners |
| 7 | `hero` | the clip pushes out of the middle; the turn recedes, the photographs dim |
| 8 | `full` | the image takes the whole screen — every other layer is gone |

The stage costs are deliberately uneven: the two a reader has to read get most
of the scroll, the two that are pure choreography get very little. A beat is
about 3.9 screens, so the timeline is ~23 screens and the document ~30.

**The age is not printed anywhere in a beat.** The rail carries the ages
continuously and highlights the active one; putting `ages 5–9` under the year
turned the moment into a label. The ages still drive the figure's growth, they
just aren't type.

### The parts that had to escape the track

Three things cannot live inside the horizontally scrolling track, and each was
found by it visibly failing rather than by reasoning:

- **The takeover.** A `position: fixed` overlay under a transformed ancestor is
  anchored to *that ancestor*, so a full-screen takeover built inside the track
  slides sideways with the panels and vanishes under the track's mask. It is a
  sibling of the track, and it is handed the hero's live rect on entry, so the
  two are the same pixels at the moment of handover and the growth reads as one
  continuous image. It holds full screen across the next beat's travel and lifts
  over the last of it — which is what stops the transition between beats from
  being visible as a slide of full-screen panels.
- **The curtain**, for a different reason: the track carries
  `will-change: transform`, which makes it a stacking context, so the ink's
  `z-30` was scoped to the track and could never rise above the rail or the
  signature. The wipe swept the photographs and left the chrome floating on top
  of it. It is a sibling of the track too.
- **The figure**, which gave up its column. It was a column so panels could sit
  clear of it, which left the scenes 74% of the screen to be centred in — and
  every composition in a beat is a centred one. Full-width panels make the
  travel a clean carousel, make the handover exact, and let the figure keep
  growing as a full-bleed watermark behind everything.

### Measuring position under a pin

Nothing in the timeline may use `section.getBoundingClientRect().top + scrollY`.
That is only right while the section is *not* pinned, and this section is pinned
for the whole timeline: ScrollTrigger holds it at the top of the viewport, so its
rect top is `0` and adding `scrollY` returns wherever the reader currently is.
Every range derived from it slides with the scroll — a trigger's start moves
every frame and never settles. `sectionTop` reads the pin-spacer instead, which
is an ordinary block in normal flow and never moves.

Two related traps, both of which cost a stage or a beat:

- A timeline's duration is wherever its last tween happens to end, which is
  usually short of the range it is scrubbed across. ScrollTrigger then stretches
  it to fit and every tween lands proportionally early. Each timeline is padded
  to its full length so one unit stays one screen.
- An absolute offset is not a duration. Using a beat's end *position* as the
  length of its trigger gave one beat a range of 11.7 screens instead of 3.9,
  which pushed the year, the turn, the photographs and the hero past the point
  the reader could reach.

### What the beats have in common

- **Horizontal, with a dwell.** Vertical scroll becomes horizontal travel inside
  a pinned frame, so the gesture stays vertical — which is what makes this work
  on a phone. But the track *stops* for most of a beat, so a composition can
  stand still in the middle of the frame, and only moves during the opening
  travel. A single even tween across the pin would slide the panels continuously
  underneath a scene that is supposed to be standing still.
- **A figure that grows.** Head-to-height runs from about a quarter at birth to
  about a seventh at nineteen, with the neck appearing around five. Continuous
  under scrub, not six states.
- **A colour journey.** Hue travels cool to warm and lands on the same rose the
  intro and the letter use, so the page's colour arc resolves where the love
  letter arrives. The takeover inherits `--timeline-bg`, so the journey carries
  on behind the full-screen image rather than stopping dead. All six backgrounds
  are light, which is why one ink colour serves the whole timeline — asserted
  at AAA in the tests.
- **A liquid drip** between beats, with beads running ahead of the front. It is
  procedural rather than a MorphSVG tween: a pure function of progress is
  cheaper per frame than point-matching, gives direct control over where the
  beads sit, and cannot drift out of register with the scroll.
- **Duotone per beat**, each ramp derived from that beat's own colour, so
  background, photographs and video all shift together. One beat — the present —
  stays in full colour, which is what marks the move from her past to now.

### The rail

The ages along the top, and a dot that says where she has got to.

The dot was moved with `translateX(progress * 100%)` — a percentage of *its own
seven pixels* — so it crawled seven pixels across the entire timeline and read
as broken. It is positioned with `left` now, and three things had to line up:

- The track is inset by half a column (100/12) at each end, so its `0%` and
  `100%` land on the *centres* of the first and last age rather than on the ends
  of the line.
- The position divides by `count - 1`, not `count`. Six labels have five gaps
  between them, so their centres sit at 0%, 20%, 40%…100% of the track.
- The split clamps to `count - 1` *before* taking `active` and `within`. At the
  end of the timeline `exact` reaches `count`, and pulling `active` back left
  `within` at 1, which threw the dot a whole column past the final age.

The dot and the highlighted label come from the same number, so arriving at a
beat puts the dot on that beat's age exactly — asserted to within 2px at every
boundary, on both viewports.

### Tests

Each stage boundary has a test, and they read the geometry the scene publishes
about itself (`data-scene-start`, `data-stage-keys`, `data-stage-offsets`) rather
than carrying their own copy of the stage table. Two of them are worth calling
out because they are the ones that would have caught the bugs above: the order
the stages first appear in, and that only one takeover is ever on screen.

### Timeline media

Nothing is committed. Real photos and clips are far too large, and the
processed output is rebuilt from them.

```
content/media/  →  optimise/encode  →  public/photos/ + public/videos/
  (gitignored)      (build step)          (what ships)
```

Drop files in by the convention in `content/years.ts` — `y3-b.jpg`, `y5-v.mp4`
— and `npm run build` picks them up. All three scripts skip any output older
than its source, so iterating on the site does not re-pay several minutes of
x264 every time.

`npm run media:placeholders` fabricates a full set so the pipeline is exercised
before real assets exist. The placeholder clip sizes are **not** a payload
forecast — a smooth gradient is trivially compressible and real home footage is
not. Plan against roughly 3.6MB on mobile and 9MB on desktop for real
eight-second clips, and treat `startSec` / `endSec` as editorial: trimming is
the lever on all of it.

### The years, after the title

Once "Happy" and "19th" have parted, the words fade across the last of the
spread and the span of the whole timeline blooms in behind them: `blur(14px)` to
sharp, scaled from 0.92, faded up, all scrubbed from the centre.

A blur rather than a plain fade, because at that size a fade reads as a caption
appearing and a blur reads as something coming into focus.

The words clear *first*, and that is not only compositional. At full spread the
gap between them is **463px on a desktop and 96px on a phone** — one short line
and nothing more. Anything meant to sit between them is clipped on the device
this site is most likely read on, so the middle has to be genuinely empty first.

This is why `STAGE.pinnedEnd` moved from 3.2 to 4.0 and `trackVh` from 4.2 to
5.0. The intro gained 0.8 screens; the document is ~30 screens in total now.

### After the balloon is gone

The balloon pops once and never returns. That leaves the first 1.25 screens of
the stage empty for the rest of the session — invisible on the way down,
because the balloon fills it, and a blank ~1.2 screens the moment the reader
scrolls back up. `Reprise.tsx` fills that with a small, quiet "Happy 19th" in
the body serif, mounted only once the burst has happened, handing over to the
real heading across exactly the range that heading arrives over.

### Why one section

The balloon and the title used to be two separate sticky sections. That cannot
work without a gap: the void between two sticky sections is always exactly one
viewport tall — the height of the first frame un-pinning. It left 1280px of
nothing to scroll after the pop, and a hole above the title on the way back up.

### Decisions worth knowing before editing

**`sticky`, not ScrollTrigger's `pin`.** `pin` injects a spacer element, which
reflows when webfonts land mid-scrub. `sticky` does not.

**Both centred elements are pinned to grid cell `1 / 1`.** With
`place-items-center` and no explicit rows, each child takes its own implicit row,
and the heading's height pushes the balloon up out of frame.

**`TitleSpread` finds the stage with `closest(".track-stage")`, not a passed-in
ref.** A child's layout effect runs *before* the ancestor's ref is attached, so
an injected ref is still null and every trigger silently does nothing.

**`at()` returns an absolute pixel number, not a `"+=n"` offset.** An offset
string on `start` resolves against the trigger's natural position, and when that
does not land where you expect the trigger reads as already complete — leaving
its tween at the end state instead of the start state.

**Never share one ScrollTrigger config object between two triggers.** ScrollTrigger
mutates the config it is handed; the second trigger overwrites the first's cached
geometry.

**The spread measures with `offsetLeft`/`offsetWidth`,** never
`getBoundingClientRect()`. The heading is scaled as it arrives, so any rendered
measurement changes mid-flight and throws the destination past the viewport edge.

**The lock never touches `overflow`.** Setting `overflow: hidden` on the root also
changes the document's scrollport, which re-resolves every sticky frame — the
balloon jumps off screen the moment the lock lands. Instead: Lenis refuses the
input, `touchmove` is swallowed (iOS otherwise finishes a momentum scroll already
in flight), and the scrollbar is hidden so there is nothing left to drag.

**The pop auto-advances with `autoKill: true`.** It glides the reader to the
title rather than leaving them to find it, and any real scroll cancels it.

**Motion is always on.** Reduced-motion support was removed: it needed a
`data-motion` attribute on `<html>`, which cannot be managed from an inline script
without a React hydration mismatch, and the reader can override the OS setting
here anyway. Restoring it means `gsap.matchMedia()` in `IntroStage`,
`TitleSpread` and `Letter`, plus a media query in `globals.css` — with no
hydration cost that way.

**The dim behind the balloon is a vignette, not a blur.** A full-viewport
`backdrop-filter` re-composited on every scroll frame costs real frames on a
phone.

**Hidden animation states are set from JS, not CSS.** `useGSAP` uses a layout
effect, so the start state lands before paint. Putting it in CSS instead would
leave the letter invisible if the JS bundle failed — the letter is the one thing
on this site that must never be missing.

**SplitText is scoped to the letter.** The title uses two hand-written spans;
SplitText exists for the per-line word stagger, and the rewrite emits `<div>`s
(the line keeps its own `aria-label`, fragments are `aria-hidden`).

## Adding the next section

Drop a component in `components/` and add it to the tree in
`components/intro/Intro.tsx`. Nothing in the intro needs to change.

Content belongs in `content/` as typed data, not in the components.

## Deploying

Static export, so there is **no adapter**. Cloudflare's Next.js guidance points at
`vinext`, but that is for Next's *runtime* on Workers — a static export has none.
`next build` produces a flat `out/`, and Workers Static Assets serves it as-is.

Config is `wrangler.jsonc`: assets only, no `main`, no bindings. Requests to
static assets are **free and unlimited**, with no storage cost.

```bash
npx wrangler login     # one-time, opens a browser
npm run deploy:dry     # validate config, upload nothing
npm run deploy         # build, then publish
```

Live at <https://ankhi-19.dsjzcjmsh6.workers.dev>.

To attach a domain, add to `wrangler.jsonc`:

```jsonc
"routes": [{ "pattern": "yourdomain.com", "custom_domain": true }]
```

The domain must already be a zone on the same Cloudflare account. Cloudflare
creates the DNS records and issues the certificate itself.

`assets.not_found_handling: "404-page"` makes Workers serve `out/404.html` with
a real 404 status, which `app/not-found.tsx` supplies. `html_handling` is left at
its default, `auto-trailing-slash`, which already matches `trailingSlash: true`.

### Caching

`public/_headers` ships as `out/_headers` and Workers applies it at deploy time.
Without it, hashed assets under `/_next/static/` are served as
`max-age=0, must-revalidate`, so every returning visitor revalidates and
re-downloads the whole ~1.2MB of JS, CSS and fonts. Those filenames contain a
content hash, so they get `max-age=31536000, immutable`. HTML keeps the default,
which is what you want for a document that changes.

A test asserts that file is present, because losing it would not error — it would
just quietly get slower.

### npm 12 and install scripts

`package.json` has an `allowScripts` field. npm 12 blocks install scripts by
default; `unrs-resolver` (ESLint's native resolver), `esbuild`, `fsevents` and
`workerd` (Cloudflare's own runtime) are approved by exact version. Approve
additions with `npm install-scripts approve <pkg>` rather than relaxing it.


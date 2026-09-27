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

### The score

From the balloon appearing through to the letter, with a silence in the middle.
Three events, all scheduled against the audio clock rather than with timers:

```
slot 1 → 0 over 120ms
playPop at +130ms
slot 2 swells back over 900ms, landing as the title arrives
```

A `setTimeout` between two audio events drifts by however long the main thread
was busy, and a pop that lands early — on the music's tail — does not land at
all. This is the reason everything takes absolute times rather than durations.

Slot one rides the balloon: its level follows the growth scrub, so it rises with
the thing it is attached to. `track` rather than `ramp`, because it is driven
every frame and a ramp restarted each frame would lag behind the balloon.

### The order

Nine moments, eight tracks. **Beat 6 and the letter share one recording**, played
straight through with no crossfade at all — "I will remain yours" is a promise
and the letter is a promise, so the last thing heard as the site ends is the song
that played for the nineteenth year.

| # | moment | slot |
|---|---|---|
| 1 | balloon, 0 → 1.25vh | `intro` |
| 2 | the pop's aftermath, 1.5 → 2.85vh | `return` |
| 3–8 | the six beats, 2007 · 2012 · 2017 · 2020 · 2023 · 2026 | `beat-0` … `beat-5` |
| — | the letter | *continues `beat-5`* |

The track changes on a beat's **travel** stage, while the previous beat's scene
is still on screen, so it is a crossfade and the reader is never silent between
years.

### The manifest

`content/music.ts` is the only place a track is named: slot, file, in-point,
out-point, gain. `encode-music.mjs` reads it to cut the files and `lib/music.ts`
reads it to play them, so there is no second copy of these numbers.

**How the windows were chosen.** Loudness envelope and percussive density,
sampled per second, which reliably separates a verse from a chorus even on a
heavily compressed master. The busiest sixty seconds of a pop track is almost
always the last chorus, so most slots deliberately avoid it — slot one wants the
*build* at the top of the track, not its climax.

What those measurements cannot tell you is whether a window starts on a musical
thought. If a slot sounds wrong, move `inSec` and rebuild: it is one number in
one file.

### Cutting them

`npm run media:music`, four things, all because these are pop masters rather
than something produced for this:

1. **Trimmed** to the window. A beat is 30–40s of reading; shipping three-minute
   tracks would be most of ten megabytes of music for no reason.
2. **Faded** 1.5s at both ends, so a crossfade into a waveform that starts at
   full scale cannot click.
3. **Normalised** to −16 LUFS, peak −1.5 dBTP. These masters measure −7 to −9,
   which is about six decibels above what music under a page of text should be.
4. **Clamped** to the source's real duration, so a window that overruns a short
   file ships a shorter clip instead of failing the build.

It also clears anything in the output it did not produce. The output directory
had 329KB of the retired crowd beds sitting in it — gitignored, so invisible in
`git status`, and still shipping.

### What it costs

615 seconds of music, about **6.2MB**, which is two thirds of the site. It is
loaded one slot at a time and the first paint does not wait for any of it, so
the number that matters on arrival is 3.8MB — the site without music — plus the
opening track.

### Loading, and loading nothing

Slots are fetched and decoded on demand, and the next beat's is preloaded as the
current one starts. A beat is 30–40s of reading, far more than a few hundred
kilobytes takes.

The encoder also publishes `public/audio/manifest.json` listing what it actually
cut. The score reads that before asking for anything, so a project with no music
in it requests **one** file and logs no 404s. Without it the site asked for all
eight slots and logged a 404 for each on every visit, which makes a deliberately
quiet site look broken.

### The one thing audio cannot do

Browsers will not start audio from a scroll, and the first click in this design
is the pop. So whether anything plays before the pop depends on the reader having
touched something first — `lib/sound-unlock.ts` takes whichever gesture arrives
first, and there is no gate in the UI.

On a phone that is nearly always a tap. On a desktop, where the likeliest first
interaction is a scroll that unlocks nothing, a reader whose only interaction is
the pop click gets the silence and the pop, and the music for the title.

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
| 0 | `travel` | the track slides to this beat and the colour drips in |
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
turned the moment into a label. They are still data — the rail reads them — they
just aren't type on the beat itself.

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

The **extension has to be `.jpg`**, not `.jpeg`, for a photograph.
`media:placeholders` skips a photo only when `y3-b.jpg` already exists, and
`media:images` derives its output id by stripping whatever extension it finds —
so a real `y3-b.jpeg` sitting beside a leftover `y3-b.jpg` would give two
sources the same output name, and `readdir` order would decide which one wins.
The placeholder would win.

The twenty-four photographs are the real ones now. `content/years.ts` carries a
description of each and the intrinsic size of the **1200px rendition**, which
is what actually ships — not the size of the source file. Those are different
numbers for all twenty-four, and declaring the source size makes the browser
reserve a box with the wrong aspect ratio before the bytes arrive.

Every one of the twenty-four is portrait, where the placeholders had all been
3:2 landscape. The corner boxes are near-square (`min(26vmin, 25vw)` by
`min(34vmin, 27vh)`) and fill with `object-cover`, so a portrait photograph
keeps its full width and is cropped top and bottom, centred. Most survive at
about 78% of their height; `y6-b` is 9:19 and keeps 43%, `y3-b` and `y5-c` keep
58%. That is a crop, not a resize, so it is lossless and reversible — but it
does mean those three are showing a band rather than a whole frame.

`npm run media:placeholders` fabricates a full set so the pipeline is exercised
before real assets exist. It is a no-op for the photographs now, since all
twenty-four names are taken. The placeholder clip sizes are **not** a payload
forecast — a smooth gradient is trivially compressible and real home footage is
not. Plan against roughly 3.6MB on mobile and 9MB on desktop for real
eight-second clips, and treat `startSec` / `endSec` as editorial: trimming is
the lever on all of it.

### The photograph, and then the years

The middle of the intro frame is one grid cell, and three things want it: the
title, a photograph of the two of them, and the span of the years. They are
strictly sequential, and the order is `wordsOut 2.7 → wordsClear 3.0` for the
words, `photoIn 3.0 → photoSettled 3.25 → revealIn 3.45` for the photograph, and
`revealIn 3.45 → revealEnd 4.0` for the years.

The photograph crossfaded in against the departing words at first. It looked
right on a desktop and put "Happy" straight across the middle of the picture on
a phone, because the parted words leave only 96px of gap there — there is no
width in which both being half-opaque reads as a transition rather than a
collision. `revealIn` moving from 3.0 to 3.45 is what buys the photograph a
window; the years still bloom and still hold through the un-pin, so the frame
lost nothing. The test asserts the mutual exclusion rather than the timings,
because the timings are what someone would retune.

Both the photograph and the years arrive the same way — `blur(14px)` to sharp,
scaled from 0.92 — since they are two arrivals in the same cell and should look
like the same kind of arrival. The photograph is `h-[min(70svh,72vw)]`: the
`svh` half stops it outgrowing the sticky viewport and being clipped by
`overflow: clip`, the `vw` half stops it running off the sides on a narrow one.

Its exit is a `fromTo` rather than a `to` on purpose. With a plain `to`, GSAP
reads the start value off the element the first time the tween renders, so a
reader who scrolls fast lands with the entry tween never having run, `autoAlpha`
still 0, and the exit animating 0 to 0 — the photograph simply never appears.

`intro-0.jpg` is not a `y<N>-<letter>` timeline photograph and does not live in
`content/years.ts`, but it goes through the same pipeline, because
`optimize-images.mjs` works off whatever is in `content/media/`.

### The years, after the title

Once the photograph has gone, the span of the whole timeline blooms in:
`blur(14px)` to sharp, scaled from 0.92, faded up, all scrubbed from the centre.

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

### The fun page

A gate after the letter, and a page behind it: seven targets on a net, a ball on
the penalty spot, and seven photographs and videos behind them.

`content/fun.ts` is the manifest — deliberately separate from `content/years.ts`,
which is the story. What they share is the media pipeline:
`encode-videos.mjs` now flattens both manifests to `{ id, startSec, endSec }` and
runs one pass, rather than there being two encoders to drift apart. The
fun clips were trimmed to 8 seconds where they were longer.

**The clips are silent.** `-an` strips audio from everything the encoder touches,
which was already true of the timeline clips and is now also true of these four.
The sound in the sources was deliberately not shipped and there is no unmute
control, so the videos can autoplay on a hit — which is the only way they
reliably autoplay at all, and `autoPlay` alone does not do it in WebKit. The
playback is driven from an effect, the same way `Takeover` does it.

**No physics.** The ball follows the pointer and lands where it is released. The
reward is the photographs, and a mechanic that could be failed by flicking too
hard would just be a way of not showing someone their own pictures. Every target
is reachable on the first try, and every target is also a real `<button>` — a
drag-only game is a game half the readers cannot play.

The pitch is a flex column: goal, then the ground flowing from it, with the
penalty area and the spot inside that. An earlier version positioned the ground
with a viewport height and a matching constant for where the posts ended, which
cannot both be right — viewport units are aspect-dependent, so on a phone the
ball ended up outside the penalty area entirely. Flowing it means the join is
structural.

The gate is a real `<a href="/fun/">` with the hold layered on, so it works
without JavaScript and announces as a link. That is also the whole difficulty: a
link's own activation is what a short press triggers, so the click is prevented
unconditionally and navigation happens from the completed hold instead.

### The six beats

No years and no ages. The rail used to carry `0–4`, `5–9` and so on, and a
whole stage per beat printed a four-digit number alone on screen — a quarter of
a screen of scroll per beat, spent on a date. `Beat` is now `id`, `phase`,
`title`, `turn`, `herWords`. `phase` is the short name the rail needs to survive
a sixth of a phone's width; `title` is the long one on the panel. A chapter
marker in the margin and a title on the page, which is what a chapter actually
is.

The two year stages went into `turn`, which is now 1.15 screens instead of 0.6.
The sum is still 3.9, so `SCREENS_PER_BEAT`, the rail geometry and the length of
the document are all unchanged — only what a beat contains has moved.

`herWords` had been declared on the type and present in five of the six beats,
and rendered by nothing at all. It is on screen now, in italic beneath the turn,
arriving in the back half of the stage so the eye finishes one line before the
next starts. That stage finishes both by 70% of its length and holds the last
30%; the first version ran them to 95%, which is about four pixels of scroll with
both lines settled — on screen, and unreadable.

The copy is written in the letter's voice, on purpose. Six panels of
greeting-card sentiment in front of the letter would spend the reader's patience
before the thing it is warming up to arrived.

**The first beat was rendering nothing, and it was this change that did it.**
`herWords` is optional — the first beat has none — so putting `[data-s-words]`
in the guard that bails out of building a scene's timeline meant the first beat
built no timeline at all: no stages, no curtain sweep, and its curtain left
standing in the middle of the page for the entire timeline, because an unrendered
slab has no transform and `translateX(0)` is dead centre at z-40.

Two things had to be true afterwards for that not to come back. The curtain is
`visibility: hidden` in CSS, and the scene sets it visible only for the length of
the sweep, so the ink is on screen if and only if the wipe is running — the
resting state costs one missing wipe rather than an invisible site. And a test
walks every beat's published geometry, because beat 0 was the one beat nobody had
ever asserted, which is exactly why it went unnoticed. The curtain's resting
*transform* is still not reliable across beats; visibility is what is painted, and
that is what the tests now check.

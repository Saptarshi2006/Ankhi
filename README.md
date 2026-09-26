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

## How section 1 works

Six phases, driven by a scroll position rather than by time.

| Phase | What happens |
| --- | --- |
| A | Balloon grows from `scale(0.12)` toward the viewer, scrubbing over a 160vh track |
| B | At full size the scroll **locks** and a prompt appears |
| C | Click or any key pops it — canvas burst, synthesised pop, lock released |
| D | "Happy 19th" arrives at centre |
| E | The two words travel to opposite edges, hold, then fade as the letter starts |
| F | Twelve lines reveal one at a time |

State lives in one place, `components/intro/Intro.tsx`, as
`approach → armed → popping → letter`. Everything else takes props off that.

### Decisions worth knowing before editing

**`sticky`, not ScrollTrigger's `pin`.** The tracks are tall sections holding a
`position: sticky` viewport. `pin` injects a spacer element, which reflows when
webfonts land mid-scrub. `sticky` does not.

**Growth ends 1.4 screens in, not at `bottom bottom`.** The section is 300vh, so
the sticky frame stays pinned for 200vh of scrolling. Tying the end to the
section's own edges completes growth at the exact instant sticky releases — the
balloon hits full size as the frame flies away, so by the time the scroll locks
it is off the top of the screen and the reader is looking at blank space. The
remaining 0.6 screens are the held, poppable shot.

**The lock never touches `overflow`.** Setting `overflow: hidden` on the root
does stop the reader scrolling, but it also changes the document's scrollport,
which re-resolves every sticky frame — the balloon jumped off screen at the
exact moment the lock landed. Instead: Lenis refuses the input, `touchmove` is
swallowed (iOS otherwise finishes a momentum scroll already in flight), and the
scrollbar is hidden so there is nothing left to drag.

**Never share one ScrollTrigger config object between two triggers.** ScrollTrigger
mutates the config it is handed; the second trigger overwrites the first's cached
geometry. `growth()` in `BalloonStage.tsx` is a factory for this reason.

**The spread measures with `offsetLeft`/`offsetWidth`,** never
`getBoundingClientRect()`. The heading is scaled as it arrives, so any rendered
measurement changes mid-flight and throws the destination past the viewport edge.

**The balloon is three nested elements.** `scrollRef` takes the scrub,
`idleRef` takes a permanent idle bob and the armed pulse, `stringRef` takes a
slower pendulum. Collapsing any two would put two tweens on one property.

**The lock is three things.** `lenis.stop()`, a `touchmove` guard, and a hidden
scrollbar. See the note above on why not `overflow: hidden`.

**The dimming behind the balloon is a vignette, not a blur.** A full-viewport
`backdrop-filter` re-composited on every scroll frame is the one effect here
that would actually cost frames on a phone.

**Hidden animation states are set from JS, not CSS.** `useGSAP` uses a layout
effect, so the start state lands before paint. Putting it in CSS instead would
leave the letter invisible if the JS bundle failed — the letter is the one
thing on this site that must never be missing.

**SplitText is scoped to the letter.** The title uses two hand-written spans;
SplitText exists for the per-line word stagger, and the rewrite emits `<div>`s
(the line keeps its own `aria-label`, fragments are `aria-hidden`).

**Reduced motion is a real path, not a degradation.** The tracks collapse, the
balloon becomes static decoration, the title sits centred and the letter renders
straight away. No lock, no click required.

## Adding the next section

Drop a component in `components/` and add it to the tree in
`components/intro/Intro.tsx`. Nothing in the intro needs to change.

Content belongs in `content/` as typed data, not in the components.

## Deploying

Not set up yet. Intentionally — this is a static export, so it needs no adapter:

```jsonc
// wrangler.jsonc
{
  "name": "ankhi-19",
  "compatibility_date": "2026-09-26",
  "assets": { "directory": "./out" },
  "routes": [{ "pattern": "yourdomain.com", "custom_domain": true }]
}
```

`npm run build && npx wrangler deploy`. The domain has to be a zone on the same
Cloudflare account. Cloudflare's docs point Next.js at `vinext`, but that is for
Next's *runtime*; a static export does not need it.

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

Everything lives in **one** section with one sticky viewport. Both the balloon
and the heading share the frame, so it is never empty while pinned.

| Range (vh) | Phase |
| --- | --- |
| `0 → 1.25` | Balloon grows from `scale(0.34)` toward the viewer. Scroll locks at the end. |
| `1.25 → 1.5` | Pop. Canvas burst, synthesised pop, lock released, page glides to the title. |
| `1.5 → 1.7` | "Happy 19th" fades in at centre. |
| `1.7 → 2.7` | The two words travel to opposite edges and hold. |
| `2.7 → 3.2` | They hold while the frame is still pinned. |
| `3.2 → 4.2` | They fade as the frame scrolls away into the letter. |

Those numbers are constants in `lib/stage-ranges.ts`, in viewport heights so they
behave the same on a phone and a desktop. The track height in `globals.css`
(`--track-stage`) must stay equal to `STAGE.trackVh × 100vh`.

State lives in `components/intro/Intro.tsx` as
`approach → armed → popping → settled`. Everything else takes props off that.

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

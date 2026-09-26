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
| `1.5 → 1.7` | "Happy 19th" fades in at centre, crossfading with the reprise. |
| `1.7 → 2.7` | The two words travel to opposite edges and hold. |
| `2.7 → 3.2` | They hold while the frame is still pinned. |
| `3.2 → 4.2` | They fade as the frame scrolls away into the letter. |

Those numbers are constants in `lib/stage-ranges.ts`, in viewport heights so they
behave the same on a phone and a desktop. The track height in `globals.css`
(`--track-stage`) must stay equal to `STAGE.trackVh × 100vh`.

State lives in `components/intro/Intro.tsx` as
`approach → armed → popping → settled`. Everything else takes props off that.

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


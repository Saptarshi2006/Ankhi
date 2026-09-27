import { beats } from "@/content/years";

/**
 * The timeline's scroll geometry, shared so every part of it stays in step.
 *
 * The section is pinned and the vertical scroll is translated into horizontal
 * travel inside it. Vertical scroll, sideways motion — which is the whole
 * reason this works on a phone. A natively sideways-scrolling section would
 * fight the page in portrait, and that was the objection to this layout in the
 * first place.
 *
 * Each beat is a nine-stage scene rather than a single panel that slides past.
 * The stage table below is the single source of truth for how much scroll each
 * beat gets, and every component resolves its scrub position through these
 * helpers, so the track, the scene, the liquid and the takeover cannot drift
 * apart after a resize.
 *
 * Ranges are absolute scroll positions rather than position strings, because
 * `pin` inserts a spacer element: string positions resolve against the
 * element's *document* position, which the spacer changes mid-layout.
 */

/**
 * The stages of one beat, in order, with their scroll cost in screens.
 *
 * The shares are deliberately uneven. The stages a reader has to read (the
 * title, the turn) get most of the scroll; the stages that are pure
 * choreography (the curtain passing, the year leaving) get very little, and
 * would be missed entirely at any more.
 *
 * Reading the table as a sentence: travel in, the title surfaces, a curtain
 * crosses, the year is standing there alone, the year leaves, the turn is
 * spoken, four photographs arrive from the sides, one image pushes out of the
 * middle, and that image takes the whole screen.
 */
export const STAGES = [
  { key: "travel", screens: 0.6 },
  { key: "title", screens: 0.5 },
  { key: "curtain", screens: 0.3 },
  { key: "year", screens: 0.4 },
  { key: "yearOut", screens: 0.15 },
  { key: "turn", screens: 0.6 },
  { key: "quads", screens: 0.5 },
  { key: "hero", screens: 0.4 },
  { key: "full", screens: 0.45 },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];
export type StageIndex = number;

/** Index lookups, so nothing in the app hardcodes a stage position. */
export const STAGE = {
  travel: 0,
  title: 1,
  curtain: 2,
  year: 3,
  yearOut: 4,
  turn: 5,
  quads: 6,
  hero: 7,
  full: 8,
} satisfies Record<StageKey, StageIndex>;

/** Screens of scroll one whole beat occupies. */
export const SCREENS_PER_BEAT = STAGES.reduce((n, s) => n + s.screens, 0);

/** How far the reader travels to cross the whole timeline. */
export function pinDistance(): number {
  return Math.round(beats.length * SCREENS_PER_BEAT * window.innerHeight);
}

/** The pinned section's own width, which is what a beat is as wide as. */
export function beatWidth(): number {
  const section = document.querySelector("[data-timeline]");
  // `clientWidth` rather than `innerWidth`: on desktop the two differ by the
  // scrollbar, and a panel a scrollbar too wide puts every beat's centre
  // slightly off-screen.
  return section?.clientWidth || window.innerWidth;
}

/**
 * The x that brings beat `index` to the centre of the viewport.
 *
 * Panels are exactly one beat wide and contiguous, so this is simply a whole
 * number of viewports. That exactness is what lets a full-screen panel hand
 * over to the next one mid-takeover without a visible jump.
 */
export function beatCentreX(index: number): number {
  return -index * beatWidth();
}

/**
 * Position of a stage within the whole timeline, in screens.
 *
 * This is the timeline's timebase: one unit is one screen of scroll. The
 * master timeline is authored in these units and the scroll trigger is scrubbed
 * across `pinDistance()`, so a stage's position in the timeline and its
 * position in the page are the same number.
 */
export function stageOffset(beatIndex: number, stageIndex: StageIndex): number {
  let t = beatIndex * SCREENS_PER_BEAT;
  for (let i = 0; i < stageIndex; i += 1) t += STAGES[i].screens;
  return t;
}

/** Where a beat ends: the offset just past its last stage. */
export function beatEndOffset(beatIndex: number): number {
  return stageOffset(beatIndex, STAGES.length);
}

/**
 * The pinned section's position in the document.
 *
 * Not `section.getBoundingClientRect().top + scrollY`. That is only correct
 * while the section is *not* pinned, and this section is pinned for the whole
 * of the timeline: ScrollTrigger holds it at the top of the viewport, so its
 * rect top is `0` and adding `scrollY` returns wherever the reader currently
 * is. Every range derived from that slides with the scroll, which means a
 * trigger's start moves every frame and it can never settle — a takeover that
 * is supposed to be long gone stays on screen at full opacity.
 *
 * The pin-spacer is the fix. It is an ordinary block in normal flow, sized to
 * include the pin distance and never transformed, so its document position is
 * the same whether or not the section inside it is currently pinned.
 */
export function sectionTop(section: Element): number {
  const parent = section.parentElement;
  const box = parent?.classList.contains("pin-spacer") ? parent : section;
  return Math.round(box.getBoundingClientRect().top + window.scrollY);
}

/**
 * The absolute scroll range a stage occupies.
 *
 * `stageIndex` may be `STAGES.length`, which addresses the instant the beat
 * ends. That is a real boundary rather than a mistake — it is how a trigger
 * says "this beat, all of it" — so it resolves to a zero-length range at the
 * beat's end rather than reading off the end of the table.
 */
export function stageRange(
  section: Element,
  beatIndex: number,
  stageIndex: StageIndex,
): { start: number; end: number } {
  const top = sectionTop(section);
  const vh = window.innerHeight;
  const a = stageOffset(beatIndex, stageIndex);
  const screens = stageIndex < STAGES.length ? STAGES[stageIndex].screens : 0;
  return {
    start: top + Math.round(a * vh),
    end: top + Math.round((a + screens) * vh),
  };
}

/** The absolute scroll range the pinned section occupies. */
export function sectionRange(section: Element): { start: number; end: number } {
  const top = sectionTop(section);
  return { start: top, end: top + pinDistance() };
}

/** Progress across the whole timeline, 0 → 1. */
export function progressAt(y: number, section: Element): number {
  const { start, end } = sectionRange(section);
  if (end <= start) return 0;
  return Math.min(1, Math.max(0, (y - start) / (end - start)));
}

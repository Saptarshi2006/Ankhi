import { beats } from "@/content/years";

/**
 * The timeline's scroll geometry, shared so every part of it stays in step.
 *
 * The section is pinned and the vertical scroll is translated into horizontal
 * travel inside it. Each component that needs to scrub — the track, the liquid,
 * the figure — builds its own trigger, but all three resolve their range
 * through `sectionRange` so they cannot drift apart after a resize.
 *
 * Ranges are absolute scroll positions rather than position strings, because
 * `pin` inserts a spacer element: string positions resolve against the
 * element's *document* position, which the spacer changes mid-layout.
 */

/** Screens of vertical scroll per beat. Tuned by feel. */
const SCROLL_PER_BEAT = 0.85;

/** How far the reader travels to cross the whole timeline. */
export function pinDistance(): number {
  return Math.round(beats.length * SCROLL_PER_BEAT * window.innerHeight);
}

/**
 * The absolute scroll range the pinned section occupies.
 *
 * `end` is the point at which the last panel is fully in view, so the journey
 * finishes on the final year rather than trailing off it.
 */
export function sectionRange(section: Element): { start: number; end: number } {
  const top = Math.round(section.getBoundingClientRect().top + window.scrollY);
  return { start: top, end: top + pinDistance() };
}

/** Progress across the whole timeline, 0 → 1. */
export function progressAt(y: number, section: Element): number {
  const { start, end } = sectionRange(section);
  if (end <= start) return 0;
  return Math.min(1, Math.max(0, (y - start) / (end - start)));
}

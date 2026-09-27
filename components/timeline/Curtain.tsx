import type { ReactElement } from "react";

/**
 * The sideways wipe between a beat's title and its year.
 *
 * A slab of ink that crosses the screen with a lit leading edge, so it reads as
 * fabric passing rather than a rectangle sliding. The title is on one side of
 * it and the year is revealed on the other.
 *
 * Transient by design. The scene either side of this is the beat's own pale
 * colour, and the ink is never allowed to become a background: a dark wash that
 * lingered would fight every photograph in the beat that followed it.
 *
 * The edge and the tail are children of the slab, not siblings, so a single
 * tween on one element carries all three. They are always in exactly the same
 * place relative to each other, and animating them separately would be three
 * chances to drift apart mid-sweep.
 */
export default function Curtain({ beat }: { beat: number }): ReactElement {
  return (
    /*
     * A sibling of the track, not a child of a panel.
     *
     * Inside the track it was invisible to the rest of the page: the track
     * carries `will-change: transform`, which makes it a stacking context, so
     * the ink's z-30 was scoped to the track subtree and could never rise above
     * the rail or the signature at z-20. The wipe swept the photographs and
     * left the chrome floating on top of it, which is not a curtain.
     *
     * `z-40` clears the rail and the signature and stays under the sound
     * toggle, which is deliberately left reachable throughout — it is a
     * control, not part of the composition.
     */
    <div
      data-curtain
      data-curtain-for={beat}
      aria-hidden="true"
      /*
       * `hidden` by default, and the scene makes it visible only for the length
       * of the sweep.
       *
       * Two things were wrong at once here. The slab is driven by a `paused`
       * timeline, so before that trigger has rendered even once the element has
       * no transform — `translateX(0)`, dead centre, at z-40, a full screen of
       * ink. And when the trigger *did* exist, the state it left the slab in
       * depended on the last tween's end value actually being applied, which it
       * was not: one beat's curtain was still sitting over the middle of the
       * frame during a beat three scenes later.
       *
       * Neither is now load-bearing. Hidden is the resting state, and the
       * position is parked off the left edge, so a curtain that never renders at
       * all costs one missing wipe instead of an invisible site. This is the
       * same reasoning as the pre-blurred poster over a runtime blur: prefer the
       * thing that costs nothing when it is wrong.
       */
      className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
      style={{ visibility: "hidden" }}
    >
      <div
        data-curtain-slab
        /*
         * Parked off the left edge in CSS, not just in the timeline.
         *
         * The slab is driven by a `paused` timeline, so before its trigger has
         * rendered even once the element has no transform at all — which is
         * `translateX(0)`, dead centre, at z-40, covering the entire page. That
         * is what happened to the first beat's curtain: it sat across the whole
         * timeline at `translateX(0)` and no test caught it, because every test
         * looked at opacities of things *underneath* it and a fully opaque slab
         * is trivially easy to stop seeing.
         *
         * With the default here the failure mode is "this beat has no wipe"
         * rather than "the site is invisible", and the tween still takes over the
         * moment the trigger does render.
         */
        className="absolute inset-0 will-change-transform"
        style={{ background: "var(--curtain)", transform: "translateX(-100%)" }}
      >
        {/* Trailing fade, so the slab thins as it leaves rather than ending flat. */}
        <div
          data-curtain-tail
          className="absolute inset-y-0 left-0 w-[24vw]"
          style={{
            background:
              "linear-gradient(to right, color-mix(in oklab, var(--curtain) 78%, transparent), transparent)",
          }}
        />
        {/*
          Leading edge. On the slab's *right*, because the slab enters from the
          left: that is the side facing the direction of travel.
        */}
        <div
          data-curtain-edge
          className="absolute inset-y-0 right-0 w-[12vw]"
          style={{
            background:
              "linear-gradient(to left, transparent, color-mix(in oklab, var(--curtain) 45%, white))",
          }}
        />
      </div>
    </div>
  );
}

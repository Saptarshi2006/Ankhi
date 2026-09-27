"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { site } from "@/content/site";
import { STAGE, at } from "@/lib/stage-ranges";

gsap.registerPlugin(ScrollTrigger);

/**
 * The years, blooming in after the title has parted.
 *
 * The last thing the intro says before the timeline takes over, and the thing
 * that ties the six beats together: 2007 to 2026, the whole span, arriving in
 * the space "Happy" and "19th" left behind.
 *
 * "Blend" rather than "pop": the blur resolves to sharp as the scale opens and
 * the opacity comes up, all from the centre. A fade alone at this size reads as
 * a caption appearing; a blur reads as something coming into focus, which is
 * what the eye expects when a large shape forms out of nothing.
 *
 * `will-change` is deliberately absent. The filter is animated for the whole
 * reveal and then left at `blur(0px)`, and promoting a full-width text layer
 * up front costs a compositor surface for the entire time the intro is on
 * screen.
 */
export default function RevealLine() {
  const lineRef = useRef<HTMLParagraphElement>(null);

  useGSAP(() => {
    /*
     * From our own element rather than an injected section ref: a child's
     * layout effect runs before the ancestor's ref is attached, so a prop would
     * still be null here and every trigger would quietly do nothing.
     */
    const trigger = lineRef.current?.closest<HTMLElement>(".track-stage") ?? null;
    const line = lineRef.current;
    if (!trigger || !line) return;

    const base = { trigger, invalidateOnRefresh: true, scrub: 0.4 } as const;

    gsap.fromTo(
      line,
      { autoAlpha: 0, filter: "blur(14px)", scale: 0.92, y: 14 },
      {
        autoAlpha: 1,
        filter: "blur(0px)",
        scale: 1,
        y: 0,
        ease: "power2.out",
        scrollTrigger: { ...base, start: at(trigger, STAGE.revealIn), end: at(trigger, STAGE.revealEnd) },
      },
    );

    /*
     * Fade across the un-pin tail only. Any earlier and the frame goes empty
     * while it is still pinned, which is the gap this component used to have
     * above it when scrolling back up.
     */
    gsap.to(line, {
      autoAlpha: 0,
      ease: "power1.in",
      scrollTrigger: {
        trigger,
        start: at(trigger, STAGE.pinnedEnd),
        end: "bottom bottom",
        scrub: true,
      },
    });
  });

  return (
    <p
      ref={lineRef}
      aria-hidden="true"
      /*
        The same `col-start-1 row-start-1` cell as the heading, so it lands
        exactly where the heading was rather than somewhere approximate. The
        heading is at zero opacity by the time this appears, so they never
        overlap. Absolutely positioning it instead would have put it on top of
        the click prompt, which lives at `bottom-[16vh]`.
      */
      className="pointer-events-none col-start-1 row-start-1 text-center font-display text-[clamp(1.1rem,3.4vw,2.3rem)] leading-none tracking-[0.16em] text-ink-muted"
      style={{ transformOrigin: "50% 50%" }}
    >
      {site.spanFrom}
      <span className="mx-[0.5em] opacity-60">—</span>
      {site.spanTo}
    </p>
  );
}

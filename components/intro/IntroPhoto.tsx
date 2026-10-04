"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { site } from "@/content/site";
import { STAGE, at } from "@/lib/stage-ranges";

gsap.registerPlugin(ScrollTrigger);

/**
 * The two of them, in the middle of the title.
 *
 * "Happy" and "19th" arrive together in the centre of the frame and then travel
 * out to opposite edges, which empties the middle. This fills it: the photograph
 * is what the title was covering, uncovered as the words part.
 *
 * It is here for the title and then it is gone — it clears across the same range
 * the words clear in, so it is never on screen at the same time as the years.
 * Two large things blooming into the same cell one after the other reads as a
 * queue; this is a title, a photograph, and a span of years, in that order, and
 * only one of them is ever mid-frame.
 *
 * The blend is the same vocabulary `RevealLine` uses — blur resolving to sharp as
 * the scale opens — because both are arriving in the same cell and they should
 * look like the same kind of arrival. A hard cut between the two would read as
 * two unrelated things rather than one sequence.
 *
 * Everything is scrubbed rather than triggered, so scrolling back up reverses
 * it exactly: the words come back together and the photograph goes back behind
 * them. `autoAlpha` rather than `opacity` so the faded-out state also stops the
 * image being painted at all — otherwise it sits in the frame for the rest of
 * the intro, invisible, still composited.
 *
 * **Full screen, and the whole photograph inside it.** The frame is
 * `absolute inset-0`, not the `col-start-1 row-start-1` grid cell it used to sit
 * in, because `place-items-center` does not stretch a grid item and so "fill the
 * frame" was never something that cell would give. `.sticky-viewport` is
 * `position: sticky`, so it is the containing block and `inset-0` covers the
 * viewport exactly.
 *
 * The photograph is `object-contain` over a blurred copy of itself filling the
 * rest. The alternative was cropping to cover, which is what this did first: a
 * 3:4 portrait in a landscape frame throws away more than half the picture, and
 * on a photograph of two people that is not a cost worth paying. This fills the
 * frame the same way and loses nothing.
 *
 * The backdrop is a pre-blurred file written by `optimize-images.mjs`, not a CSS
 * `filter: blur()` on a second copy of the image. A full-viewport blur is
 * recomputed by the compositor for as long as it is on screen, and that is the
 * one effect on this site that costs frames outright on a phone. Pre-blurring it
 * at build time means the backdrop costs nothing to paint.
 */
export default function IntroPhoto() {
  const frameRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    /*
     * From our own element rather than an injected section ref, for the same
     * reason `TitleSpread` and `RevealLine` do it: a child's layout effect runs
     * before the ancestor's ref is attached, so a prop would still be null and
     * every trigger would quietly do nothing.
     */
    const trigger = frameRef.current?.closest<HTMLElement>(".track-stage") ?? null;
    const frame = frameRef.current;
    if (!trigger || !frame) return;

    const base = { trigger, invalidateOnRefresh: true, scrub: 0.4 } as const;

    // Arrives as the words leave, reaching full strength only once they are
    // nearly gone. Earlier than this and the card is at full opacity while the
    // words are still at theirs, which on a phone puts "Happy" straight across
    // the middle of the photograph.
    gsap.fromTo(
      frame,
      { autoAlpha: 0, filter: "blur(14px)", scale: 0.92 },
      {
        autoAlpha: 1,
        filter: "blur(0px)",
        scale: 1,
        ease: "power2.out",
        scrollTrigger: { ...base, start: at(trigger, STAGE.photoIn), end: at(trigger, STAGE.photoSettled) },
      },
    );

    /*
     * Gone by the time the years begin. `revealIn` is the shared boundary: the
     * photograph has finished leaving at the exact scroll position where the
     * years start arriving, so the two can never both be on screen.
     *
     * A `fromTo`, not a `to`, and the reason is specific rather than stylistic.
     * With a plain `to` GSAP reads the start value off the element the first
     * time the tween renders, so a reader who scrolls fast — or a jump straight
     * past `photoSettled` — lands with the entry tween never having run,
     * `autoAlpha` still 0, and the exit faithfully animating 0 to 0. The
     * photograph simply never appears. Declaring both ends makes it independent
     * of what order the triggers happen to render in.
     */
    gsap.fromTo(
      frame,
      { autoAlpha: 1, scale: 1 },
      {
        autoAlpha: 0,
        scale: 1.04,
        ease: "power1.in",
        immediateRender: false,
        scrollTrigger: { ...base, start: at(trigger, STAGE.photoSettled), end: at(trigger, STAGE.revealIn) },
      },
    );
  });

  return (
    <div
      ref={frameRef}
      data-intro-photo
      className="pointer-events-none absolute inset-0"
      style={{ transformOrigin: "50% 50%" }}
    >
      <img
        src={`/photos/${site.introPhoto.id}-bg.webp`}
        alt=""
        aria-hidden="true"
        data-intro-backdrop
        className="absolute inset-0 h-full w-full object-cover blur-xl"
        style={{ transform: "scale(1.1)" }}
        loading="eager"
        decoding="async"
      />
      <img
        src={`/photos/${site.introPhoto.id}-1200.webp`}
        alt={site.introPhoto.alt}
        width={site.introPhoto.width}
        height={site.introPhoto.height}
        data-intro-image
        /*
          `h-full w-full object-contain`: the element fills the frame and the
          photograph is fitted *inside* it, unscaled-in-place. Not `h-full
          w-auto`, which pins the height and then letterboxes the width — the
          element box ends up the frame's proportions while the picture inside is
          correct, which is a confusing thing to assert against later.
        */
        className="relative h-full w-full object-contain"
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
    </div>
  );
}

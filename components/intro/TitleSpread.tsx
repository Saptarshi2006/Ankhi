"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { site } from "@/content/site";
import { STAGE, at } from "@/lib/stage-ranges";

gsap.registerPlugin(ScrollTrigger);

/**
 * Phases D–E: "Happy 19th" arrives, splits, travels to opposite edges, holds,
 * then fades as the frame scrolls away.
 *
 * Renders inside the stage's sticky viewport, so it shares a frame with the
 * balloon and the frame is never empty while pinned.
 *
 * Three separate triggers rather than one timeline, because the phases are
 * absolute ranges within a long stage and a timeline can only carry one
 * scrollTrigger.
 */
export default function TitleSpread() {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const leftRef = useRef<HTMLSpanElement>(null);
  const rightRef = useRef<HTMLSpanElement>(null);

  useGSAP(() => {
    /*
     * Derive the stage from our own element rather than taking the section ref
     * as a prop. A child's layout effect runs *before* the ancestor's ref is
     * attached, so an injected ref is still null at this point and every
     * trigger would silently fall back to doing nothing.
     */
    const trigger = titleRef.current?.closest<HTMLElement>(".track-stage") ?? null;
    if (!trigger) return;

    /**
     * How far each word must travel to sit against its edge.
     *
     * Derived from `offsetLeft` / `offsetWidth` on purpose. Those are layout
     * coordinates and are immune to transforms, and the heading is scaled as
     * it arrives — so measuring with `getBoundingClientRect()` reads a value
     * that changes mid-flight and throws the destination past the viewport
     * edge.
     *
     * The heading is centred, so its untransformed left edge is
     * `(viewport - headingWidth) / 2`, and by the time the spread runs the
     * scale has settled to 1. That makes the arithmetic exact.
     */
    const travelTo = (el: HTMLSpanElement | null, edge: "left" | "right") => () => {
      const title = titleRef.current;
      if (!el || !title) return 0;
      const pad = window.innerWidth < 640 ? 20 : 48;
      const titleLeft = (window.innerWidth - title.offsetWidth) / 2;
      return edge === "left"
        ? pad - (titleLeft + el.offsetLeft)
        : window.innerWidth - pad - (titleLeft + el.offsetLeft + el.offsetWidth);
    };

    const base = { trigger, invalidateOnRefresh: true };

    // D — arrival.
    gsap.fromTo(
      titleRef.current,
      { scale: 0.62, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        ease: "power2.out",
        scrollTrigger: {
          ...base,
          start: at(trigger, STAGE.titleIn),
          end: at(trigger, STAGE.titleInEnd),
          scrub: 0.4,
        },
      },
    );

    // E — spread to the edges, with a slight outward tilt.
    gsap.to(
      leftRef.current,
      {
        x: travelTo(leftRef.current, "left"),
        rotate: -5,
        ease: "power2.inOut",
        scrollTrigger: {
          ...base,
          start: at(trigger, STAGE.titleInEnd),
          end: at(trigger, STAGE.spreadEnd),
          scrub: 0.5,
        },
      },
    );

    gsap.to(
      rightRef.current,
      {
        x: travelTo(rightRef.current, "right"),
        rotate: 5,
        ease: "power2.inOut",
        scrollTrigger: {
          ...base,
          start: at(trigger, STAGE.titleInEnd),
          end: at(trigger, STAGE.spreadEnd),
          scrub: 0.5,
        },
      },
    );

    /*
     * F · the words clear out, and the middle is left empty.
     *
     * They used to hold until the un-pin and fade over the tail. They cannot
     * any more: at full spread the gap between them is 463px on a desktop but
     * 96px on a phone, so anything meant to appear in the middle has to have
     * the middle to itself. They are gone by `wordsClear`, which is what lets
     * the photograph have the frame to itself before the years take it.
     */
    gsap.to([leftRef.current, rightRef.current], {
      opacity: 0,
      ease: "power1.in",
      scrollTrigger: {
        trigger,
        start: at(trigger, STAGE.wordsOut),
        end: at(trigger, STAGE.wordsClear),
        scrub: true,
      },
    });
  });

  return (
    <h1
      ref={titleRef}
      className="col-start-1 row-start-1 font-display text-[clamp(2.6rem,13vw,9rem)] leading-none tracking-tight text-accent-soft will-change-transform"
    >
      <span ref={leftRef} className="inline-block will-change-transform">
        {site.titleLeft}
      </span>{" "}
      <span ref={rightRef} className="inline-block will-change-transform">
        {site.titleRight}
      </span>
    </h1>
  );
}

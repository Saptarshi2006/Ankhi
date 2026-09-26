"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useAllowMotion } from "@/lib/motion-pref";
import { site } from "@/content/site";

gsap.registerPlugin(ScrollTrigger);

/**
 * Phases D–E: "Happy 19th" arrives, splits, travels to opposite edges, holds,
 * then fades as the letter takes over.
 *
 * One scrubbed timeline rather than several triggers, so the arrival, the
 * split, and the fade are a single continuous gesture instead of three
 * independently-timed animations.
 */
export default function TitleSpread() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const leftRef = useRef<HTMLSpanElement>(null);
  const rightRef = useRef<HTMLSpanElement>(null);
  const allowMotion = useAllowMotion();

  useGSAP(
    () => {
      if (!allowMotion) return;

      /**
       * How far each word must travel to sit against its edge.
       *
       * Derived from `offsetLeft` / `offsetWidth` on purpose. Those are
       * layout coordinates and are immune to transforms, and this timeline
       * scales the heading as it arrives — so measuring with
       * `getBoundingClientRect()` (or reasoning about the rendered width)
       * reads a value that changes mid-flight and throws the destination
       * past the viewport edge.
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

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.5,
          invalidateOnRefresh: true,
        },
      });

      tl.fromTo(
        titleRef.current,
        { scale: 0.62, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.16, ease: "power2.out" },
        0,
      )
        .to(
          leftRef.current,
          {
            x: travelTo(leftRef.current, "left"),
            rotate: -5,
            duration: 0.52,
            ease: "power2.inOut",
          },
          0.18,
        )
        .to(
          rightRef.current,
          {
            x: travelTo(rightRef.current, "right"),
            rotate: 5,
            duration: 0.52,
            ease: "power2.inOut",
          },
          0.18,
        )
        .to(
          [leftRef.current, rightRef.current],
          { opacity: 0, duration: 0.14, ease: "power1.in" },
          0.86,
        );
    },
    { scope: sectionRef, dependencies: [allowMotion] },
  );

  return (
    <section ref={sectionRef} className="track-title relative">
      <div className="sticky-viewport grid place-items-center">
        <h1
          ref={titleRef}
          className="font-display text-[clamp(2.6rem,13vw,9rem)] leading-none tracking-tight text-accent-soft will-change-transform"
        >
          <span ref={leftRef} className="inline-block will-change-transform">
            {site.titleLeft}
          </span>{" "}
          <span ref={rightRef} className="inline-block will-change-transform">
            {site.titleRight}
          </span>
        </h1>
      </div>
    </section>
  );
}

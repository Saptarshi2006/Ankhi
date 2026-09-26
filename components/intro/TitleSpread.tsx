"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
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

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        /**
         * How far each word must travel to sit against its edge.
         *
         * `offsetWidth` rather than `getBoundingClientRect().width`: the
         * heading is mid-`scale` when this is measured, and the rect would
         * report the *scaled* width, throwing the destination off by the
         * scale factor.
         *
         * Function-based, so `invalidateOnRefresh` re-evaluates it on resize.
         */
        const travel = (el: HTMLSpanElement | null, dir: -1 | 1) => () => {
          if (!el) return 0;
          const pad = window.innerWidth < 640 ? 20 : 48;
          return dir * (window.innerWidth / 2 - el.offsetWidth / 2 - pad);
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
            { x: travel(leftRef.current, -1), rotate: -5, duration: 0.52, ease: "power2.inOut" },
            0.18,
          )
          .to(
            rightRef.current,
            { x: travel(rightRef.current, 1), rotate: 5, duration: 0.52, ease: "power2.inOut" },
            0.18,
          )
          .to(
            [leftRef.current, rightRef.current],
            { opacity: 0, duration: 0.14, ease: "power1.in" },
            0.86,
          );
      });
    },
    { scope: sectionRef },
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

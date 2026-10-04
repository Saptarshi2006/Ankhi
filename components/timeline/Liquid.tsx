"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { beats } from "@/content/years";
import { sectionRange } from "@/lib/timeline-scroll";
import { hexFromOklch } from "@/lib/colour";

gsap.registerPlugin(ScrollTrigger);

/** Fraction of each beat's segment spent holding, before the drip begins. */
const HOLD = 0.55;

/** Samples across the lower edge of the drip. */
const SAMPLES = 30;

/**
 * Liquid droplets running ahead of the front.
 *
 * These are the detail that makes the transition read as liquid rather than a
 * wipe. A front with a flat or merely wavy edge is a wipe; a front with
 * separate beads moving faster than the body of it is a drip.
 */
const TONGUES = [
  { x: 0.18, depth: 0.42, width: 0.045 },
  { x: 0.47, depth: 0.3, width: 0.03 },
  { x: 0.79, depth: 0.5, width: 0.055 },
];

/**
 * The lower edge of the drip at progress `t`, 0 → 1.
 *
 * Procedural rather than a MorphSVG tween between authored paths. It is still
 * a morphing shape, but a pure function of `t` is cheaper per frame than
 * point-matching, gives direct control over where the beads sit, and cannot
 * drift out of register with the scroll.
 *
 * `seed` varies the surface per beat so the liquid is not the same shape six
 * times over.
 */
function dripPath(t: number, width: number, height: number, seed: number): string {
  if (t <= 0) return "M0,0 L0,0 Z";

  // Descends past the bottom edge, so the shape fully covers at t = 1.
  const front = t * height * 1.3;
  const points: string[] = [];

  for (let i = 0; i <= SAMPLES; i += 1) {
    const u = i / SAMPLES;

    // The front bows forward in the middle rather than falling flat.
    let y = front * (0.62 + 0.38 * Math.cos((u - 0.5) * Math.PI * 1.1));

    // An irregular surface. Scaled by t so that t = 0 is genuinely flat and
    // covers nothing.
    y += t * (6 + 22 * t) * Math.sin(u * 8.3 + seed * 1.7);

    // Beads running ahead of the body of the liquid.
    for (const tongue of TONGUES) {
      const d = (u - tongue.x) / tongue.width;
      y += front * tongue.depth * Math.exp(-d * d * 0.5);
    }

    points.push(`${(u * width).toFixed(1)},${Math.max(0, y).toFixed(1)}`);
  }

  // Across the top, then back along the front from right to left.
  return `M0,0 L${width},0 L${points.reverse().join(" L")} Z`;
}

/** Which beat is showing, and how far through the drip to the next one. */
function resolve(progress: number): { index: number; t: number } {
  const last = beats.length - 1;
  const segment = 1 / beats.length;
  const index = Math.min(last, Math.floor(progress / segment));
  const local = (progress - index * segment) / segment;
  const t = Math.min(1, Math.max(0, (local - HOLD) / (1 - HOLD)));
  return { index, t };
}

/**
 * The colour of the page as the years pass: the current beat underneath, the
 * next one dripping down over it.
 *
 * Everything here is written to the DOM imperatively from the scrub. This runs
 * on every frame of the scroll, and the path is the only thing changing —
 * there is no React state involved at all.
 */
export default function Liquid() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useGSAP(
    () => {
      const section = wrapRef.current?.closest(".track-timeline");
      if (!section) return;

      // The OS preference is still respected even though the site has no motion
      // toggle: someone who has it on system-wide should not get a liquid
      // transition they did not ask for.
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const hexes = beats.map((beat) => hexFromOklch(beat.colour));
      const viewport = wrapRef.current?.parentElement;
      let paintedIndex = -1;

      const paint = (progress: number) => {
        const { index, t } = resolve(progress);

        if (index !== paintedIndex) {
          paintedIndex = index;
          if (baseRef.current) baseRef.current.style.backgroundColor = hexes[index];
          /*
           * Published on the viewport rather than used directly, so the
           * takeovers — which live outside the track and are painted over the
           * whole frame — can inherit the same colour. The journey to the next
           * beat has to carry on behind the full-screen image rather than
           * stopping dead.
           */
          viewport?.style.setProperty("--timeline-bg", hexes[index]);
        }

        const isLast = index === beats.length - 1;
        const path = pathRef.current;

        if (path) {
          if (calm) {
            // No liquid: the base simply steps to the next colour.
            path.setAttribute("d", "");
            if (t > 0.5 && !isLast && baseRef.current) {
              baseRef.current.style.backgroundColor = hexes[index + 1];
            }
            return;
          }

          if (isLast) {
            path.setAttribute("d", "");
            return;
          }

          path.setAttribute("d", dripPath(t, 100, 100, index + 1));
          path.style.fill = hexes[index + 1];
        }
      };

      const trigger = ScrollTrigger.create({
        start: () => sectionRange(section).start,
        end: () => sectionRange(section).end,
        scrub: true,
        onUpdate: (self) => paint(self.progress),
        onRefresh: (self) => paint(self.progress),
      });

      paint(trigger.progress);

      return () => trigger.kill();
    },
    { scope: wrapRef },
  );

  return (
    <div ref={wrapRef} className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div ref={baseRef} data-liquid-base className="absolute inset-0" />
      {/*
        A fixed 100 × 100 viewBox stretched to fit, rather than one sized to the
        window: reading window dimensions during render would differ between
        server and client and trip a hydration mismatch. The stretch only
        distorts the wobble, which is not something anyone can see.
      */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        focusable="false"
      >
        <path ref={pathRef} d="" />
      </svg>
    </div>
  );
}

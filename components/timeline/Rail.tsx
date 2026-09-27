"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { beats } from "@/content/years";
import { sectionRange } from "@/lib/timeline-scroll";

gsap.registerPlugin(ScrollTrigger);

/**
 * A progress rail with the ages marked along it.
 *
 * The point is orientation: six scenes of a life going past is otherwise
 * disorienting, and you cannot tell how much is left. The dot is written
 * straight to the DOM from the scrub.
 *
 * The dot's position and the highlighted label come from the same number, which
 * they did not used to. The dot was moved with `translateX(progress * 100%)` —
 * a percentage of *its own* seven pixels, so it crawled seven pixels across the
 * entire timeline while the highlight jumped between labels, and the two
 * disagreed. Positions here are percentages of the rail, set with `left`.
 *
 * The dot travels between the *centres* of the first and last labels rather
 * than the ends of the line, so that reaching a beat puts the dot on that
 * beat's age rather than half a beat past it. The labels are a six-column grid
 * and the track is inset by half a column at each end to match.
 */
export default function Rail() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const labelsRef = useRef<HTMLOListElement>(null);

  useGSAP(
    () => {
      const section = wrapRef.current?.closest(".track-timeline");
      if (!section) return;

      const count = beats.length;

      const paint = (progress: number) => {
        const clamped = Math.min(1, Math.max(0, progress));

        /*
         * Which beat owns the viewport, and how far through it we are. Beats are
         * all exactly one `SCREENS_PER_BEAT` long, so this is just a division —
         * and it is the same division the label highlight uses, which is the
         * point.
         */
        /*
         * Clamped to `count - 1` before splitting, not after. At the very end
         * `exact` reaches `count`, and `active` had to be pulled back to the
         * last beat — which left `within` at 1 and threw the dot a whole column
         * past the final age.
         */
        const exact = Math.min(count - 1, clamped * count);
        const active = Math.floor(exact);
        const within = exact - active;

        if (dotRef.current) {
          /*
           * Divided by `count - 1`, not `count`. Six labels have five gaps
           * between them, so their centres sit at 0%, 20%, 40%…100% of the
           * track — dividing by six put the dot two thirds of a label past the
           * one it was highlighting, and it drifted further off with every
           * beat. The track is inset by half a column (100/12) precisely so
           * that 0% and 100% land on the first and last label's centres.
           */
          const span = Math.max(1, count - 1);
          dotRef.current.style.left = `${((active + within) / span) * 100}%`;
        }
        if (labelsRef.current) {
          const items = labelsRef.current.children;
          for (let i = 0; i < items.length; i += 1) {
            (items[i] as HTMLElement).style.opacity = i === active ? "1" : "0.45";
          }
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
    // `pr-14` keeps the last age clear of the fixed sound toggle in the top
    // right corner, which otherwise sits right on top of it.
    <div
      ref={wrapRef}
      className="pointer-events-none absolute inset-x-0 top-7 z-20 px-7 pr-16 sm:px-12 sm:pr-16"
      aria-hidden="true"
    >
      {/*
        The dot's track and the labels are siblings on a shared full-width
        column, and the track is inset by half a column at each end. Six columns
        put label `i`'s centre at `(i + 0.5) / 6` of the full width, and the
        inset track puts the dot's `0%` and `100%` at those same two points — so
        arriving at a beat lands the dot on that beat's age exactly, rather than
        half a beat past it. Insetting by 100/12 is what makes the two agree.
      */}
      <div className="relative">
        <div className="relative mx-[8.3333%]">
          <div className="h-px w-full bg-ink/20" />
          <span
            ref={dotRef}
            className="absolute -top-[3px] block h-[7px] w-[7px] -translate-x-1/2 rounded-full bg-accent-deep"
            style={{ left: "0%" }}
          />
        </div>
        <ol ref={labelsRef} className="mt-3 grid grid-cols-6">
          {beats.map((beat) => (
            <li
              key={beat.year}
              className="text-center font-sans text-[0.62rem] uppercase tracking-[0.24em] text-ink-muted transition-opacity duration-300"
            >
              {beat.ageFrom === beat.ageTo ? beat.ageFrom : `${beat.ageFrom}–${beat.ageTo}`}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

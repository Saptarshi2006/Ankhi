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
 * The point is orientation: six panels of a life scrolling past horizontally
 * is otherwise disorienting, and you cannot tell how much is left. The
 * position dot is written straight to the DOM from the scrub.
 */
export default function Rail() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const labelsRef = useRef<HTMLOListElement>(null);

  useGSAP(
    () => {
      const section = wrapRef.current?.closest(".track-timeline");
      if (!section) return;

      const paint = (progress: number) => {
        if (dotRef.current) {
          dotRef.current.style.transform = `translateX(${progress * 100}%)`;
        }
        if (labelsRef.current) {
          const items = labelsRef.current.children;
          // Whichever beat owns the majority of the viewport goes solid.
          const active = Math.min(
            beats.length - 1,
            Math.floor(progress * beats.length + 0.35),
          );
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
      <div className="relative">
        <div className="h-px w-full bg-ink/20" />
        <span
          ref={dotRef}
          className="absolute -top-[3px] left-0 block h-[7px] w-[7px] rounded-full bg-accent-deep"
          style={{ transform: "translateX(0%)" }}
        />
        <ol ref={labelsRef} className="mt-3 flex justify-between">
          {beats.map((beat) => (
            <li
              key={beat.year}
              className="font-sans text-[0.62rem] uppercase tracking-[0.24em] text-ink-muted transition-opacity duration-300"
            >
              {beat.ageFrom === beat.ageTo ? beat.ageFrom : `${beat.ageFrom}–${beat.ageTo}`}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

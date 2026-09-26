"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { beats } from "@/content/years";
import { pinDistance, sectionRange } from "@/lib/timeline-scroll";
import Beat from "./Beat";
import Duotone from "./Duotone";
import Figure from "./Figure";
import Liquid from "./Liquid";
import Rail from "./Rail";

gsap.registerPlugin(ScrollTrigger);

/**
 * The years between the title and the letter.
 *
 * Vertical scroll is translated into horizontal travel inside a pinned frame,
 * so the gesture stays vertical — which is the whole reason this works on a
 * phone. A natively sideways-scrolling section would fight the page in
 * portrait, and that was the objection to this layout in the first place.
 *
 * The frame is pinned with ScrollTrigger's `pin` rather than CSS `sticky`,
 * which is the one deliberate exception to the rule used by the intro. A
 * horizontal scroller is exactly one viewport tall and has to stay put;
 * `sticky` would demand a section as tall as its entire horizontal content,
 * which would be several thousand pixels of nothing to scroll through.
 */
export default function Timeline() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      const track = trackRef.current;
      if (!section || !track) return;

      const distance = pinDistance();

      // How far the track has to travel to bring the last panel fully in.
      const overflow = () => Math.max(0, track.scrollWidth - window.innerWidth);

      const tween = gsap.to(track, {
        x: () => -overflow(),
        ease: "none",
        scrollTrigger: {
          trigger: section,
          pin: true,
          scrub: 0.55,
          // Anticipate the pin: without it, a fast flick into the section can
          // arrive after the frame should already have stopped.
          anticipatePin: 1,
          invalidateOnRefresh: true,
          start: () => sectionRange(section).start,
          end: () => sectionRange(section).start + distance,
        },
      });

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
    { scope: sectionRef },
  );

  return (
    <section ref={sectionRef} className="track-timeline relative" data-timeline>
      <Duotone />
      <div className="timeline-viewport">
        <Liquid />

        {/*
          One figure, repositioned per breakpoint rather than rendered twice:
          a hidden second copy would still mount and still write attributes
          every frame. On desktop it occupies the left column; in portrait
          there is no room for a column, so it sits behind the panels at low
          opacity and keeps growing.
        */}
        <div className="timeline-figure">
          <Figure className="timeline-figure-svg" />
        </div>

        <div className="timeline-track-wrap flex h-full items-center">
          {/*
            The figure's column is a static sibling, not padding on the track.
            Padding on the track would travel with it: the first panel would
            slide left out from under the figure and the column would sit empty
            for the whole first beat. It also keeps the track's scrollWidth
            equal to the panels alone, which is what the travel distance is
            measured from.
          */}
          <div className="timeline-gutter shrink-0" aria-hidden="true" />

          <div
            ref={trackRef}
            className="track-scroll flex h-full min-w-0 items-center will-change-transform"
          >
            {beats.map((beat, index) => (
              <Beat key={beat.year} beat={beat} index={index} />
            ))}
            <div className="w-[6vw] shrink-0" aria-hidden="true" />
          </div>
        </div>

        <Rail />
      </div>
    </section>
  );
}

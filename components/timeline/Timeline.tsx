"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { beats } from "@/content/years";
import {
  SCREENS_PER_BEAT,
  STAGES,
  STAGE,
  beatCentreX,
  pinDistance,
  sectionRange,
  stageOffset,
} from "@/lib/timeline-scroll";
import Beat from "./Beat";
import Curtain from "./Curtain";
import Duotone from "./Duotone";
import Figure from "./Figure";
import Liquid from "./Liquid";
import Rail from "./Rail";
import Takeover from "./Takeover";

gsap.registerPlugin(ScrollTrigger);

/**
 * The years between the title and the letter.
 *
 * Vertical scroll becomes horizontal travel inside a pinned frame, so the
 * gesture stays vertical — which is the whole reason this works on a phone. A
 * natively sideways-scrolling section would fight the page in portrait, and that
 * was the objection to this layout in the first place.
 *
 * The track is pinned with ScrollTrigger's `pin` rather than CSS `sticky`, the
 * one deliberate exception to the rule used by the intro. A horizontal scroller
 * is exactly one viewport tall and has to stay put; `sticky` would demand a
 * section as tall as its entire horizontal content, which would be several
 * thousand pixels of nothing to scroll through.
 *
 * The travel is *not* linear in scroll. Each beat is a scene that occupies the
 * screen while the track holds still, so the track only moves during each
 * beat's opening travel stage. A single even tween across the whole pin would
 * slide the panels continuously underneath a scene that is supposed to be
 * standing still.
 */
export default function Timeline() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      const track = trackRef.current;
      if (!section || !track) return;

      const setBeatWidth = () => {
        section.style.setProperty("--beat-w", `${section.clientWidth}px`);
      };
      setBeatWidth();

      // One unit is one screen of scroll, matching `stageOffset`, so a tween
      // placed at a stage's offset lands on that stage.
      const tl = gsap.timeline({ paused: true });

      for (let i = 1; i < beats.length; i += 1) {
        tl.to(
          track,
          {
            x: () => beatCentreX(i),
            duration: STAGES[STAGE.travel].screens,
            ease: "power1.inOut",
          },
          stageOffset(i, 0),
        );
      }
      /*
       * Pad across the whole pin. The last tween ends at the start of the final
       * beat, so without this the timeline is short by that beat's whole length
       * and ScrollTrigger stretches it to fit — every tween then lands
       * proportionally early, and the final beat never centres.
       */
      tl.set(track, {}, beats.length * SCREENS_PER_BEAT);

      // Beat 0 is already centred when the section arrives; there is nowhere to
      // travel from, so its travel stage is the colour settling instead.
      gsap.set(track, { x: () => beatCentreX(0) });

      const trigger = ScrollTrigger.create({
        trigger: section,
        pin: true,
        scrub: 0.4,
        animation: tl,
        // Anticipate the pin: without it, a fast flick into the section can
        // arrive after the frame should already have stopped.
        anticipatePin: 1,
        invalidateOnRefresh: true,
        start: () => sectionRange(section).start,
        end: () => sectionRange(section).start + pinDistance(),
        // Set before anything is measured, so the panels are already the right
        // width when the travel distance is worked out from them.
        onRefreshInit: setBeatWidth,
      });

      return () => {
        trigger.kill();
        tl.kill();
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
          One figure, kept as a full-bleed watermark behind the scenes rather
          than a column beside them.

          It was a column so panels could sit clear of it, which meant the scenes
          had 74% of the screen to be centred in — and every composition in a
          beat is a centred one. With the panel a full viewport wide, "the middle"
          is the middle, and the figure still keeps growing behind everything.

          One copy, not two: a hidden second would still mount and still write
          attributes every frame.
        */}
        <div className="timeline-figure">
          <Figure className="timeline-figure-svg" />
        </div>

        {/*
          Full-width panels, contiguous, so the track's travel is a whole number
          of viewports. That exactness is what lets the takeover cover the
          screen and then uncover the next beat without a visible slide.
        */}
        <div className="timeline-track-wrap h-full">
          <div
            ref={trackRef}
            className="track-scroll flex h-full items-center will-change-transform"
          >
            {beats.map((beat, index) => (
              <Beat key={beat.year} beat={beat} index={index} />
            ))}
          </div>
        </div>

        {/*
          The curtains, one per beat, beside the track rather than inside it.
          See `Curtain` for why that is not a detail.
        */}
        {beats.map((beat, index) => (
          <Curtain key={beat.year} beat={index} />
        ))}

        {/*
          The takeovers. Fixed, so they sit in viewport coordinates rather than
          travelling with the track, and siblings of it rather than children —
          a fixed element under a transformed ancestor is anchored to that
          ancestor, and this one has to be able to leave the track behind.
        */}
        {beats.map((beat, index) => (
          <Takeover
            key={beat.year}
            beat={beat}
            index={index}
            filter={beat.fullColour ? undefined : `url(#duotone-${index})`}
          />
        ))}

        <Rail />
      </div>
    </section>
  );
}

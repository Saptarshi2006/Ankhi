"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import { letter } from "@/content/letter";

gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * Phase F: the letter, one line at a time.
 *
 * Each line is split into words and revealed on its own trigger, firing as the
 * line reaches the top of the frame and reversing if the reader scrolls back up.
 *
 * Two things are deliberate and both were wrong first.
 *
 * The words grow out of the centre rather than sliding up from below. Every
 * other arrival on this site — the title, the photograph, the span of years —
 * scales up from its own centre, and a letter that arrives by sliding in from
 * the bottom edge is the one moment that does not match. Same `transformOrigin`,
 * same feel.
 *
 * The lines stay individually triggered. One trigger for the whole letter was
 * tried and it is wrong on a phone: the letter runs about 250vh tall there, so a
 * single staggered timeline animates the lines below the fold while they are
 * still off screen, and they have finished by the time the reader scrolls to
 * them. Per-line is what makes a long letter readable on a small screen.
 *
 * The words are real text in the static export, so the letter is fully
 * readable with JavaScript disabled, in a screen reader, and to a crawler.
 * SplitText mirrors each line's text onto the parent as an `aria-label` and
 * hides the fragments, so splitting does not garble the accessible name.
 */
export default function Letter() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    const lines = gsap.utils.toArray<HTMLElement>("[data-line]", sectionRef.current);

    const splits = lines.map((line) =>
      SplitText.create(line, {
        type: "words",
        // Re-split on font load and on resize, so the word count matches the
        // layout that is actually on screen.
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.words, {
            autoAlpha: 0,
            scale: 0.94,
            transformOrigin: "50% 50%",
            duration: 0.8,
            ease: "power3.out",
            stagger: 0.04,
            /*
              92%, not 86%. Close enough to the top of the frame that the letter
              reads as arriving with the timeline's handover rather than trickling
              in over a long scroll, while still leaving each line its own turn
              on the way past.
            */
            scrollTrigger: {
              trigger: line,
              start: "top 92%",
              toggleActions: "play none none reverse",
            },
          }),
      }),
    );

    return () => splits.forEach((split) => split.revert());
  }, { scope: sectionRef });

  return (
    <section ref={sectionRef} className="px-6 pt-[14vh] pb-[30vh]">
      <div className="mx-auto w-full max-w-[34rem]">
        {letter.map((stanza, stanzaIndex) => (
          <div key={stanzaIndex} className={stanzaIndex > 0 ? "mt-10 sm:mt-14" : ""}>
            {stanza.map((text, lineIndex) => (
              <p
                key={lineIndex}
                data-line
                className="font-body text-[clamp(1.05rem,2.6vw,1.35rem)] leading-[1.75] text-ink"
              >
                {text}
              </p>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

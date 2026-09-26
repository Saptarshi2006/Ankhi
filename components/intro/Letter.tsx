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
 * line reaches the upper third and reversing if the reader scrolls back up.
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
            yPercent: 105,
            opacity: 0,
            duration: 0.85,
            ease: "power3.out",
            stagger: 0.04,
            scrollTrigger: {
              trigger: line,
              start: "top 86%",
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

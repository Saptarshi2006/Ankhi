"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { letter } from "@/content/letter";

gsap.registerPlugin(ScrollTrigger);

/**
 * Phase F: the letter, arriving as one thing.
 *
 * It used to be split into words and revealed a line at a time, each on its own
 * trigger, which is the right idea for a long page of text and completely wrong
 * here: the reader comes off the last clip and the words trickled in as they
 * scrolled, so the handover from the video read as a crawl rather than an
 * arrival. One tween on the whole block now, growing out of the middle of the
 * frame, the same vocabulary as the title, the photograph and the span of years.
 *
 * The block is sized to fit one viewport, and that is a requirement rather than
 * a flourish — see `LETTER` below. Measured on a 390×664 phone and a 1280×720
 * desktop, the letter is 85–87% of the screen at the sizes below, which puts its
 * centre at roughly 47% of the frame. That is what makes `50% 50%` an honest
 * transform origin rather than a nominal one: the thing genuinely grows out of
 * the middle of the screen the reader is looking at.
 *
 * `SplitText` is gone, which is a gain beyond the motion. The letter is plain
 * real text in the markup again — readable with JavaScript disabled, to a screen
 * reader, and to a crawler, rather than a pile of absolutely-positioned spans
 * inside `aria-hidden` wrappers.
 */

/**
 * The three measurements that keep the letter to one screen.
 *
 * The type size is not one of them and never should be — it is the reading
 * experience of the most important piece of writing on the site, and every spare
 * pixel here was taken from the space around it instead.
 *
 * `padTop` was `14vh` and was most of the overflow on its own. The section
 * arrives from the timeline, which already leaves it room, so its own padding
 * was buying very little. `leading` is the only typographic change and it is the
 * one worth arguing about: 1.62 is still comfortably readable, but 1.75 was
 * airier, and this is the paragraph people will actually read.
 */
const LETTER = {
  padTop: "pt-[4vh]",
  stanzaGap: "mt-6 sm:mt-9",
  leading: "leading-[1.62]",
} as const;

export default function Letter() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    const section = sectionRef.current;
    const block = section?.firstElementChild as HTMLElement | null;
    if (!section || !block) return;

    /*
     * Triggered on the block and centred in the viewport, not on the section.
     *
     * Both halves matter. The section is full-width and carries the padding, so
     * anchoring to it resolved the origin to the section's centre — 640px on a
     * 1280 screen where the letter itself is 544px wide, and 420px down a block
     * whose middle is nearer 300. It grew from a point that was not its middle.
     *
     * And `start: "top 88%"` was worse: at that scroll position the letter's
     * centre is still about 240px below the fold on a desktop, so the bloom
     * began from somewhere the reader could not see.
     *
     * Triggering on the block rather than the section also lets the start point
     * be tuned in the block's own terms. `"center center"` fires exactly when
     * the letter's middle is the middle of the screen, but measured against the
     * page that lands at 29.39 viewports of scroll — by which point the last
     * clip has already left the frame at 29.3, so the handover read as a blank
     * frame between the two. At `"center 72%"` the bloom is already underway
     * while the bottom edge of that clip is still going, and it resolves as the
     * block centres. The gap closed from about 140px of dead scroll to none.
     *
     * `reverse` on the way back up, so scrolling into the timeline again hides
     * the letter rather than leaving it stranded below a frame that has gone.
     */
    gsap.from(block, {
      autoAlpha: 0,
      scale: 0.92,
      filter: "blur(12px)",
      transformOrigin: "50% 50%",
      ease: "power2.out",
      scrollTrigger: {
        trigger: block,
        start: "center 72%",
        toggleActions: "play none none reverse",
      },
    });
  }, { scope: sectionRef });

  return (
    <section ref={sectionRef} data-letter className={`px-6 ${LETTER.padTop} pb-[30vh]`}>
      <div data-letter-block className="mx-auto w-full max-w-[34rem] will-change-transform">
        {letter.map((stanza, stanzaIndex) => (
          <div key={stanzaIndex} className={stanzaIndex > 0 ? LETTER.stanzaGap : ""}>
            {stanza.map((text, lineIndex) => (
              <p
                key={lineIndex}
                data-line
                className={`font-body text-[clamp(1.05rem,2.6vw,1.35rem)] ${LETTER.leading} text-ink`}
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
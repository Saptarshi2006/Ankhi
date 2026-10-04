"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { site } from "@/content/site";
import { STAGE, at } from "@/lib/stage-ranges";

gsap.registerPlugin(ScrollTrigger);

/**
 * A quiet "Happy 19th" for the stretch the balloon used to occupy.
 *
 * The balloon pops once and never returns, by design. That leaves the first
 * 1.25 screens of the stage empty for the rest of the session — invisible on
 * the way down, because the balloon is filling it, and a blank ~1.2 screens
 * the moment the reader scrolls back up.
 *
 * This fills that. Deliberately understated: the body serif at a third of the
 * main heading's size, in muted ink, so it reads as a whisper beside the
 * display serif rather than a second headline.
 *
 * It hands over to the real heading across exactly the range that heading
 * arrives over, so the two crossfade and there is never a moment with neither
 * on screen.
 *
 * Only mounted once the balloon has popped. Before that the region belongs to
 * the balloon, and the scroll lock means the reader cannot reach this far
 * anyway.
 */
export default function Reprise() {
  const ref = useRef<HTMLParagraphElement>(null);

  useGSAP(() => {
    /*
     * Found by walking up from our own element rather than taking the section
     * ref as a prop: a child's layout effect runs *before* the ancestor's ref
     * is attached, so an injected ref is still null and the trigger would
     * silently do nothing.
     */
    const trigger = ref.current?.closest<HTMLElement>(".track-stage") ?? null;
    if (!trigger) return;

    // Below `titleIn` the scrub holds progress 0, so the reprise simply sits
    // there at full strength. It only fades as the main heading arrives.
    gsap.to(ref.current, {
      opacity: 0,
      ease: "power1.in",
      scrollTrigger: {
        trigger,
        start: at(trigger, STAGE.titleIn),
        end: at(trigger, STAGE.titleInEnd),
        scrub: true,
      },
    });
  });

  return (
    <p
      ref={ref}
      data-reprise
      // The <h1> already carries this text for assistive tech; a second copy
      // would just be noise.
      aria-hidden="true"
      className="col-start-1 row-start-1 font-body text-[clamp(1rem,2.8vw,1.5rem)] tracking-[0.16em] text-ink-muted"
    >
      {site.titleLeft} {site.titleRight}
    </p>
  );
}

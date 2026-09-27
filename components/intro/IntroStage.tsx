"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { STAGE, at } from "@/lib/stage-ranges";
import Balloon from "./Balloon";
import Reprise from "./Reprise";
import RevealLine from "./RevealLine";
import TitleSpread from "./TitleSpread";

gsap.registerPlugin(ScrollTrigger);

/** Distant enough to read as far away, large enough to actually be seen. */
const START_SCALE = 0.34;
/** Big enough to feel close, small enough that its box still fits the frame. */
const MAX_SCALE = 2.5;

/**
 * Phases A–E in a single sticky section.
 *
 * One section, one sticky viewport, both the balloon and the heading inside it.
 * The frame is never empty while pinned, so there is no dead zone to scroll
 * through in either direction.
 *
 * Three nested elements around the balloon, because three different things
 * animate them:
 *   scrollRef  — scrubbed against the stage (scale + y)
 *   idleRef    — a permanent idle life (bob + sway), and the armed pulse
 *   stringRef  — a slower pendulum on the SVG string, trailing the sway
 *
 * Collapsing any two of these would mean one tween fighting another for the
 * same property.
 */
export default function IntroStage({
  armed,
  popping,
  popped,
  onArm,
  onPop,
}: {
  armed: boolean;
  popping: boolean;
  /** Sticky once the balloon has burst — it never comes back. */
  popped: boolean;
  onArm: () => void;
  onPop: () => void;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idleRef = useRef<HTMLDivElement>(null);
  const stringRef = useRef<SVGGElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<gsap.core.Tween | null>(null);
  const armGuard = useRef(false);

  useGSAP(
    () => {
      // Idle life. Runs on its own so it survives the scrub untouched.
      gsap.to(idleRef.current, {
        y: -10,
        rotate: 3,
        duration: 2.6,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });

      gsap
        .timeline({ repeat: -1, yoyo: true, defaults: { duration: 3.2, ease: "sine.inOut" } })
        .to(stringRef.current, { rotation: 7, svgOrigin: "100 212" })
        .to(stringRef.current, { rotation: -7, svgOrigin: "100 212" });

      // Phase A — approach.
      //
      // Ends well before the frame unpins, so the balloon reaches full size
      // while the frame is still held still. Tying the end to the section's
      // own edges completes growth at the exact instant sticky releases, and
      // the balloon is off the top of the screen by the time the scroll locks.
      //
      // A factory, not a shared object: ScrollTrigger mutates the config it
      // is given, so handing the same literal to two triggers corrupts the
      // first one's cached geometry.
      const trigger = sectionRef.current;
      const growth = () => ({
        trigger,
        start: "top top",
        end: at(trigger, STAGE.growthEnd),
        invalidateOnRefresh: true,
      });

      scrubRef.current = gsap.fromTo(
        scrollRef.current,
        { scale: START_SCALE, y: "-30vh" },
        {
          scale: MAX_SCALE,
          y: "0vh",
          ease: "none",
          scrollTrigger: {
            ...growth(),
            scrub: 0.4,
            onUpdate: (self: { progress: number }) => {
              if (self.progress >= 0.999 && !armGuard.current) {
                armGuard.current = true;
                onArm();
              }
            },
          },
        },
      );

      // The room dims as the balloon closes in, so it reads as approaching the
      // viewer rather than merely growing. A vignette, not a backdrop-filter:
      // blurring a full-viewport layer on every scroll frame is the one effect
      // here that would actually cost frames on a phone.
      gsap.fromTo(
        veilRef.current,
        { opacity: 0 },
        { opacity: 0.85, ease: "none", scrollTrigger: { ...growth(), scrub: true } },
      );

      // ...and clears across the pop, so the title lands on a clean
      // background rather than on top of the dimming.
      gsap.to(veilRef.current, {
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger,
          start: at(trigger, STAGE.growthEnd),
          end: at(trigger, STAGE.titleIn),
          scrub: true,
          invalidateOnRefresh: true,
        },
      });

      return () => {
        scrubRef.current?.scrollTrigger?.kill();
        scrubRef.current = null;
      };
    },
    { scope: sectionRef },
  );

  // Phase B — armed. The pulse rides `idleRef` rather than `scrollRef` so it
  // never competes with the scrub for `scale`.
  useEffect(() => {
    if (!armed) return;
    const element = idleRef.current;
    const pulse = gsap.to(element, {
      scale: 1.035,
      duration: 0.55,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
    return () => {
      pulse.kill();
      gsap.set(element, { scale: 1 });
    };
  }, [armed]);

  // Phase C — pop. Detach the scrub first, or it would immediately overwrite
  // the pop transform on the next scroll event.
  useEffect(() => {
    if (!popping) return;
    scrubRef.current?.scrollTrigger?.kill();
    scrubRef.current?.pause();
    gsap.to(scrollRef.current, {
      scale: MAX_SCALE * 1.18,
      y: "-22vh",
      opacity: 0,
      duration: 0.26,
      ease: "power2.in",
    });
  }, [popping]);

  return (
    <section ref={sectionRef} className="track-stage relative">
      <div
        className={`sticky-viewport grid select-none place-items-center ${
          armed ? "cursor-pointer" : ""
        }`}
        onClick={armed ? onPop : undefined}
      >
        <div ref={veilRef} className="veil absolute inset-0 opacity-0" aria-hidden="true" />

        {/*
          `1 / 1` on both the balloon and the heading is load-bearing. With
          `place-items-center` and no explicit rows, each child would take its
          own implicit row, and the heading's height would push the balloon up
          out of frame. Pinning both to the same cell stacks them centred on
          top of each other instead.
        */}
        <div
          ref={scrollRef}
          className="relative col-start-1 row-start-1 grid place-items-center will-change-transform"
        >
          <div className="glow absolute h-[85%] w-[85%] rounded-full blur-2xl" aria-hidden="true" />
          <div ref={idleRef} className="will-change-transform">
            <Balloon
              stringRef={stringRef}
              className="h-[38svh] w-auto drop-shadow-[0_18px_40px_rgba(120,40,65,0.28)]"
            />
          </div>
        </div>

        {/*
          Only after the burst. The balloon owns this part of the frame until
          then, and once it is gone for good the words take its place so
          scrolling back up never lands on an empty screen.
        */}
        {popped && <Reprise />}

        <TitleSpread />

        {/*
          F · the span of the whole timeline, blooming in once the words have
          cleared the middle of the frame.
        */}
        <RevealLine />

        {/*
          Not optional. An unprompted locked scroll is indistinguishable from a
          frozen page — without this line, phases A–B dead-end.
        */}
        <p
          aria-hidden={!armed}
          className={`pointer-events-none absolute inset-x-0 bottom-[16vh] z-10 text-center font-sans text-[0.72rem] uppercase tracking-[0.38em] text-ink-muted transition-opacity duration-700 ${
            armed ? "pulse-hint opacity-100" : "opacity-0"
          }`}
        >
          Click or press any key
        </p>
      </div>
    </section>
  );
}

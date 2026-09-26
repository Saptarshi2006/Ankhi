"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useAllowMotion } from "@/lib/motion-pref";
import Balloon from "./Balloon";

gsap.registerPlugin(ScrollTrigger);

/** Distant enough to read as far away, large enough to actually be seen. */
const START_SCALE = 0.34;
/** Big enough to feel close, small enough that its box still fits the frame. */
const MAX_SCALE = 2.5;
/** Viewport heights of scrolling the growth is spread across. */
const GROWTH_VH = 1.4;

/**
 * Phases A–C: the balloon closes in, arms, and pops.
 *
 * Three nested elements, because three different things animate them:
 *   scrollRef  — scrubbed against the scroll track (scale + y)
 *   idleRef    — a permanent idle life (bob + sway), and the armed pulse
 *   stringRef  — a slower pendulum on the SVG string, trailing the sway
 *
 * Collapsing any two of these would mean one tween fighting another for the
 * same property.
 */
export default function BalloonStage({
  armed,
  popping,
  onArm,
  onPop,
}: {
  armed: boolean;
  popping: boolean;
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
  const allowMotion = useAllowMotion();

  useGSAP(
    () => {
      if (!allowMotion) {
        // Decoration only: no scrub, no lock, nothing to click.
        gsap.set(scrollRef.current, { scale: 0.62, y: "-6vh" });
        return;
      }

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
      // The end is measured in viewport heights rather than pinned to the
      // section's own edges. Ending at "bottom bottom" completes growth at
      // the exact instant the sticky frame unpins, so the balloon reaches
      // full size while the frame is already flying away — by the time the
      // scroll locks, the balloon is off the top of the screen. Finishing
      // 1.4 screens in leaves the frame pinned and still for the remaining
      // 0.6, which is the shot the reader is actually meant to see.
      //
      // A factory, not a shared object: ScrollTrigger mutates the config it
      // is given, so handing the same literal to two triggers corrupts the
      // first one's cached geometry.
      const growth = () => ({
        trigger: sectionRef.current,
        start: "top top",
        end: () => "+=" + window.innerHeight * GROWTH_VH,
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

      gsap.fromTo(
        veilRef.current,
        { opacity: 0 },
        { opacity: 0.85, ease: "none", scrollTrigger: { ...growth(), scrub: true } },
      );

      // ...and back out again as the stage leaves. Without this the veil
      // scrolls off as a hard-edged pink band across the top of the screen.
      gsap.to(veilRef.current, {
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: () => "+=" + window.innerHeight * GROWTH_VH,
          end: "bottom bottom",
          scrub: true,
          invalidateOnRefresh: true,
        },
      });

      return () => {
        scrubRef.current?.scrollTrigger?.kill();
        scrubRef.current = null;
      };
    },
    { scope: sectionRef, dependencies: [allowMotion] },
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
    <section ref={sectionRef} className="track-balloon relative">
      <div
        className={`sticky-viewport grid select-none place-items-center ${
          armed ? "cursor-pointer" : ""
        }`}
        onClick={armed ? onPop : undefined}
      >
        <div ref={veilRef} className="veil absolute inset-0 opacity-0" aria-hidden="true" />

        <div ref={scrollRef} className="relative grid place-items-center will-change-transform">
          <div className="glow absolute h-[85%] w-[85%] rounded-full blur-2xl" aria-hidden="true" />
          <div ref={idleRef} className="will-change-transform">
            <Balloon
              stringRef={stringRef}
              className="h-[38svh] w-auto drop-shadow-[0_18px_40px_rgba(120,40,65,0.28)]"
            />
          </div>
        </div>

        {/*
          Not optional. An unprompted locked scroll is indistinguishable from a
          frozen page — without this line, phases A–B dead-end.
        */}
        <p
          aria-hidden={!armed}
          className={`pointer-events-none absolute inset-x-0 bottom-[16vh] text-center font-sans text-[0.72rem] uppercase tracking-[0.38em] text-ink-muted transition-opacity duration-700 ${
            armed ? "pulse-hint opacity-100" : "opacity-0"
          }`}
        >
          Click or press any key
        </p>
      </div>
    </section>
  );
}

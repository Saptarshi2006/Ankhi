"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "@/lib/smooth-scroll";
import { useAllowMotion } from "@/lib/motion-pref";
import { useSoundEnabled } from "@/lib/sound-pref";
import { playPop } from "@/lib/sound";
import Signature from "@/components/Signature";
import SoundToggle from "@/components/SoundToggle";
import MotionToggle from "@/components/MotionToggle";
import BalloonStage from "./BalloonStage";
import Burst from "./Burst";
import TitleSpread from "./TitleSpread";
import Letter from "./Letter";

/**
 * approach — the balloon is growing (phase A)
 * armed     — grown, scroll is locked, awaiting a click or key (phase B)
 * popping   — burst playing, lock still held (phase C)
 * letter    — unlocked, the reader is free to continue (phases D–F)
 */
type Phase = "approach" | "armed" | "popping" | "letter";

/** How long the lock is held so the burst can play out. */
const POP_DURATION = 1200;

/**
 * Swallows touch scrolling while the balloon is locked.
 *
 * `overflow: hidden` is not sufficient on its own: it stops the reader
 * scrolling, but iOS will happily finish a momentum scroll that was already in
 * flight when the lock engaged, and a programmatic scroll can still move the
 * viewport. This is the backstop for both.
 *
 * Module scope so the identity is stable and the listener pairs exactly.
 */
const blockTouch = (event: TouchEvent) => event.preventDefault();

export default function Intro() {
  const lenis = useLenis();
  const soundOn = useSoundEnabled();

  const [phase, setPhase] = useState<Phase>("approach");
  const [burstKey, setBurstKey] = useState(0);

  // Mirrors `phase` for use inside callbacks and effects, which would
  // otherwise capture a stale value from the render that created them.
  const phaseRef = useRef<Phase>("approach");
  const lockedRef = useRef(false);

  const allowMotion = useAllowMotion();
  const allowMotionRef = useRef(allowMotion);
  useEffect(() => {
    allowMotionRef.current = allowMotion;
  }, [allowMotion]);

  const setLocked = useCallback(
    (locked: boolean) => {
      if (lockedRef.current === locked) return;
      lockedRef.current = locked;

      const root = document.documentElement;
      if (locked) {
        // Not `overflow: hidden` — see the note on `.scroll-locked`. Changing
        // the scrollport re-resolves the sticky frame and the balloon jumps
        // off screen at the moment the lock lands.
        root.classList.add("scroll-locked");
        lenis?.stop();
        // `passive: false` is required or the browser ignores preventDefault.
        document.addEventListener("touchmove", blockTouch, { passive: false });
      } else {
        root.classList.remove("scroll-locked");
        lenis?.start();
        document.removeEventListener("touchmove", blockTouch);
        // Re-measure: the lock changes how far the document can scroll.
        requestAnimationFrame(() => ScrollTrigger.refresh());
      }
    },
    [lenis],
  );

  const arm = useCallback(() => {
    // Read through a ref, not the render closure: turning motion off leaves a
    // window where a ScrollTrigger created a moment ago can still fire before
    // React tears it down, and that must not lock the page.
    if (!allowMotionRef.current) return;
    if (phaseRef.current !== "approach") return;
    phaseRef.current = "armed";
    setPhase("armed");
    setLocked(true);
  }, [setLocked]);

  const pop = useCallback(() => {
    if (phaseRef.current !== "armed") return;
    phaseRef.current = "popping";
    setPhase("popping");
    setBurstKey((key) => key + 1);
    if (soundOn) playPop();

    window.setTimeout(() => {
      phaseRef.current = "letter";
      setPhase("letter");
      setLocked(false);
    }, POP_DURATION);
  }, [setLocked, soundOn]);

  useEffect(() => {
    if (phase !== "armed") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // Any key pops, except keys aimed at a control the reader is operating.
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["BUTTON", "INPUT", "TEXTAREA", "SELECT", "A"].includes(target.tagName))
      ) {
        return;
      }

      event.preventDefault();
      pop();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, pop]);

  // Turning motion off mid-intro must not leave the reader trapped: the tracks
  // collapse, the balloon goes with them, and a lock with nothing to click is a
  // dead page. Only unwind if we had not already been let through.
  useEffect(() => {
    if (allowMotion) return;
    if (phaseRef.current === "armed" || phaseRef.current === "popping") {
      phaseRef.current = "approach";
      setPhase("approach");
    }
    setLocked(false);
  }, [allowMotion, setLocked]);

  // Release the lock on unmount, so a fast refresh mid-intro cannot strand the
  // page.
  useEffect(() => () => setLocked(false), [setLocked]);

  return (
    <>
      <Signature />
      <SoundToggle />
      <MotionToggle />
      <Burst runKey={burstKey} />
      <BalloonStage
        armed={phase === "armed"}
        popping={phase === "popping"}
        onArm={arm}
        onPop={pop}
      />
      <TitleSpread />
      <Letter />
    </>
  );
}

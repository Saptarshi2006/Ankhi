"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "@/lib/smooth-scroll";
import { useSoundEnabled } from "@/lib/sound-pref";
import { playPop } from "@/lib/sound";
import { TITLE_SETTLED_VH } from "@/lib/stage-ranges";
import Signature from "@/components/Signature";
import SoundToggle from "@/components/SoundToggle";
import Burst from "./Burst";
import IntroStage from "./IntroStage";
import Letter from "./Letter";

/**
 * approach — the balloon is growing (phase A)
 * armed     — grown, scroll is locked, awaiting a click or key (phase B)
 * popping   — burst playing, lock released, page gliding (phase C)
 * settled   — the reader is in control of the title and the letter (D–F)
 */
type Phase = "approach" | "armed" | "popping" | "settled";

/** How long the pop-to-title glide takes. Matches the burst settling. */
const GLIDE = 1.2;

/** How long the balloon's own pop-out tween runs, before the stage settles. */
const SETTLE = 320;

export default function Intro() {
  const lenis = useLenis();
  const soundOn = useSoundEnabled();

  const [phase, setPhase] = useState<Phase>("approach");
  const [burstKey, setBurstKey] = useState(0);

  // Mirrors `phase` for use inside callbacks and effects, which would otherwise
  // capture a stale value from the render that created them.
  const phaseRef = useRef<Phase>("approach");
  const lockedRef = useRef(false);

  const setLocked = useCallback(
    (locked: boolean) => {
      if (lockedRef.current === locked) return;
      lockedRef.current = locked;

      const root = document.documentElement;
      if (locked) {
        // Not `overflow: hidden` — that changes the document's scrollport,
        // which re-resolves every position: sticky frame, and the balloon
        // jumps off screen at the moment the lock lands.
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

    /*
     * Release the lock and glide to where the title has finished fading in, so
     * the reader never has to scroll a gap to find it. The burst plays over
     * the top of this glide, which is what removes the dead pause a fixed
     * timeout used to leave.
     *
     * `autoKill` hands control straight back the moment the reader scrolls,
     * so this assists rather than takes over.
     */
    setLocked(false);
    lenis?.scrollTo(window.innerHeight * TITLE_SETTLED_VH, {
      duration: GLIDE,
      autoKill: true,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
    });

    window.setTimeout(() => {
      phaseRef.current = "settled";
      setPhase("settled");
    }, SETTLE);
  }, [setLocked, soundOn, lenis]);

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

  // Release the lock on unmount, so a fast refresh mid-intro cannot strand the
  // page.
  useEffect(() => () => setLocked(false), [setLocked]);

  return (
    <>
      <Signature />
      <SoundToggle />
      <Burst runKey={burstKey} />
      <IntroStage
        armed={phase === "armed"}
        popping={phase === "popping"}
        popped={phase === "popping" || phase === "settled"}
        onArm={arm}
        onPop={pop}
      />
      <Letter />
    </>
  );
}

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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "@/lib/smooth-scroll";
import { useSoundEnabled } from "@/lib/sound-pref";
import { playPop } from "@/lib/sound";
import { ensureScore, getScore, releaseScore, Score } from "@/lib/music";
import { SLOT } from "@/content/music";
import { useAudioUnlock } from "@/lib/sound-unlock";
import { STAGE, TITLE_SETTLED_VH } from "@/lib/stage-ranges";
import Signature from "@/components/Signature";
import SoundToggle from "@/components/SoundToggle";
import Timeline from "@/components/timeline/Timeline";
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

/**
 * The gap the pop sits in.
 *
 * `SILENCE` is how long the music takes to be gone; `POP_AFTER` is how much
 * longer before the pop fires. Both are in seconds on the audio clock, and the
 * 10ms between them is deliberate — a pop at the exact instant the music hits
 * zero still has its tail in its ear.
 */
const SILENCE = 0.12;
const POP_AFTER = 0.13;

/** How long after the intro settles before the opening tracks are faded out. */
const HANDOVER_AT = 4200;

/**
 * How grown the balloon is, 0 to 1, straight from the scroll.
 *
 * Read directly rather than off a ScrollTrigger, because it is also needed at
 * the moment the crowd finishes loading — by which time the reader may be
 * anywhere.
 */
function growthProgress(): number {
  const span = window.innerHeight * STAGE.growthEnd;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, window.scrollY / span));
}

export default function Intro() {
  const lenis = useLenis();
  const soundOn = useSoundEnabled();

  const [phase, setPhase] = useState<Phase>("approach");
  const [burstKey, setBurstKey] = useState(0);

  // Mirrors `phase` for use inside callbacks and effects, which would otherwise
  // capture a stale value from the render that created them.
  const phaseRef = useRef<Phase>("approach");
  const lockedRef = useRef(false);
  const scoreRef = useRef<Score | null>(null);

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

    /*
     * The silence, then the pop inside it, then the music back.
     *
     * All three are scheduled against the audio clock rather than with timers,
     * which is the only way to be sure the gap is the length it claims to be.
     * A `setTimeout` between two audio events drifts by however long the main
     * thread was busy, and a pop that lands early — on the tail of the music —
     * does not land at all.
     */
    const score = scoreRef.current;
    if (soundOn && score) {
      /*
       * Gone by `silent`, the pop lands at `popAt`, and the next track is
       * handed back just after it — all three on the same clock.
       *
       * `resume` is given an explicit `from` of 0 rather than reading the gain:
       * at scheduling time the fade has not run yet, so the current value is
       * still the loud one, and using it restarts the music at full level at the
       * exact moment it was meant to return. That bug is why it is a parameter.
       */
      const silent = score.silence(SILENCE);
      const popAt = silent + POP_AFTER;
      playPop(popAt);
      score.resume(SLOT.return, popAt + 0.05, 0.9, 0.9, 0);
    } else if (soundOn) {
      playPop();
    }

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

  /*
   * Load the score, and unlock on the first gesture.
   *
   * Audio cannot start from a scroll, and the first click in this design is the
   * pop — so whether anything plays before the pop depends on the reader
   * happening to touch something first. See `sound-unlock.ts` for what that
   * trade actually means.
   */
  const unlock = useCallback(() => {
    if (!soundOn) return;
    const score = ensureScore();
    if (!score) return;

    score.setMuted(false);
    // Only the opening track is needed before the pop. The rest is fetched as
    // each beat is approached, so the first paint is not carrying a megabyte of
    // music it will not play for another minute.
    /*
     * The return and the first year are needed within seconds of this — the pop
     * can come immediately, and the timeline follows the intro. Neither was
     * being preloaded, so the pop silenced the music with nothing to bring back
     * and the first beat had no track at all.
     */
    score.preload(SLOT.return);
    score.preload(SLOT.beat0);

    void score.load(SLOT.intro).then((ok) => {
      if (!ok) return;
      /*
       * Catch up to wherever the balloon has already got to.
       *
       * The swell is driven from a scroll trigger that only fires inside the
       * growth range, so a reader who tapped late — or whose audio finished
       * loading after they had already scrolled past it — would get a track
       * that never started. Measured, on the crowd that this replaced: gain 0
       * before the pop and 0 after, having never once been non-zero.
       */
      score.play(SLOT.intro, { level: growthProgress() });
      scoreRef.current = score;
    });
  }, [soundOn]);

  useAudioUnlock(unlock, soundOn);

  useEffect(() => () => releaseScore(), []);

  // Mute follows the preference, including mid-track.
  useEffect(() => {
    scoreRef.current?.setMuted(!soundOn);
  }, [soundOn]);

  /*
   * The swell: the opening track rises with the balloon.
   *
   * `track` rather than `ramp`, because it is driven from the scroll every
   * frame and a ramp restarted each frame would lag behind the balloon it is
   * supposed to be attached to. Past `growthEnd` it holds at full and stops
   * following: from there the reader is on their own and the prompt is what
   * they are reading.
   */
  useEffect(() => {
    const stage = document.querySelector<HTMLElement>(".track-stage");
    if (!stage || !soundOn) return;

    const trigger = ScrollTrigger.create({
      trigger: stage,
      start: 0,
      end: () => Math.round(window.innerHeight * STAGE.growthEnd),
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: () => {
        const score = scoreRef.current;
        if (!score) return;
        if (phaseRef.current === "popping" || phaseRef.current === "settled") return;
        score.track(SLOT.intro, growthProgress());
      },
    });

    return () => trigger.kill();
  }, [soundOn]);

  /*
   * Hand over to the timeline.
   *
   * The timeline's own beat tracker crossfades to the first beat's track, so
   * there is nothing to do here beyond making sure the opening track is out of
   * the way by the time the section starts. It is also the moment the rest of
   * the score is worth fetching.
   */
  useEffect(() => {
    if (phase !== "settled") return;
    const id = window.setTimeout(() => {
      const score = scoreRef.current;
      if (!score) return;
      score.fadeOut(SLOT.intro, 1.2);
      score.fadeOut(SLOT.return, 1.2);
    }, HANDOVER_AT);
    return () => window.clearTimeout(id);
  }, [phase]);

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
      {/*
        The years sit between the title and the letter on purpose. The letter
        is the emotional peak; putting a lifetime of backstory after it would
        undercut it, and ending on "I don't just love having you in my life"
        with nothing following is the strongest possible close.
      */}
      <Timeline />
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

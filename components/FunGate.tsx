"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** How long the press has to be held before it lets go. */
const HOLD_MS = 900;

/** Radius and circumference of the progress ring, in the units below. */
const R = 26;
const CIRCUMFERENCE = 2 * Math.PI * R;

/**
 * The way into the fun page, and the last thing on the main page.
 *
 * A real `<a href="/fun/">` with a press-and-hold gesture layered on top, not a
 * `<div>` with a click handler. That ordering matters: without JavaScript — or
 * before it hydrates — this is still a link that goes to the right place, and a
 * screen reader announces it as a link to another page. A hold gesture built on
 * a button would work the other way round, and the reader who cannot press and
 * hold would be the one locked out.
 *
 * The hold is a delight, not a gate. Enter and Space activate it immediately,
 * because holding a key for most of a second is an unreasonable thing to ask of
 * anyone using a keyboard or a switch.
 *
 * Placed after the letter rather than inside it. The letter is the emotional
 * peak of this site and a game gate in the middle of it would be a distraction
 * from the thing being said. Down here it is a quiet offer at the end.
 */
export default function FunGate() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);

  const frameRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  // A ref, not state: the navigation has to happen inside the animation frame
  // that completes the hold, and a `setState` there would be a render between
  // the last frame of the gesture and the navigation.
  const doneRef = useRef(false);

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    startedAtRef.current = 0;
    setProgress(0);
  }, []);

  const go = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    // `push` rather than a full load: this is a sibling page of the same app,
    // so the client already has the fonts, the styles and the audio context.
    router.push("/fun/");
  }, [router]);

  useEffect(() => () => stop(), [stop]);

  // A hold that completes while the page is hidden — a backgrounded tab, a
  // locked phone — would otherwise fire on return, a long time after the finger
  // that started it lifted.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [stop]);

  const begin = useCallback(() => {
    if (doneRef.current || startedAtRef.current) return;
    startedAtRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startedAtRef.current;
      const next = Math.min(1, elapsed / HOLD_MS);
      setProgress(next);
      if (next >= 1) {
        frameRef.current = null;
        go();
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
  }, [go]);

  // Keyboard: no hold, just go. See the note above.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    go();
  };

  return (
    <footer className="grid place-items-center px-6 pb-[22vh] pt-[6vh]">
      <div className="flex flex-col items-center gap-5 text-center">
        <p className="max-w-[26ch] font-body text-[clamp(0.95rem,2.4vw,1.15rem)] leading-relaxed text-ink-muted">
          There is one more thing. It is not important.
        </p>

        <a
          href="/fun/"
          onPointerDown={(event) => {
            // Only a primary press starts a hold. A right-click opens a context
            // menu, and a second finger on a phone should not restart the ring.
            if (event.button !== 0) return;
            begin();
          }}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          onKeyDown={onKeyDown}
          onClick={(event) => {
            /*
             * Swallow every click, and navigate from the hold instead.
             *
             * This is the whole difficulty with making a hold gesture out of a
             * real link. The link's own activation is what a short press
             * triggers, so an earlier version filled the ring, ignored the
             * release, and then let the browser follow the href — a 200ms tap
             * went straight to the fun page and the gesture meant nothing.
             *
             * Preventing the default unconditionally is what makes both halves
             * true at once: too short a press does nothing, and a completed hold
             * navigates because `go` already called `router.push`. With no
             * JavaScript this handler is never attached, the click is not
             * prevented, and the link simply works.
             */
            event.preventDefault();
          }}
          onContextMenu={(event) => {
            // The gesture is meaningless with a secondary button held, and the
            // browser menu would sit on top of the ring filling.
            event.preventDefault();
          }}
          data-fun-gate
          data-progress={progress.toFixed(3)}
          className="group relative grid h-[86px] w-[86px] place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          style={{ touchAction: "none" }}
          aria-label="Hold to go somewhere else"
        >
          {/*
            The ring. `pathLength` normalises the dash maths so the same numbers
            work whatever the rendered radius, which keeps the stroke width and
            the geometry from drifting apart if the circle is ever resized.
          */}
          <svg viewBox="0 0 60 60" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
            <circle
              cx="30"
              cy="30"
              r={R}
              pathLength={CIRCUMFERENCE}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-ink/15"
            />
            <circle
              cx="30"
              cy="30"
              r={R}
              pathLength={CIRCUMFERENCE}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
              className="text-accent"
            />
          </svg>

          <span className="relative font-sans text-[0.66rem] uppercase tracking-[0.3em] text-ink-muted transition-colors group-hover:text-accent">
            Hold me
          </span>
        </a>
      </div>
    </footer>
  );
}

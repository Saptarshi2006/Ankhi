"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { funTargets } from "@/content/fun";
import { useSoundEnabled } from "@/lib/sound-pref";
import { playNet } from "@/lib/sound";
import FunViewer from "./FunViewer";

/**
 * The goal's width-to-height ratio, fixed.
 *
 * The targets are positioned as percentages of the goal box, so pinning this
 * aspect is what makes those percentages mean the same thing on every screen.
 * Left to its own devices the box would be as tall as its width allowed and the
 * formation would drift apart on a narrow viewport.
 */
const GOAL_ASPECT = 3;

/**
 * Where the ball rests, as a fraction of the ground below the goal.
 *
 * A fraction of what is left over rather than a viewport unit, so it stays put
 * whether the ground is tall or short.
 */
const SPOT_AT = 0.42;

const BALL_CLASS =
  "h-[clamp(26px,5.4vmin,46px)] w-[clamp(26px,5.4vmin,46px)] rounded-full";
const BALL_FILL =
  "radial-gradient(circle at 34% 30%, oklch(0.99 0.006 30) 0 12%, transparent 13%), radial-gradient(circle at 50% 50%, oklch(0.93 0.04 60) 0 46%, oklch(0.86 0.05 55) 46% 62%, transparent 62%)";
const BALL_SHADOW = "0 6px 18px oklch(0.28 0.045 340 / 0.28)";

/**
 * Seven targets, a goal, and a ball on the spot.
 *
 * The ball follows the pointer exactly and lands where it is released — no
 * velocity, no gravity, no power to misjudge. That is a deliberate choice about
 * what this is: the reward is the photographs, and a mechanic that could be
 * failed by flicking too hard would just be a way of not showing someone their
 * own pictures. Every one of the seven is reachable on the first or second
 * attempt, and the only thing being tested is whether the reader will.
 *
 * Which is also why every target is a real `<button>` underneath the drag. A
 * game that can only be played by dragging is a game half the people who open it
 * cannot play, and the rest of this site is careful about that. Tab to a target
 * and press Enter and it opens, exactly as a drag does.
 */
export default function FunGame() {
  const soundOn = useSoundEnabled();

  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  const [dragging, setDragging] = useState(false);
  const [ball, setBall] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const pitchRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  /*
   * The live position, mirrored out of state.
   *
   * `pointermove` runs far more often than React re-renders, and the hit test
   * on `pointerup` has to run against the position from the last move event. A
   * ref is the only thing guaranteed to be current at that moment — reading it
   * back out of state would be a frame behind, which on a fast flick is far
   * enough to miss the target the reader was clearly over.
   */
  const ballRef = useRef<{ x: number; y: number } | null>(null);

  const allGone = gone.size === funTargets.length;
  const remaining = funTargets.length - gone.size;
  const current = open ? (funTargets.find((t) => t.id === open) ?? null) : null;

  const take = useCallback(
    (id: string) => {
      setGone((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      if (soundOn) playNet();
    },
    [soundOn],
  );

  /**
   * A target is hit: it goes, and what was behind it opens.
   *
   * Both halves, together, in one place. They were separate call sites at first
   * and only the click path did the opening, which meant the drag — the
   * interaction the whole page is built around — quietly deleted the target and
   * showed nothing for it. A reward that only appears on one of the two routes
   * to the same state is a bug wearing a very convincing disguise.
   */
  const hit = useCallback(
    (id: string) => {
      take(id);
      setOpen(id);
    },
    [take],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (allGone) return;
      // Only the ball is grabbable. A press anywhere else on the pitch does
      // nothing, so a stray tap cannot pick the ball up from across the screen.
      if (!(event.target as HTMLElement).closest("[data-ball]")) return;
      event.preventDefault();
      draggingRef.current = true;
      setDragging(true);
      /*
       * Capture on the pitch, not on the ball. The pointer leaves the ball on
       * its very first move, and without capture the drag would end there
       * rather than at wherever the finger actually lifted.
       */
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [allGone],
  );

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const pitch = pitchRef.current;
    if (!pitch) return;
    const box = pitch.getBoundingClientRect();
    const next = {
      x: Math.min(Math.max(event.clientX - box.left, 0), box.width),
      y: Math.min(Math.max(event.clientY - box.top, 0), box.height),
    };
    ballRef.current = next;
    setBall(next);
  }, []);

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      const pitch = pitchRef.current;
      const point = ballRef.current;
      /*
       * Back to the spot, whether or not anything was hit.
       *
       * Clearing the ref alone is not enough and looked correct until a target
       * was actually hit: the ref drives the hit test, so it has to be empty
       * afterwards, but the rendered ball reads from state. Leaving state set
       * parked the ball on the target for the rest of the page — invisible
       * behind the viewer, and still there, halfway up the goal, once it closed.
       * One ball on one spot, so the state and the ref are cleared together.
       */
      ballRef.current = null;
      setBall(null);
      if (!pitch || !point) return;

      const origin = pitch.getBoundingClientRect();
      // The ball's centre, not its top-left corner, is what has to be inside a
      // target — the corner is outside every target you could be aiming at.
      const hitTarget = [...pitch.querySelectorAll<HTMLElement>("[data-target]")].find((el) => {
        const t = el.getBoundingClientRect();
        return (
          point.x >= t.left - origin.left &&
          point.x <= t.right - origin.left &&
          point.y >= t.top - origin.top &&
          point.y <= t.bottom - origin.top
        );
      });

      if (hitTarget?.dataset.target) hit(hitTarget.dataset.target);
    },
    [hit],
  );

  return (
    <main className="relative h-svh overflow-hidden">
      {/*
        One viewport and no page scroll. Lenis is mounted in the root layout and
        smooths the wheel everywhere on this site; giving it nothing to scroll
        removes any chance of it reading part of a drag as a scroll, and removes
        the bounce at the ends of the document.
      */}
      <div
        ref={pitchRef}
        data-fun-pitch
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative h-full w-full touch-none select-none"
        style={{ cursor: dragging ? "grabbing" : "default" }}
      >
        <p
          data-fun-count
          className="pointer-events-none absolute inset-x-0 top-[4vh] text-center font-sans text-[0.7rem] uppercase tracking-[0.34em] text-ink-muted"
        >
          {allGone ? "All seven" : `${remaining} left`}
        </p>

        {/*
          The whole pitch, as a column: goal, then everything that is meant to be
          on the ground below it.

          The first version positioned the ground with a `top` in viewport units
          and a matching constant for where the posts ended. Those two numbers
          cannot both be right — a viewport unit is aspect-dependent, so the
          ground sat under the goal on one viewport and a full target-height
          below it on another, which put the ball outside the penalty area on a
          phone. Flowing the ground from the goal instead means the join is
          structural and there is nothing left to keep in step.
        */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center pt-[9vh]">
        <div
          data-fun-goal
          className="relative w-[min(94vw,1080px)] shrink-0"
          style={{ aspectRatio: String(GOAL_ASPECT) }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-t-[4px] border-[3px] border-b-0 border-ink/70"
            style={{
              backgroundImage: [
                "repeating-linear-gradient(0deg, transparent 0 10px, oklch(0.28 0.045 340 / 0.22) 10px 11px)",
                "repeating-linear-gradient(90deg, transparent 0 10px, oklch(0.28 0.045 340 / 0.22) 10px 11px)",
              ].join(", "),
            }}
          />

          {funTargets
            .filter((target) => !gone.has(target.id))
            .map((target) => (
              <button
                key={target.id}
                type="button"
                data-target={target.id}
                onClick={() => hit(target.id)}
                style={{ left: `${target.left}%`, top: `${target.top}%` }}
                className="pointer-events-auto absolute grid h-[clamp(40px,9vmin,74px)] w-[clamp(40px,9vmin,74px)] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                aria-label={`Open ${target.alt}`}
              >
                <span className="sr-only">{target.alt}</span>
                {/* The bullseye. Decorative; the accessible name is the alt. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full border-2 border-ink/60"
                  style={{
                    backgroundImage: [
                      "radial-gradient(circle at 50% 50%, oklch(0.68 0.135 15 / 0.85) 0 14%, transparent 15%)",
                      "radial-gradient(circle at 50% 50%, transparent 0 32%, oklch(0.68 0.135 15 / 0.5) 32% 40%, transparent 40%)",
                      "radial-gradient(circle at 50% 50%, transparent 0 62%, oklch(0.28 0.045 340 / 0.35) 62% 68%, transparent 68%)",
                      "linear-gradient(oklch(0.99 0.006 30 / 0.75), oklch(0.99 0.006 30 / 0.75))",
                    ].join(", "),
                  }}
                />
              </button>
            ))}
        </div>

        {/*
          The ground, the penalty area, and the spot — in flow, directly under
          the posts.

          The box exists to say "penalty" rather than "shooting range". A goal and
          a ball on a bare background is a guessing game with no rules on screen,
          and the one instruction this page gives is that the ball starts on the
          penalty spot. Drawing the area *is* the instruction.
        */}
        <div
          data-fun-ground
          className="relative min-h-0 w-full flex-1"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, oklch(0.28 0.045 340 / 0.02), oklch(0.28 0.045 340 / 0.06))",
          }}
        >
          <div
            data-fun-box
            aria-hidden="true"
            className="absolute inset-x-0 top-0 mx-auto h-[62%] w-[min(62vw,520px)] border-x border-b border-ink/25"
          />

          {/*
            The resting ball is the drag handle, so it re-enables pointer events
            that the pitch column switched off. It lives in flow rather than
            being positioned, which is what keeps it on the spot at every aspect
            ratio without a constant to maintain.
          */}
          {!ball && (
            <div
              className="pointer-events-auto absolute inset-x-0 -translate-y-1/2"
              style={{ top: `${SPOT_AT * 100}%` }}
            >
              <div
                data-ball
                data-dragging="false"
                className={`mx-auto ${BALL_CLASS}`}
                style={{ backgroundImage: BALL_FILL, boxShadow: BALL_SHADOW }}
              />
            </div>
          )}
        </div>
        </div>

        {/*
          The dragged ball is the one thing that cannot be in flow: its position
          comes from the pointer in pitch coordinates, so it is a direct child of
          the pitch. Everything else on this page is placed relative to the goal.
        */}
        {ball && (
          <div
            data-ball
            data-dragging="true"
            className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 ${BALL_CLASS}`}
            style={{ left: ball.x, top: ball.y, backgroundImage: BALL_FILL, boxShadow: BALL_SHADOW }}
          />
        )}

        {allGone && (
          <div
            data-fun-done
            className="absolute inset-x-0 bottom-[8vh] flex flex-col items-center gap-3 px-6 text-center"
          >
            <p className="font-body text-[clamp(1rem,2.6vw,1.2rem)] text-ink">
              That is all of them.
            </p>
            <Link
              href="/"
              className="font-sans text-[0.7rem] uppercase tracking-[0.34em] text-ink-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              Back to the beginning
            </Link>
          </div>
        )}
      </div>

      {current && <FunViewer target={current} onClose={() => setOpen(null)} />}
    </main>
  );
}

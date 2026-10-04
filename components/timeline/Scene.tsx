"use client";

import { useRef, type CSSProperties, type ReactElement } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { Beat, Clip, Photo } from "@/content/years";
import {
  SCREENS_PER_BEAT,
  STAGES,
  STAGE,
  stageOffset,
  stageRange,
} from "@/lib/timeline-scroll";
import Quadrants from "./Quadrants";

gsap.registerPlugin(ScrollTrigger);

/**
 * One beat, as a scene rather than a panel.
 *
 * A beat is no longer a card that slides past. It is a short film scrubbed by
 * scroll: the title surfaces, a curtain crosses, the year stands alone, the
 * year leaves, the turn is spoken, four photographs arrive from the sides, and
 * one image pushes out of the middle. The takeover that follows is a separate
 * component, because it has to escape the track to cover the screen.
 *
 * All nine stages live in one timeline whose timebase is *screens of scroll* —
 * one unit is one viewport of scrolling — so a stage's position in the timeline
 * and its position on the page are the same number. The trigger scrubs that
 * timeline across exactly this beat's range, which keeps each beat independent:
 * six small timelines rather than one 48-segment thing that is miserable to
 * reason about.
 */
export default function Scene({
  beat,
  index,
  filter,
}: {
  beat: Beat;
  index: number;
  filter?: string;
}): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      const section = root?.closest("[data-timeline]");
      if (!root || !section) return;

      const q = <T extends Element>(sel: string) => root.querySelectorAll<T>(sel);
      const title = q<HTMLElement>("[data-s-title]")[0];
      /*
       * The curtain lives outside this panel, beside the track, so that it can
       * actually cover the page. See `Curtain`.
       */
      const slab = root
        .closest(".timeline-viewport")
        ?.querySelector<HTMLElement>(`[data-curtain-for="${index}"] [data-curtain-slab]`);
      const words = q<HTMLElement>("[data-s-words]")[0];
      const turn = q<HTMLElement>("[data-s-turn]")[0];
      // The media box, not the full-panel slot around it: this is both what
      // scales up out of the middle and what the takeover is handed as its
      // starting rect.
      const hero = q<HTMLElement>("[data-hero]")[0];
      const quads = q<HTMLElement>("[data-quad]");

      /*
       * `words` is deliberately not in here.
       *
       * `herWords` is optional — five of the six beats have one, the first has
       * none — so requiring the element makes this guard return early for that
       * beat, which means no timeline at all: no stages, no curtain sweep, and
       * the curtain left standing in the middle of the page for the rest of the
       * site, because an unrendered slab has no transform and `translateX(0)`
       * is dead centre. The first beat on the page rendered nothing.
       */
      if (!title || !slab || !turn || !hero) return;

      // Position within this beat, in screens. `stageOffset(0, n)` is the same
      // arithmetic with the beat index zeroed out.
      const at = (stage: number, off = 0) => stageOffset(0, stage) + off;
      const dur = (stage: number) => STAGES[stage].screens;

      const tl = gsap.timeline({ paused: true });

      /*
       * Stage 1 — the title arrives out of the middle.
       *
       * Scaled from well below 1 with the origin at its centre, so it grows out
       * of the point it occupies rather than sliding in from an edge. A reader
       * who is mid-scroll still gets the whole entrance.
       */
      tl.fromTo(
        title,
        { autoAlpha: 0, scale: 0.55, y: 26 },
        { autoAlpha: 1, scale: 1, y: 0, duration: dur(STAGE.title), ease: "power2.out" },
        at(STAGE.title),
      );

      /*
       * Stage 2 — the curtain.
       *
       * One tween on the slab, because the lit leading edge and the trailing
       * fade are its children and travel with it. Two tweens on three elements
       * that are always in the same place is three chances to desync.
       *
       * The title is dismissed a third of the way in, so it is fully covered
       * before the slab starts to leave and the turn is revealed.
       */
      const half = dur(STAGE.curtain) / 2;

      /*
       * Visible for the sweep and not one frame longer.
       *
       * `set` rather than a tween, on purpose. The curtain's resting state is
       * `visibility: hidden` in CSS, and the only thing that can put it on
       * screen is these two assignments — so the invariant "ink is only ever on
       * screen while it is crossing" is structural rather than a thing that has
       * to go on being true about where a tween happens to leave a transform.
       */
      tl.set(slab, { visibility: "visible" }, at(STAGE.curtain));
      tl.set(slab.parentElement as HTMLElement, { visibility: "visible" }, at(STAGE.curtain));
      tl.set(slab.parentElement as HTMLElement, { visibility: "hidden" }, at(STAGE.curtain) + half * 2);
      tl.set(slab, { visibility: "hidden" }, at(STAGE.curtain) + half * 2);

      tl.to(title, { autoAlpha: 0, duration: half * 0.6, ease: "power1.in" }, at(STAGE.curtain));
      tl.fromTo(
        slab,
        { xPercent: -100 },
        { xPercent: 0, duration: half, ease: "power2.in" },
        at(STAGE.curtain),
      );
      tl.to(slab, { xPercent: 100, duration: half, ease: "power2.out" }, at(STAGE.curtain) + half);

      /*
       * Stage 3 — the turn, alone in the middle, and then her answering it.
       *
       * One stage, two arrivals, because they are one thought: what I noticed,
       * and what she said back. Her line lands after mine rather than beside it,
       * so the eye has finished the first before the second starts — and because
       * it is the last thing in the beat before the photographs, it is the line
       * the reader is still looking at when they have to move on.
       *
       * The timings are back-loaded to leave a hold. The first version ran the
       * turn over half the stage and her line over 45% of what was left, so the
       * pair was only both-settled over the last 5% — about 4px of scroll. It
       * was on screen and unreadable. Finishing by 70% leaves the last 30% of the
       * stage, roughly a third of a screen, with both lines still and legible,
       * which is the entire reason the stage grew.
       *
       * This is where the two year stages went. They were 0.55 screens spent
       * printing a number and taking it away, and the beat is exactly as long as
       * it was; the scroll is now spent on words instead.
       */
      const turnDur = dur(STAGE.turn);
      tl.fromTo(
        turn,
        { autoAlpha: 0, y: 22 },
        { autoAlpha: 1, y: 0, duration: turnDur * 0.35, ease: "power2.out" },
        at(STAGE.turn),
      );
      if (words) {
        tl.fromTo(
          words,
          { autoAlpha: 0, y: 16 },
          { autoAlpha: 1, y: 0, duration: turnDur * 0.3, ease: "power2.out" },
          at(STAGE.turn, turnDur * 0.4),
        );
      }

      /*
       * Stage 4 — four photographs, two from the left and two from the right.
       *
       * The small stagger is what makes them read as arriving rather than
       * existing: perfectly simultaneous motion looks like a state change, and
       * a cascade looks like four objects being thrown.
       */
      const qd = dur(STAGE.quads);
      const arrival: [Element | undefined, number, number][] = [
        [quads[0], -1, 0],
        [quads[1], -1, 0.05],
        [quads[2], 1, 0.08],
        [quads[3], 1, 0.13],
      ];
      for (const [el, dir, delay] of arrival) {
        if (!el) continue;
        tl.fromTo(
          el,
          { autoAlpha: 0, x: dir * 80, scale: 0.88 },
          /*
           * `qd * 0.55`, not `qd * 0.8`. The last photograph starts a seventh of
           * a screen late, so at 0.8 it was still flying in when the stage ended
           * and the hero began — the four were never all settled at once, and
           * the stage read as muddled rather than as an arrival.
           */
          { autoAlpha: 1, x: 0, scale: 1, duration: qd * 0.55, ease: "power3.out" },
          at(STAGE.quads, delay),
        );
      }

      /*
       * Stage 5 — the hero pushes out of the middle.
       *
       * The turn recedes rather than vanishing, and the photographs dim to a
       * third rather than leaving, so the frame still has depth behind the
       * image instead of emptying out the instant the interesting thing arrives.
       */
      tl.fromTo(
        hero,
        { autoAlpha: 0, scale: 0.3 },
        { autoAlpha: 1, scale: 1, duration: dur(STAGE.hero), ease: "power2.out" },
        at(STAGE.hero),
      );
      tl.to(
        words ? [turn, words] : turn,
        { autoAlpha: 0, scale: 0.9, duration: dur(STAGE.hero) * 0.55 },
        at(STAGE.hero),
      );
      tl.to(quads, { autoAlpha: 0.3, scale: 0.94, duration: dur(STAGE.hero) }, at(STAGE.hero) + 0.08);

      /*
       * Stage 6 — the takeover.
       *
       * The panel's own contents are cleared as the overlay arrives, so nothing
       * can show through its edges during the grow, and the panel underneath is
       * already empty when the overlay lifts.
       */
      tl.to([turn, title, ...(words ? [words] : [])], { autoAlpha: 0, duration: 0.08 }, at(STAGE.full));
      tl.to(quads, { autoAlpha: 0, scale: 0.9, duration: 0.16 }, at(STAGE.full));

      /*
       * A timeline's duration is wherever its last tween happens to end, which
       * here is a third of a screen short of the beat. ScrollTrigger maps the
       * scroll range onto the whole timeline, so a short timeline makes every
       * stage land proportionally early — and the last stage ends up past the
       * point the reader can reach. An empty `set` at the beat's full length is
       * the cheapest way to say "this timeline is exactly one beat long", which
       * is what keeps one unit meaning one screen of scroll.
       */
      tl.set(turn, {}, SCREENS_PER_BEAT);

      const trigger = ScrollTrigger.create({
        trigger: section,
        start: () => stageRange(section, index, 0).start,
        end: () => stageRange(section, index, 0).start + Math.round(SCREENS_PER_BEAT * window.innerHeight),
        scrub: 0.35,
        invalidateOnRefresh: true,
        animation: tl,
        onRefresh: (self) => {
          /*
           * Publish this beat's geometry: the scroll range it occupies, and
           * where each stage sits inside it. Three reasons — a reader debugging
           * a stuck scene can read the numbers in devtools, and the tests need
           * somewhere precise to look. They used to sample by guesswork, and now
           * that a beat is nearly four screens long and the curtain inside it is
           * a third of a screen, a guess either lands in the wrong beat or
           * misses the curtain entirely.
           *
           * Publishing it also means the stage table stays in one place. A test
           * that hardcoded the same numbers would pass while the design drifted
           * and fail when it was right.
           */
          root.dataset.sceneStart = String(Math.round(self.start));
          root.dataset.sceneEnd = String(Math.round(self.end));
          root.dataset.stageOffsets = STAGES.map((_, i) => stageOffset(0, i)).join(",");
          root.dataset.stageScreens = STAGES.map((st) => st.screens).join(",");
          root.dataset.stageKeys = STAGES.map((st) => st.key).join(",");
        },
        onUpdate: (self) => {
          /*
           * The hero's clip is fetched when its beat reaches the photographs,
           * not at page load: six clips the reader has not reached yet is
           * several megabytes of bandwidth spent on a guess.
           *
           * `data-taken-over` is the takeover claiming playback. Without the
           * handover, this and the takeover would both see "should be playing"
           * and between them keep the panel's decoder alive underneath the
           * overlay — two decoders for one clip, and a phone that notices.
           */
          const video = hero.querySelector<HTMLVideoElement>("video");
          if (!video || hero.dataset.takenOver === "true") return;

          const wanted = self.progress * SCREENS_PER_BEAT >= stageOffset(0, STAGE.quads);
          if (wanted && video.paused) {
            if (video.networkState === video.NETWORK_EMPTY) video.load();
            video.play().catch(() => {});
          } else if (!wanted && !video.paused) {
            video.pause();
          }
        },
      });

      return () => {
        trigger.kill();
        tl.kill();
      };
    },
    { scope: rootRef },
  );

  const duotone = filter ? ({ filter } as CSSProperties) : undefined;
  const clip: Clip | undefined = beat.clip;
  const heroPhoto: Photo | undefined = beat.photos[0];

  return (
    <div ref={rootRef} data-scene={index} className="relative h-full w-full">
      {/*
        Stage 1. The title is the reader's first sight of the year, so it is the
        only thing on screen while it arrives.
      */}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-[8vw]">
        <h2
          data-s-title
          className="max-w-[16ch] text-center font-display text-[clamp(2.1rem,7vw,4.6rem)] leading-[1.05] text-ink"
        >
          {beat.title}
        </h2>
      </div>

      {/*
        Stage 3. The turn, and then her answer to it.

        Wider and a step smaller than it was: the copy is three sentences now
        rather than one, and at the old measure and size it wrapped into a wall
        that filled the frame edge to edge and left the photographs nowhere to
        land. 34ch is roughly where a line stops being a comfortable read and
        starts being a list.

        `will-change` is left off both — the transforms are scrubbed for the
        whole timeline, and promoting them up front costs a compositor layer per
        panel for a transform that is usually sitting at identity.
      */}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-[clamp(0.9rem,2.4vh,1.6rem)] px-[8vw]">
        <p
          data-s-turn
          className="max-w-[34ch] text-center font-body text-[clamp(1.05rem,2.5vw,1.6rem)] leading-[1.5] text-ink"
        >
          {beat.turn}
        </p>
        {beat.herWords && (
          /*
            Her line, in her voice, set apart from mine. Italic and a size down
            so it reads as a quotation rather than as a second paragraph of the
            same thing — and the quotation marks are in the content, not added
            here, so the string is the string wherever else it is used.
          */
          <p
            data-s-words
            className="max-w-[30ch] text-center font-body text-[clamp(0.95rem,2.1vw,1.25rem)] leading-[1.55] italic text-ink-muted"
          >
            {beat.herWords}
          </p>
        )}
      </div>

      <Quadrants photos={beat.photos} filter={filter} />

      {/*
        Stage 7. Sits above the turn and the photographs because it arrives last
        and has to win. The same box the takeover hands its rect to, so the two
        are the same pixels at the moment of handover.
      */}
      <div
        data-hero-slot
        className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
      >
        {clip ? (
          <div
            data-hero
            className="relative aspect-video w-[min(52vw,58vmin)] overflow-hidden rounded-sm bg-ink/5"
          >
            <video
              className="absolute inset-0 h-full w-full object-cover"
              style={duotone}
              poster={`/videos/${clip.id}.jpg`}
              muted
              loop
              playsInline
              preload="none"
              aria-label={`Video from ${beat.title}`}
            >
              <source src={`/videos/${clip.id}-480.mp4`} type="video/mp4" media="(max-width: 900px)" />
              <source src={`/videos/${clip.id}-720.mp4`} type="video/mp4" />
            </video>
          </div>
        ) : heroPhoto ? (
          <img
            data-hero
            src={`/photos/${heroPhoto.id}-1200.webp`}
            alt={heroPhoto.alt}
            width={heroPhoto.width}
            height={heroPhoto.height}
            className="aspect-[3/2] w-[min(48vw,54vmin)] rounded-sm object-cover"
            style={duotone}
          />
        ) : null}
      </div>
    </div>
  );
}

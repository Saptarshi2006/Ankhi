"use client";

import { useRef, type CSSProperties, type ReactElement } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { Beat, Clip, Photo } from "@/content/years";
import { beats } from "@/content/years";
import { STAGES, STAGE, sectionRange, stageRange } from "@/lib/timeline-scroll";

gsap.registerPlugin(ScrollTrigger);

/**
 * The last stage of a beat: the hero image takes the whole screen.
 *
 * This has to live outside the track, and that is not a style preference. The
 * track is transformed, clipped and masked, and a `position: fixed` element
 * under a transformed ancestor is anchored to *that ancestor*, not the
 * viewport. A takeover built inside the track would slide sideways with the
 * panels and disappear under the track's mask. So this is a sibling of the
 * track, in viewport coordinates, and it is handed the hero's live rect on
 * entry.
 *
 * Because the overlay begins at exactly the rect the hero already occupies, the
 * handover is invisible — one continuous image growing, rather than two images
 * and a jump.
 *
 * It then holds full screen across the following beat's travel, while the track
 * slides underneath, and lifts over the last of that travel as the next year
 * surfaces. That is what stops the transition between beats from being visible
 * as a slide of full-screen panels.
 *
 * The whole thing is one pure function of progress. An earlier version kept a
 * `live` flag and relied on `onLeave` to release the overlay, and because
 * nothing resets a trigger once it is entirely behind the scroll, they
 * accumulated: by the last beat, five full-screen overlays were stacked over
 * the page. Every event now routes into the same `paint`, which writes every
 * property on every call, so there is no state to get stuck.
 */
export default function Takeover({
  beat,
  index,
  filter,
}: {
  beat: Beat;
  index: number;
  filter?: string;
}): ReactElement {
  const overlayRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLVideoElement>(null);
  /** The hero's rect at the instant the takeover was armed. */
  const from = useRef<{ l: number; t: number; w: number; h: number } | null>(null);

  const duotone = filter ? ({ filter } as CSSProperties) : undefined;
  const clip: Clip | undefined = beat.clip;

  useGSAP(
    () => {
      const overlay = overlayRef.current;
      const section = overlay?.closest("[data-timeline]");
      if (!overlay || !section) return;

      const heroEl = () =>
        section.querySelector<HTMLElement>(`[data-beat="${index}"] [data-hero]`);

      const hide = () => {
        overlay.style.opacity = "0";
        overlay.style.visibility = "hidden";
      };

      const reset = () => {
        from.current = null;
        hide();
      };

      const arm = () => {
        const el = heroEl();
        if (!el || from.current) return;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        from.current = { l: r.left, t: r.top, w: r.width, h: r.height };

        /*
         * Hand playback over rather than running two decoders on the same clip.
         * On a phone that is a visible cost, and two copies drift out of step.
         */
        const panel = el.querySelector<HTMLVideoElement>("video");
        if (panel && mediaRef.current) {
          if (panel.readyState >= 1) mediaRef.current.currentTime = panel.currentTime;
          mediaRef.current.play().catch(() => {});
          el.dataset.takenOver = "true";
          panel.pause();
        }
      };

      const release = () => {
        const el = heroEl();
        if (!el) return;
        delete el.dataset.takenOver;
        el.querySelector<HTMLVideoElement>("video")?.play().catch(() => {});
        mediaRef.current?.pause();
      };

      const paint = (progress: number) => {
        if (progress <= 0 || progress >= 1) {
          if (from.current) release();
          reset();
          return;
        }

        const full = stageRange(section, index, STAGE.full);
        const next = beats[index + 1];
        const end = next
          ? stageRange(section, index + 1, STAGE.title).start
          : sectionRange(section).end;
        const span = end - full.start;
        if (span <= 0) return reset();

        const travel = STAGES[STAGE.travel].screens * window.innerHeight;
        /* Grow through the full stage... */
        const holdAt = (full.end - full.start) / span;
        /*
         * ...hold through the first half of the next beat's travel, then lift
         * over the second half. Lifting across the whole travel would leave the
         * overlay still fading as the next year was already arriving, and
         * holding to the very end would leave no room to fade at all.
         */
        const liftFrom = Math.min(1, holdAt + (travel * 0.5) / span);

        overlay.style.visibility = "visible";

        if (progress < holdAt) {
          arm();
          if (!from.current) return hide();

          // Decelerating into full screen, so it reads as a push rather than
          // arriving flat.
          const t = easeInOut(progress / holdAt);
          const vw = window.innerWidth;
          const vh = window.innerHeight;

          /*
           * `inset` first. It is a shorthand for top/right/bottom/left, so
           * assigning it after left/top silently resets both and the overlay
           * drops to its static position — a full viewport below where it
           * belongs, which is exactly what a grow that appears to begin
           * off-screen is.
           */
          overlay.style.inset = "auto";
          overlay.style.left = `${from.current.l + (0 - from.current.l) * t}px`;
          overlay.style.top = `${from.current.t + (0 - from.current.t) * t}px`;
          overlay.style.width = `${from.current.w + (vw - from.current.w) * t}px`;
          overlay.style.height = `${from.current.h + (vh - from.current.h) * t}px`;
          /*
           * Opaque almost immediately. The overlay is sitting exactly on top
           * of the hero for the first instant, so a slow fade-in is not a
           * crossfade at all — it is a translucent full-screen image with the
           * rail showing through it, which reads as a bug. By the time it is
           * clear the grow has barely begun.
           */
          overlay.style.opacity = String(Math.min(1, progress / (holdAt * 0.2)));
          return;
        }

        overlay.style.inset = "auto";
        overlay.style.left = "0px";
        overlay.style.top = "0px";
        overlay.style.width = "100vw";
        overlay.style.height = "100vh";
        overlay.style.opacity =
          progress > liftFrom
            ? String(1 - (progress - liftFrom) / Math.max(0.0001, 1 - liftFrom))
            : "1";
      };

      const trigger = ScrollTrigger.create({
        trigger: section,
        start: () => stageRange(section, index, STAGE.full).start,
        /*
         * The overlay outlives its own stage: it has to still be full screen
         * while the track travels to the next beat underneath it, so its range
         * runs to that beat's title rather than to the end of the full stage.
         */
        end: () => {
          const next = beats[index + 1];
          return next
            ? stageRange(section, index + 1, STAGE.title).start
            : sectionRange(section).end;
        },
        scrub: true,
        invalidateOnRefresh: true,
        /*
         * Only these four. `onEnter` and `onEnterBack` look like they belong
         * here and cost an afternoon: ScrollTrigger fires them *after*
         * `onUpdate` in the same tick, so `paint(0)` on the way in overwrote the
         * correct frame and left the overlay hidden — reproducibly, but only
         * when the scroll arrived by a jump rather than a gesture, which is why
         * it survived every manual check. Entering the range is already a
         * progress change from 0, so `onUpdate` covers it.
         */
        onUpdate: (self) => paint(self.progress),
        onRefresh: (self) => paint(self.progress),
        onLeave: () => paint(1),
        onLeaveBack: () => paint(0),
      });

      reset();
      return () => {
        release();
        trigger.kill();
        reset();
      };
    },
    { scope: overlayRef },
  );

  return (
    <div
      ref={overlayRef}
      data-takeover
      data-takeover-beat={index}
      aria-hidden="true"
      className="pointer-events-none fixed z-50 overflow-hidden"
      style={{
        // Inherits the liquid's colour, so the journey to the next beat carries
        // on behind the full-screen image instead of stopping dead.
        background: "var(--timeline-bg, #fdf2f0)",
        opacity: 0,
        visibility: "hidden",
        left: 0,
        top: 0,
        width: "100vw",
        height: "100vh",
        willChange: "transform, opacity",
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {clip ? (
          <video
            ref={mediaRef}
            className="h-full w-full object-cover"
            style={duotone}
            poster={`/videos/${clip.id}.jpg`}
            muted
            loop
            playsInline
            preload="metadata"
          >
            <source src={`/videos/${clip.id}-480.mp4`} type="video/mp4" media="(max-width: 900px)" />
            <source src={`/videos/${clip.id}-720.mp4`} type="video/mp4" />
          </video>
        ) : (
          beat.photos[0] && (
            <img
              src={`/photos/${(beat.photos[0] as Photo).id}-1200.webp`}
              alt=""
              aria-hidden="true"
              width={beat.photos[0].width}
              height={beat.photos[0].height}
              className="h-full w-full object-cover"
              style={duotone}
            />
          )
        )}
      </div>
    </div>
  );
}

/** Matches the CSS `power2.inOut`, so the JS and CSS paths agree on the curve. */
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

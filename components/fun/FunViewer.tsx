"use client";

import { useEffect, useRef } from "react";
import type { FunTarget } from "@/content/fun";

/**
 * One piece of media, full screen, after a target is hit.
 *
 * Everything here is `object-contain` over a blurred backdrop rather than
 * `object-cover`. Four of the seven are portrait phone video and three are
 * landscape or square photographs, so they have three different aspects between
 * them and the frame they are shown in has a fourth. Cropping to fill would cut
 * the top off someone's face in at least one case; fitting the whole thing and
 * filling the remainder with a blurred copy of itself is the only version where
 * nothing is ever cropped.
 *
 * The backdrop is a pre-blurred JPEG written by the encoder, not a CSS
 * `filter: blur()` on a second copy of the image. One is a file that costs
 * nothing to paint, the other is a full-viewport blur recomputed on every frame
 * the dialog is open — and this site has already decided once, in the timeline,
 * that a runtime blur is the one effect that would cost frames on a phone.
 *
 * No unmute control, and the videos carry no audio at all: `encode-videos.mjs`
 * strips it. The sound in those clips was deliberately not shipped, so there is
 * nothing here to offer the reader.
 */
export default function FunViewer({
  target,
  onClose,
}: {
  target: FunTarget;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  /*
   * Play it, rather than trusting `autoPlay`.
   *
   * An `autoPlay` attribute on a `<video>` with `<source>` children does not
   * reliably start playback in WebKit — it was muted and paused, not muted and
   * playing, so the reward for hitting the target was a still frame. Driving
   * `play()` from an effect is what actually works, and the same thing
   * `Takeover` does for the timeline clips.
   *
   * The rejection is swallowed on purpose. It fires when the dialog is closed
   * before the video has buffered, and in that case there is nothing to report
   * and nothing to retry — the reader has already moved on.
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch(() => {});
    return () => {
      video.pause();
    };
  }, []);

  // Escape closes, and focus arrives on the close button so the dialog is
  // usable from the keyboard the moment it opens.
  useEffect(() => {
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      /*
       * A minimal focus trap. Not `focus-lock`, which would be another
       * dependency for two keys of behaviour: the dialog holds exactly one
       * button and whatever the media is, and Tab has to stay inside both.
       */
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>("button, [href]");
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const isVideo = target.kind === "video";

  return (
    <div
      data-fun-viewer
      className="fixed inset-0 z-50 grid place-items-center bg-ink/92 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={target.alt}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="relative flex max-h-full max-w-full flex-col items-center gap-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative flex max-h-[min(84svh,760px)] max-w-full items-center justify-center overflow-hidden rounded-sm">
          {isVideo ? (
            <>
              {/*
                The backdrop sits absolutely behind the video and is sized to
                the frame rather than to the video, so it covers the full
                viewport whatever shape the clip is.
              */}
              <img
                src={`/videos/${target.media}-bg.jpg`}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
              />
              <video
                ref={videoRef}
                data-fun-video
                className="relative max-h-[min(84svh,760px)] max-w-full object-contain"
                poster={`/videos/${target.media}.jpg`}
                muted
                loop
                playsInline
                preload="auto"
                aria-label={target.alt}
              >
                <source src={`/videos/${target.media}-480.mp4`} type="video/mp4" media="(max-width: 900px)" />
                <source src={`/videos/${target.media}-720.mp4`} type="video/mp4" />
              </video>
            </>
          ) : (
            <img
              data-fun-image
              src={`/photos/${target.media}-1200.webp`}
              alt={target.alt}
              width={target.width}
              height={target.height}
              className="relative max-h-[min(84svh,760px)] max-w-full object-contain"
            />
          )}
        </div>

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          data-fun-close
          className="font-sans text-[0.68rem] uppercase tracking-[0.34em] text-ink-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          Close
        </button>
      </div>
    </div>
  );
}

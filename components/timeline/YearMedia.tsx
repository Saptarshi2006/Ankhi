"use client";

/*
 * Plain <img>, not next/image, on purpose.
 *
 * `output: "export"` disables Next's optimiser entirely, so next/image would
 * degrade to a plain img with a srcset built from the *original* source — and
 * it has no way to serve the 480/768/1200/1600 WebP set that
 * scripts/optimize-images.mjs already produced. Using it would mean shipping
 * unoptimised originals, which is the exact problem the pipeline exists to
 * solve.
 */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Clip, Photo } from "@/content/years";

/**
 * A beat's media: the clip as the hero, the photographs as a filmstrip beneath.
 *
 * The filmstrip rather than a grid is deliberate. A panel is about 60vw wide on
 * desktop, so four photos in a grid would be roughly 380px each and a quarter
 * as tall — too small to look at. Read as a strip they are clearly meant to be
 * glanced at rather than examined, which is the right weight for supporting
 * detail next to a clip that is already doing the work.
 *
 * There is no tap-to-swap between them on purpose: nested interaction inside
 * a horizontal scroller is hostile, because you cannot tap while swiping.
 */
export default function YearMedia({
  photos,
  clip,
  filter,
  priority,
}: {
  photos: Photo[];
  clip?: Clip;
  /** CSS `filter` value, or undefined for the one beat in full colour. */
  filter?: string;
  priority?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  /**
   * Load only when the panel is close, and play only while it is actually on
   * screen.
   *
   * Six simultaneous decodes inside a pinned scroller will stutter on a phone,
   * and pulling ~9MB of video for panels the reader may never reach is the
   * whole problem the trim points exist to avoid.
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !clip) return;

    const arm = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !video.src) {
            video.load();
          }
        }
      },
      { rootMargin: "150% 0px" },
    );

    const play = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void video.play().catch(() => {
              // Autoplay can be refused. The poster stays, which is a fine
              // fallback — a poster of a moment is still the moment.
            });
          } else {
            video.pause();
          }
        }
      },
      // A generous threshold: start slightly late, stop slightly early, so
      // playback tracks what the reader is actually looking at.
      { threshold: 0.45 },
    );

    arm.observe(video);
    play.observe(video);
    return () => {
      arm.disconnect();
      play.disconnect();
    };
  }, [clip]);

  const hero = photos[0];
  const strip = photos.slice(1);

  /*
   * A duotone is applied as an SVG filter reference, `filter: url(#duotone-n)`.
   * That is valid CSS and works on HTML elements, but React 19 narrowed
   * `CSSProperties` so an arbitrary `url()` no longer type-checks. The cast is
   * the narrowest way through; the alternative is dropping the duotone, which
   * is the entire point.
   */
  const duotone = filter ? ({ filter } as CSSProperties) : undefined;

  return (
    <div className="flex w-full flex-col gap-4">
      {clip ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-sm bg-ink/5">
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            style={duotone}
            poster={`/videos/${clip.id}.jpg`}
            muted
            loop
            playsInline
            preload={priority ? "auto" : "none"}
            onCanPlay={() => setReady(true)}
            aria-label={`Video from age ${photos.length}`}
          >
            {/*
              `media` on <source> is how the rendition is chosen, and it is
              evaluated before download, so a phone never fetches the 720p
              file. Order matters: the browser takes the first match.
            */}
            <source src={`/videos/${clip.id}-480.mp4`} type="video/mp4" media="(max-width: 900px)" />
            <source src={`/videos/${clip.id}-720.mp4`} type="video/mp4" />
          </video>
          {!ready && (
            <span className="absolute bottom-3 right-3 rounded-full bg-ink/40 px-2 py-1 font-sans text-[0.6rem] uppercase tracking-[0.2em] text-surface/90">
              Loading
            </span>
          )}
        </div>
      ) : hero ? (
        <img
          src={`/photos/${hero.id}-1200.webp`}
          alt={hero.alt}
          width={hero.width}
          height={hero.height}
          style={duotone}
          className="aspect-[3/2] w-full rounded-sm object-cover"
        />
      ) : null}

      {strip.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-3">
          {strip.map((photo) => (
            <li key={photo.id}>
              <img
                src={`/photos/${photo.id}-480.webp`}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                loading="lazy"
                decoding="async"
                style={duotone}
                className="aspect-[3/2] w-full rounded-sm object-cover"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

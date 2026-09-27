import type { ReactElement } from "react";
import type { Photo } from "@/content/years";

/**
 * The four photographs, arriving from the sides into a 2x2 arrangement.
 *
 * Positioned in the four corners rather than laid out as a centred grid with a
 * gap, because the middle of the frame has to stay clear: the turn text holds
 * it, and then the hero pushes out of it. A grid would have put its own gap
 * exactly where the composition is meant to be empty.
 *
 * Photos 0 and 1 fly in from the left, 2 and 3 from the right, so the four
 * arrive in two pairs and the movement is legible as a direction rather than as
 * four unrelated objects appearing.
 */
export default function Quadrants({
  photos,
  filter,
}: {
  photos: Photo[];
  /** CSS `filter` value, or undefined for the one beat in full colour. */
  filter?: string;
}): ReactElement {
  const shown = photos.slice(0, 4);

  return (
    <div data-quads className="pointer-events-none absolute inset-0 z-10">
      {shown.map((photo, i) => (
        <div
          data-quad={i}
          key={photo.id}
          className="overflow-hidden rounded-[2px] will-change-transform"
        >
          {/*
            Real alt text, not empty. These four are the memory of the beat, and
            a screen-reader user gets the same four pictures the reader sees —
            the hero is the clip, so nothing here is announced twice.
          */}
          <img
            src={`/photos/${photo.id}-1200.webp`}
            alt={photo.alt}
            width={photo.width}
            height={photo.height}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            style={filter ? { filter } : undefined}
          />
        </div>
      ))}
    </div>
  );
}

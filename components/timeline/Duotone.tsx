"use client";

import { beats } from "@/content/years";
import { duotoneRamp } from "@/lib/colour";

/**
 * One duotone filter per beat, each ramp derived from that beat's own colour.
 *
 * Static per panel rather than swapped at runtime: a panel *is* a beat, so its
 * images always wear its ramp. The effect as you scroll is that everything
 * shifts together — background, photographs, video — because they are all
 * reading the same colour.
 *
 * Rendered once, near the top of the document, and referenced by id. The
 * markup is hidden but must stay in the DOM for `url(#…)` to resolve.
 */
export default function Duotone() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute h-0 w-0"
      width="0"
      height="0"
    >
      <defs>
        {beats.map((beat, index) => {
          const { shadow, highlight } = duotoneRamp(beat.colour);
          return (
            <filter
              key={beat.id}
              id={`duotone-${index}`}
              colorInterpolationFilters="sRGB"
              x="-15%"
              y="-15%"
              width="130%"
              height="130%"
            >
              {/* Luminance first, then map that luminance onto the ramp. */}
              <feColorMatrix type="saturate" values="0" />
              <feComponentTransfer>
                <feFuncR type="table" tableValues={table(shadow, highlight, 0)} />
                <feFuncG type="table" tableValues={table(shadow, highlight, 1)} />
                <feFuncB type="table" tableValues={table(shadow, highlight, 2)} />
              </feComponentTransfer>
            </filter>
          );
        })}
      </defs>
    </svg>
  );
}

/**
 * One `feComponentTransfer` table: the shadow colour at luminance 0, the
 * highlight colour at 1, linearly between. Two values is all a duotone needs.
 */
function table(shadow: string, highlight: string, offset: number): string {
  const channel = (hex: string) =>
    parseInt(hex.replace("#", "").slice(offset * 2, offset * 2 + 2), 16) / 255;
  return `${channel(shadow).toFixed(3)} ${channel(highlight).toFixed(3)}`;
}

"use client";

import { useId, type RefObject } from "react";

/**
 * Hand-drawn balloon, drawn as a gradient-filled teardrop with a specular
 * highlight, a knot, and a string.
 *
 * The string is its own <g> so the caller can rotate it independently — it
 * trails the balloon's sway, which is what sells the pendulum.
 */
export default function Balloon({
  stringRef,
  className,
}: {
  stringRef: RefObject<SVGGElement | null>;
  className?: string;
}) {
  // Gradient ids must be unique per instance, and must not contain colons —
  // useId() emits them, and colons make `url(#…)` references fragile.
  const uid = useId().replace(/:/g, "");
  const body = `bal-body-${uid}`;
  const spec = `bal-spec-${uid}`;

  return (
    <svg
      viewBox="0 0 200 320"
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={body} cx="34%" cy="26%" r="78%">
          <stop offset="0%" stopColor="var(--rose-soft)" />
          <stop offset="52%" stopColor="var(--rose)" />
          <stop offset="100%" stopColor="var(--rose-deep)" />
        </radialGradient>
        <linearGradient id={spec} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* String first so the knot overlaps its top edge cleanly. */}
      <g ref={stringRef}>
        <path
          d="M100 212 C86 240 114 258 100 284 C94 298 106 304 100 320"
          stroke="var(--rose-deep)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.75"
        />
      </g>

      <path
        d="M100 12 C146 12 180 50 180 96 C180 140 152 174 113 190 C111 191 110 193 110 196 L90 196 C90 193 89 191 87 190 C48 174 20 140 20 96 C20 50 54 12 100 12 Z"
        fill={`url(#${body})`}
      />

      <path
        d="M90 196 C93 206 97 211 100 212 C103 211 107 206 110 196 Z"
        fill="var(--rose-deep)"
      />

      <ellipse
        cx="68"
        cy="58"
        rx="16"
        ry="28"
        fill={`url(#${spec})`}
        transform="rotate(-20 68 58)"
      />
      <ellipse
        cx="134"
        cy="104"
        rx="6"
        ry="12"
        fill="#fff"
        opacity="0.25"
        transform="rotate(16 134 104)"
      />
    </svg>
  );
}

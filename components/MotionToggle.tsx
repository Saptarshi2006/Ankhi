"use client";

import { useEffect, useLayoutEffect } from "react";
import {
  useAllowMotion,
  useMotionPref,
  setMotionPref,
  applyToDocument,
  type MotionPref,
} from "@/lib/motion-pref";

// Layout effect on the client, plain effect on the server — the usual
// isomorphic dance, so React does not warn when this renders during the static
// export. Restoring the attribute in a layout effect keeps it inside the same
// commit as hydration, so the collapsed layout never flickers back.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const NEXT: Record<MotionPref, MotionPref> = {
  auto: "on",
  on: "off",
  off: "auto",
};

const LABEL: Record<MotionPref, string> = {
  auto: "Motion follows your system setting",
  on: "Motion is always on",
  off: "Motion is always off",
};

/**
 * Cycles auto → on → off.
 *
 * A three-state control rather than a two-state one so "follow the system" is
 * reachable again after an explicit choice, instead of being sticky forever.
 */
export default function MotionToggle() {
  const pref = useMotionPref();
  const allow = useAllowMotion();

  useIsomorphicLayoutEffect(() => {
    applyToDocument();
  }, []);

  return (
    <button
      type="button"
      aria-label={`${LABEL[pref]}. Click to change.`}
      title={`${LABEL[pref]} — click to change`}
      data-motion-toggle
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        setMotionPref(NEXT[pref]);
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className="fixed left-4 top-4 z-50 flex h-10 items-center gap-2 rounded-full border border-ink/10 bg-surface/70 px-3.5 text-ink-muted backdrop-blur-sm transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        aria-hidden="true"
      >
        {allow ? (
          <>
            <path d="M3 12h3l2.5-6 4 12L15 12h6" />
          </>
        ) : (
          <>
            <path d="M3 12h3l2.5-6 4 12L15 12h6" opacity="0.45" />
            <path d="m4 4 16 16" />
          </>
        )}
      </svg>
      <span className="font-sans text-[0.62rem] uppercase tracking-[0.22em]">
        {pref === "auto" ? "Auto" : pref === "on" ? "Motion" : "Still"}
      </span>
    </button>
  );
}

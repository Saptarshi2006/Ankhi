"use client";

import { useSoundEnabled, setSoundEnabled } from "@/lib/sound-pref";

/**
 * Corner mute control.
 *
 * `stopPropagation` on pointer and key events is load-bearing: while the
 * balloon is armed, the stage treats any click as "pop", and the intro listens
 * for any key. Without these guards, operating the toggle would also pop the
 * balloon.
 */
export default function SoundToggle() {
  const on = useSoundEnabled();

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Mute sound" : "Unmute sound"}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        setSoundEnabled(!on);
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className="fixed right-4 top-4 z-50 grid h-10 w-10 place-items-center rounded-full border border-ink/10 bg-surface/70 text-ink-muted backdrop-blur-sm transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" stroke="none" />
        {on ? (
          <>
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </>
        ) : (
          <>
            <path d="m16 9 5 6" />
            <path d="m21 9-5 6" />
          </>
        )}
      </svg>
    </button>
  );
}

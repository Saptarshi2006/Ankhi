"use client";

import { useEffect } from "react";

/**
 * The first user gesture, which is the only moment audio is allowed to start.
 *
 * Every browser blocks audio until the reader has interacted with the page, and
 * a scroll does not count. That matters here because the crowd is supposed to
 * swell while the balloon grows — which is scroll-driven, and so happens before
 * any click. The first click, meanwhile, is the pop.
 *
 * So rather than adding a gate, this takes whichever gesture arrives first and
 * unlocks on it. On a phone that is nearly always a tap. On a desktop, where the
 * likeliest first interaction is a scroll that unlocks nothing, the crowd
 * arrives late — the reader gets the silence and the pop, and then the crowd
 * for the title.
 *
 * If that trade turns out to be wrong in practice, the fix is one small visible
 * affordance before the balloon, not a change here.
 *
 * `pointerdown` is used rather than `click` because it fires a little earlier
 * and on the press rather than the release, which is what the audio APIs want.
 * The `touchstart` listener is passive-only and exists for older iOS Safari,
 * which did not treat `pointerdown` as an activation-triggering event.
 */
export function useAudioUnlock(onUnlock: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    let done = false;
    const unlock = () => {
      if (done) return;
      done = true;
      onUnlock();
    };

    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, [enabled, onUnlock]);
}

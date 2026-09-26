"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the scroll choreography runs.
 *
 * Three states, because "respect the OS setting" and "ignore it" are both
 * legitimate and that setting is global: plenty of people leave
 * `prefers-reduced-motion` on for every site without meaning to flatten this
 * one. So the system preference picks the default, and an explicit choice wins.
 *
 * The resolved value is mirrored onto `<html data-motion>` by an inline script
 * in the layout, before first paint, so CSS can collapse the scroll tracks
 * without a flash. This store is the client-side source of truth for the
 * animation code, and the two are kept in step by `applyToDocument`.
 */

export type MotionPref = "auto" | "on" | "off";

const KEY = "ankhi:motion";

let pref: MotionPref = "auto";
let systemReduced = false;
let hydrated = false;
let mediaQuery: MediaQueryList | null = null;
let listeningToSystem = false;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function allowMotion(): boolean {
  if (pref === "on") return true;
  if (pref === "off") return false;
  return !systemReduced;
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;

  const stored = window.localStorage.getItem(KEY);
  if (stored === "on" || stored === "off" || stored === "auto") pref = stored;

  mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  systemReduced = mediaQuery.matches;
}

/**
 * Publish the resolved value onto <html> for CSS to key off.
 *
 * Called twice on purpose. The inline script in the layout does it before first
 * paint, so the scroll tracks never render at full height for a frame. React
 * then reclaims the <html> element during hydration and drops the attribute it
 * does not know about, so this is called again from a layout effect to put it
 * back — in the same commit, before the browser paints.
 */
export function applyToDocument() {
  hydrate();
  document.documentElement.dataset.motion = allowMotion() ? "on" : "off";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  hydrate();

  // Follow the OS setting live, so turning it on in System Settings takes
  // effect without a reload — but only while the reader has not chosen.
  if (mediaQuery && !listeningToSystem) {
    listeningToSystem = true;
    mediaQuery.addEventListener("change", (event) => {
      systemReduced = event.matches;
      applyToDocument();
      emit();
    });
  }

  return () => {
    listeners.delete(listener);
  };
}

export function setMotionPref(next: MotionPref) {
  pref = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    // Blocked storage — the choice just will not survive a reload.
  }
  applyToDocument();
  emit();
}

export function useAllowMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      hydrate();
      return allowMotion();
    },
    /**
     * React calls this for the hydration render, which happens on the client —
     * where the layout's inline script has already resolved the real value onto
     * <html>. Reading it back here means the very first client render is
     * already correct, instead of briefly claiming motion is allowed and
     * building a scroll choreography that is torn down a frame later.
     *
     * On a real server render there is no document, and the choice does not
     * matter: only effects consume this.
     */
    () => {
      const resolved =
        typeof document !== "undefined"
          ? document.documentElement.dataset.motion
          : undefined;
      if (resolved === "on") return true;
      if (resolved === "off") return false;
      return true;
    },
  );
}

export function useMotionPref(): MotionPref {
  return useSyncExternalStore(
    subscribe,
    () => {
      hydrate();
      return pref;
    },
    () => "auto" as const,
  );
}

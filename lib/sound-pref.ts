"use client";

import { useSyncExternalStore } from "react";

/**
 * Sound on/off, shared between the corner toggle and the intro.
 *
 * A tiny external store rather than context: the intro reads the preference at
 * pop time from an event handler, where a hook would be awkward, and
 * `useSyncExternalStore` gives us a correct server snapshot for free (no
 * hydration mismatch when someone had muted on a previous visit).
 */

const KEY = "ankhi:sound";

let enabled = true;
let hydrated = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return true;
  if (!hydrated) {
    hydrated = true;
    const stored = window.localStorage.getItem(KEY);
    if (stored !== null) enabled = stored === "on";
  }
  return enabled;
}

function getServerSnapshot(): boolean {
  return true;
}

export function setSoundEnabled(next: boolean) {
  enabled = next;
  try {
    window.localStorage.setItem(KEY, next ? "on" : "off");
  } catch {
    // Private browsing or blocked storage — the preference just won't persist.
  }
  listeners.forEach((listener) => listener());
}

export function useSoundEnabled(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

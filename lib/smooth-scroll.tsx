"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * The slice of Lenis the intro actually needs: freeze and release the scroll
 * for the balloon lock.
 *
 * Deliberately not the Lenis instance itself. Handing out a mutable singleton
 * through state would mean re-rendering every consumer the moment it is
 * created, and `lenis.stop` is the only method anything calls.
 */
type LenisHandle = {
  stop: () => void;
  start: () => void;
};

const LenisContext = createContext<LenisHandle | null>(null);

export const useLenis = () => useContext(LenisContext);

export function SmoothScroll({ children }: { children: ReactNode }) {
  const instanceRef = useRef<Lenis | null>(null);

  // Created exactly once, so the context value is referentially stable and no
  // consumer re-renders merely because scroll was initialised. The lazy
  // initialiser is what makes it once — `useRef` would need to be read during
  // render to hand it out, which the React compiler rightly forbids.
  const [handle] = useState<LenisHandle>(() => ({
    stop: () => instanceRef.current?.stop(),
    start: () => instanceRef.current?.start(),
  }));

  useEffect(() => {
    // Reduced motion skips the smooth-scroll layer entirely: native scrolling
    // is the accessible default, and nothing here should override it.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ScrollTrigger.refresh();
      return;
    }

    const instance = new Lenis({ autoRaf: false, lerp: 0.09 });
    instanceRef.current = instance;

    // Lenis drives the scroll position; ScrollTrigger has to be told about
    // every one of those updates or scrubbed animations fall behind.
    const onScroll = () => ScrollTrigger.update();
    instance.on("scroll", onScroll);

    const tick = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(tick);
    // Without this, GSAP clamps its delta after a long frame — returning to a
    // background tab, say — and animations visibly jump to catch up.
    gsap.ticker.lagSmoothing(0);

    ScrollTrigger.refresh();

    // Webfonts change layout height, which invalidates every cached trigger
    // position. Re-measuring once they settle keeps the scrub ranges honest.
    document.fonts?.ready
      .then(() => ScrollTrigger.refresh())
      .catch(() => {});

    return () => {
      gsap.ticker.remove(tick);
      instance.off("scroll", onScroll);
      instance.destroy();
      instanceRef.current = null;
    };
  }, []);

  return <LenisContext.Provider value={handle}>{children}</LenisContext.Provider>;
}

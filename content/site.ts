export const site = {
  name: "Ankhi Debnath",
  age: 19,
  titleLeft: "Happy",
  titleRight: "19th",
  /**
   * What blooms in the middle of the intro, once the title has parted.
   *
   * This was `2007 — 2026`. The timeline carries no years and no ages any more,
   * so a pair of dates in the one place the reader had left to orient themselves
   * was the last thing keeping the site on a calendar. It is words instead, and
   * it is the only line the intro says that the six beats do not.
   */
  spanLine: "six chapters, all of them you",
  /**
   * The two of them, in the slot the title vacates.
   *
   * `intro-0` is not a `y<N>-<letter>` timeline photograph, so it does not live
   * in `content/years.ts` — but it goes through the same pipeline, because
   * `optimize-images.mjs` works off whatever is in `content/media/` and
   * `intro-0.jpg` becomes `/photos/intro-0-1200.webp` with no extra machinery.
   *
   * `width` / `height` are the intrinsic size of that 1200px rendition, not of
   * the source, for the same reason the timeline photographs declare theirs that
   * way: `src` resolves to the rendition, and that is the box the browser has to
   * reserve.
   */
  introPhoto: {
    id: "intro-0",
    alt: "the two of them together, her in a yellow sari and him in a white shirt",
    width: 1200,
    height: 1600,
  },
} as const;

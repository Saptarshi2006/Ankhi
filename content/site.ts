export const site = {
  name: "Ankhi Debnath",
  age: 19,
  titleLeft: "Happy",
  titleRight: "19th",
  /**
   * The span of the whole timeline, which is what blooms in after the title
   * parts. One constant so the line and the six beats cannot disagree.
   */
  spanFrom: 2007,
  spanTo: 2026,
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

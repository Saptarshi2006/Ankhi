/**
 * The fun page: seven targets, and what is behind each one.
 *
 * Deliberately separate from `content/years.ts`, which is the story. This is a
 * game that unlocks at the end of it, and it has its own shape: no duotone, no
 * beat colours, no year. The one thing they share is the media pipeline — this
 * manifest feeds the same `optimize-images.mjs` and `encode-videos.mjs` that
 * build the timeline's, and the same `/photos` and `/videos` output dirs.
 *
 * The three images and the four videos between them are exactly seven, which is
 * the number of targets. The filenames overlap (`fun-1` is both an image and a
 * video) and that is fine: they emit into different directories, and this file
 * is the only place that says which is which.
 *
 * Positions are percentages of the goal mouth, measured to the target's centre.
 * The goal is drawn at a fixed aspect ratio, so a percentage here is a
 * percentage of a shape that is the same on every screen — which is the point of
 * not positioning these in pixels. A target is a fixed physical size, so the
 * two together mean "this target sits in that relative spot and does not grow".
 */
export type FunTarget = {
  /** Stable identity, independent of which file is behind it. */
  id: string;
  kind: "image" | "video";
  /** File base name in content/media, without extension. */
  media: string;
  /** Describes the media, for anyone who cannot see or hear it. */
  alt: string;
  /** Centre of the target, as a percentage of the goal mouth. */
  left: number;
  top: number;
  /** Only for videos. The window worth keeping, in seconds. */
  startSec?: number;
  endSec?: number;
  /** Only for images. Intrinsic size of the shipped 1200px rendition. */
  width?: number;
  height?: number;
};

/**
 * Four across the top, three below — the shape of a shooting drill.
 *
 * Spacing is chosen against a 3:1 goal and a target about 9vmin across: the
 * widest horizontal gap is 25% of the goal's width and the vertical gap between
 * the rows is 44% of its height, so no two targets can touch at any viewport.
 */
export const funTargets: readonly FunTarget[] = [
  {
    id: "t1",
    kind: "image",
    media: "fun-1",
    alt: "an older woman barefoot on a rain-flooded terrace, sweeping drowned fruit off the wet concrete with a broom",
    left: 12,
    top: 27,
    width: 1200,
    height: 674,
  },
  {
    id: "t2",
    kind: "video",
    media: "fun-1",
    alt: "the same woman, still sweeping, as the rain keeps coming",
    left: 37.5,
    top: 27,
    startSec: 0,
    endSec: 4.1,
  },
  {
    id: "t3",
    kind: "image",
    media: "fun-2",
    alt: "a night-time celebration, people dancing under strings of lights while someone records on a phone",
    left: 62.5,
    top: 27,
    width: 1200,
    height: 900,
  },
  {
    id: "t4",
    kind: "video",
    media: "fun-2",
    alt: "a woman in white dancing in the middle of it, with the lights behind her",
    left: 88,
    top: 27,
    startSec: 2,
    endSec: 10,
  },
  {
    id: "t5",
    kind: "image",
    media: "fun-3",
    alt: "him and a friend in matching dark sports jerseys, both laughing at the camera from close range",
    left: 25,
    top: 73,
    width: 1200,
    height: 1803,
  },
  {
    id: "t6",
    kind: "video",
    media: "fun-3",
    alt: "the two of them still laughing, the camera tilted",
    left: 50,
    top: 73,
    startSec: 0,
    endSec: 8,
  },
  {
    id: "t7",
    kind: "video",
    media: "fun-4",
    alt: "her face close to the camera, lying outside in the green, squinting and laughing",
    left: 75,
    top: 73,
    startSec: 0,
    endSec: 6.3,
  },
];

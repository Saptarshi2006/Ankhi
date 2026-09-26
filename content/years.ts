/**
 * The six beats.
 *
 * COPY IS PLACEHOLDER. The wording demonstrates the shape and length of a beat
 * — one concrete detail, a turn, and her own voice where there is one — but
 * none of it is real. Replace the strings; the layout does not change.
 *
 * COLOURS ARE REAL and form a deliberate journey: hue travels cool to warm and
 * lands on the same rose the intro and the letter use, so the page's colour
 * arc resolves exactly where the love letter arrives. Lightness stays high
 * throughout, which is why one ink colour serves the whole timeline.
 *
 * MEDIA IS REFERENCED, NOT EMBEDDED. Files live in `content/media/` and are
 * named by convention, so real assets drop in without touching this file:
 *
 *   y1-a.jpg  y1-b.jpg  y1-c.jpg  y1-d.jpg  y1-v.mp4
 *   ...
 *   y6-a.jpg  y6-b.jpg  y6-c.jpg  y6-d.jpg  y6-v.mp4
 *
 * `startSec` / `endSec` are editorial. They are the lever on payload: six
 * eight-second clips is ~3.6MB on a phone, six thirty-second clips is ~11MB.
 */

export type Photo = {
  /** Base name in content/media, without extension. */
  id: string;
  /** Describes the image, for anyone who cannot see it. */
  alt: string;
  width: number;
  height: number;
};

export type Clip = {
  /** Base name in content/media, without extension. */
  id: string;
  /** Where the interesting part starts. */
  startSec: number;
  /** Where it ends. Keep the span short. */
  endSec: number;
};

export type Beat = {
  /** Inclusive age range this beat covers. */
  ageFrom: number;
  ageTo: number;
  year: number;
  title: string;
  /** One sentence: what changed. This is the beat, not the title. */
  turn: string;
  /** Her own words, if there are any worth keeping. */
  herWords?: string;
  /** Background for this beat, and the source of its duotone ramp. */
  colour: string;
  photos: Photo[];
  clip?: Clip;
  /**
   * Opt out of the duotone. One full-colour beat among tinted ones reads as
   * deliberate rather than inconsistent, and it is how the story marks the
   * move from her past to the present.
   */
  fullColour?: boolean;
};

export const beats: readonly Beat[] = [
  {
    ageFrom: 0,
    ageTo: 4,
    year: 2011,
    title: "Before There Were Words",
    turn: "You were entirely a person before you were entirely yourself.",
    colour: "oklch(0.965 0.016 245)",
    photos: [
      { id: "y1-a", alt: "PLACEHOLDER — a first birthday", width: 1200, height: 800 },
      { id: "y1-b", alt: "PLACEHOLDER — small hands", width: 1200, height: 800 },
      { id: "y1-c", alt: "PLACEHOLDER — a room she grew up in", width: 1200, height: 800 },
      { id: "y1-d", alt: "PLACEHOLDER — being held", width: 1200, height: 800 },
    ],
    clip: { id: "y1-v", startSec: 0, endSec: 8 },
  },
  {
    ageFrom: 5,
    ageTo: 9,
    year: 2016,
    title: "The Chair by the Window",
    turn: "You decided where you sat, and nobody moved you.",
    herWords: "I'm not coming in.",
    colour: "oklch(0.955 0.030 205)",
    photos: [
      { id: "y2-a", alt: "PLACEHOLDER — the chair", width: 1200, height: 800 },
      { id: "y2-b", alt: "PLACEHOLDER — school", width: 1200, height: 800 },
      { id: "y2-c", alt: "PLACEHOLDER — a first best friend", width: 1200, height: 800 },
      { id: "y2-d", alt: "PLACEHOLDER — a bike", width: 1200, height: 800 },
    ],
    clip: { id: "y2-v", startSec: 0, endSec: 8 },
  },
  {
    ageFrom: 10,
    ageTo: 12,
    year: 2021,
    title: "The Year That Changed",
    turn: "Something happened that I still don't know the whole shape of.",
    herWords: "It's fine. Everything's fine.",
    colour: "oklch(0.950 0.042 160)",
    photos: [
      { id: "y3-a", alt: "PLACEHOLDER — a move, or a loss", width: 1200, height: 800 },
      { id: "y3-b", alt: "PLACEHOLDER — the year she changed", width: 1200, height: 800 },
      { id: "y3-c", alt: "PLACEHOLDER — a thing she kept", width: 1200, height: 800 },
      { id: "y3-d", alt: "PLACEHOLDER — somewhere she went", width: 1200, height: 800 },
    ],
    clip: { id: "y3-v", startSec: 0, endSec: 8 },
  },
  {
    ageFrom: 13,
    ageTo: 15,
    year: 2024,
    title: "The Year You Stopped Explaining",
    turn: "You stopped telling people why you felt things, and started just feeling them.",
    herWords: "You don't get it. You never get it.",
    colour: "oklch(0.950 0.045 100)",
    photos: [
      { id: "y4-a", alt: "PLACEHOLDER — headphones", width: 1200, height: 800 },
      { id: "y4-b", alt: "PLACEHOLDER — a first heartbreak", width: 1200, height: 800 },
      { id: "y4-c", alt: "PLACEHOLDER — a kept secret", width: 1200, height: 800 },
      { id: "y4-d", alt: "PLACEHOLDER — becoming herself", width: 1200, height: 800 },
    ],
    clip: { id: "y4-v", startSec: 0, endSec: 8 },
  },
  {
    ageFrom: 16,
    ageTo: 18,
    year: 2027,
    title: "Almost",
    turn: "Everyone had an opinion about who you were becoming, and you stopped asking them.",
    herWords: "I've got it handled.",
    colour: "oklch(0.945 0.050 55)",
    photos: [
      { id: "y5-a", alt: "PLACEHOLDER — exams", width: 1200, height: 800 },
      { id: "y5-b", alt: "PLACEHOLDER — deciding", width: 1200, height: 800 },
      { id: "y5-c", alt: "PLACEHOLDER — a last day of school", width: 1200, height: 800 },
      { id: "y5-d", alt: "PLACEHOLDER — the year she left", width: 1200, height: 800 },
    ],
    clip: { id: "y5-v", startSec: 0, endSec: 8 },
  },
  {
    ageFrom: 19,
    ageTo: 19,
    year: 2030,
    title: "Nineteen",
    turn: "And then, six weeks ago, you let someone new into the middle of it.",
    herWords: "You always do this too much.",
    colour: "oklch(0.970 0.012 30)",
    // The one beat in full colour, deliberately.
    fullColour: true,
    photos: [
      { id: "y6-a", alt: "PLACEHOLDER — now", width: 1200, height: 800 },
      { id: "y6-b", alt: "PLACEHOLDER — the two of you", width: 1200, height: 800 },
      { id: "y6-c", alt: "PLACEHOLDER — this year", width: 1200, height: 800 },
      { id: "y6-d", alt: "PLACEHOLDER — nineteen", width: 1200, height: 800 },
    ],
    clip: { id: "y6-v", startSec: 0, endSec: 8 },
  },
];

/** Total ages the figure travels across the timeline. */
export const AGE_FROM = beats[0].ageFrom;
export const AGE_TO = beats[beats.length - 1].ageTo;

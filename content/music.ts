/**
 * The score.
 *
 * One array of slots, in the order they play, and the only place in the project
 * where a piece of music is named. `encode-music.mjs` reads it to cut the
 * files; `lib/music.ts` reads it to play them. Change a window here and both
 * follow — there is no second copy of these numbers anywhere.
 *
 * ## Naming a track
 *
 * `file` is a base name in `content/audio/music/`. Nothing ships until
 * `npm run media:music` has cut it, so dropping a file in and building is the
 * whole workflow.
 *
 * ## Choosing a window
 *
 * The windows came from measuring each source: loudness envelope and percussive
 * density, sampled per second, which reliably separates a verse from a chorus
 * even on a heavily compressed master. The busiest sixty seconds is almost
 * always the last chorus, so most slots deliberately avoid it — slot one wants
 * the *build* at the top of the track, not its climax, because it rides the
 * balloon inflating.
 *
 * What those measurements cannot tell you is whether a window starts on a
 * musical thought. If a slot sounds wrong, move `inSec` and rebuild: it is one
 * number in this file.
 *
 * ## Duration
 *
 * Nothing is longer than it needs to be. A beat is about thirty to forty
 * seconds of reading, so eighty seconds covers it with room for a reader who
 * lingers, and every slot carries its own fade so nothing has to be re-cut if
 * that turns out to be short.
 */

export type MusicSlot = {
  /** Which moment this plays. See `SLOT` below. */
  slot: string;
  /** What it covers, for whoever is reading this file in six months. */
  covers: string;
  /** Base name in `content/audio/music/`, without extension. */
  file: string;
  /** Cut start, in seconds from the start of the source. */
  inSec: number;
  /** Cut end, in seconds. Clamped to the source by the encoder. */
  outSec: number;
  /**
   * A trim on top of the shared loudness target, in dB.
   *
   * Most slots are 0. The two that sit directly under text are down: slot one
   * plays while the balloon is growing and the prompt is on screen, and the
   * letter has the most words in the whole site fighting for attention.
   */
  gainDb?: number;
};

/** Slot identifiers, so callers never pass a string that could be a typo. */
export const SLOT = {
  /** Swells with the balloon, 0 → 1.25vh. */
  intro: "intro",
  /** Returns out of the silence, under "Happy 19th". */
  return: "return",
  /** Ages 0–4 · 2007. */
  beat0: "beat-0",
  /** Ages 5–9 · 2012. */
  beat1: "beat-1",
  /** Ages 10–12 · 2017. */
  beat2: "beat-2",
  /** Ages 13–15 · 2020. */
  beat3: "beat-3",
  /** Ages 16–18 · 2023. */
  beat4: "beat-4",
  /** Age 19 · 2026, and straight on into the letter. */
  beat5: "beat-5",
  /** The love letter. The same recording as `beat5`, running on. */
  letter: "letter",
} as const;

export type SlotId = (typeof SLOT)[keyof typeof SLOT];

export const music: readonly MusicSlot[] = [
  {
    slot: SLOT.intro,
    covers: "the balloon growing, 0 → 1.25vh",
    file: "01-intro",
    inSec: 25,
    outSec: 100,
    // Under the click prompt, which is text the reader is meant to read.
    gainDb: -3,
  },
  {
    slot: SLOT.return,
    covers: "the pop's aftermath, 1.5 → 2.85vh",
    file: "02-return",
    inSec: 120,
    outSec: 160,
  },
  {
    slot: SLOT.beat0,
    covers: "ages 0–4 · 2007 · Before There Were Words",
    file: "03-beat-0",
    inSec: 95,
    outSec: 175,
  },
  {
    slot: SLOT.beat1,
    covers: "ages 5–9 · 2012 · The Chair by the Window",
    file: "04-beat-1",
    inSec: 40,
    outSec: 120,
  },
  {
    slot: SLOT.beat2,
    covers: "ages 10–12 · 2017 · The Year That Changed",
    file: "05-beat-2",
    inSec: 205,
    outSec: 285,
  },
  {
    slot: SLOT.beat3,
    covers: "ages 13–15 · 2020 · The Year You Stopped Explaining",
    file: "06-beat-3",
    inSec: 140,
    outSec: 220,
  },
  {
    slot: SLOT.beat4,
    covers: "ages 16–18 · 2023 · Almost",
    file: "07-beat-4",
    inSec: 235,
    outSec: 315,
  },
  {
    /*
     * One hundred seconds, longer than any other slot, and played as a single
     * continuous take from `beat5` into `letter`. "I will remain yours" is a
     * promise and the letter is a promise, so the same recording carries
     * through the beat boundary with no crossfade at all — the last thing heard
     * as the site ends is the song that played for the nineteenth year.
     */
    slot: SLOT.beat5,
    covers: "age 19 · 2026 · Nineteen, and on into the letter",
    file: "08-beat-5",
    inSec: 60,
    outSec: 160,
  },
];

/**
 * Where each beat's music starts and stops in scroll.
 *
 * The timeline is already a table of ranges in `lib/timeline-scroll.ts`; this
 * only says which slot belongs to which beat, and that the letter is not a
 * separate take. A beat changes track on its *travel* stage, while the previous
 * beat's scene is still on screen, so the change is a crossfade rather than a
 * cut and the reader is never silent between years.
 */
export const SLOT_FOR_BEAT = [
  SLOT.beat0,
  SLOT.beat1,
  SLOT.beat2,
  SLOT.beat3,
  SLOT.beat4,
  SLOT.beat5,
] as const;

/** Target loudness for the whole score. */
export const TARGET_LUFS = -16;

/** Ceiling, so a loud chorus cannot spike past the rest. */
export const TARGET_PEAK = -1.5;

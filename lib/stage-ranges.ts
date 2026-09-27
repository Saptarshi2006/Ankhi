/**
 * Scroll ranges for the intro stage, in viewport heights.
 *
 * The balloon and the title used to be two separate sticky sections. That
 * cannot work without a gap: the void between two sticky sections is always
 * exactly one viewport tall — the height of the first frame un-pinning — so the
 * reader had to scroll 1280px of nothing after the pop before "Happy 19th"
 * appeared, and scrolling back up left the title hanging above the same hole.
 *
 * Both phases now share one section and one sticky viewport, and each phase is
 * an absolute range within it. Every number here is relative to the section's
 * top reaching the top of the viewport, which is scroll position 0.
 *
 * Pure viewport-relative values, so they behave the same on a phone and a
 * desktop. They are plain constants precisely so they stay easy to retune.
 */
export const STAGE = {
  /** A · the balloon grows across this range. The scroll locks as it ends. */
  growthEnd: 1.25,

  /**
   * The pop. The burst plays while the page glides from `growthEnd` to
   * `titleInEnd`, so there is no dead pause between the click and the title.
   */
  titleIn: 1.5,
  titleInEnd: 1.7,

  /** E · the words travel to the edges across this range. */
  spreadEnd: 2.7,

  /**
   * F · the words leave, and the years come up.
   *
   * The words fade from `wordsOut` to `revealIn`, so they are fully clear
   * before the new line starts and it owns the middle of the frame on its own. That is not only a compositional preference: at full
   * spread the gap between "Happy" and "19th" is 463px on a desktop but 96px on
   * a phone, which is one short line and nothing more. Anything placed between
   * them would be clipped on the device this site is most likely read on.
   */
  wordsOut: 2.7,
  revealIn: 3.0,
  revealEnd: 4.0,

  /**
   * Where the sticky frame unpins. The years are still fully visible here and
   * only fade over the un-pin tail, so scrolling back up never reveals an empty
   * frame — the same reason the title used to hold until here.
   */
  pinnedEnd: 4.0,

  /**
   * Total track height. Must stay `pinnedEnd + 1`: the extra viewport is the
   * tail the frame scrolls away over, and the letter follows immediately after.
   */
  trackVh: 5.0,
} as const;

/**
 * An absolute scroll position `vh` viewport heights past the point where the
 * trigger's top meets the top of the viewport.
 *
 * Returns a plain number rather than a `"+=n"` offset string. GSAP accepts
 * both, but a numeric `start` is unambiguous — an offset string on `start` is
 * resolved against the trigger's *natural* position, and when that does not
 * land where you expect the trigger reads as already complete, which leaves
 * its tween sitting at its end state instead of its start state.
 *
 * Measured from the element each time, so it stays correct wherever the stage
 * sits in the document rather than only at scroll position 0.
 */
export const at = (trigger: HTMLElement | null, vh: number) => () => {
  const top = trigger ? trigger.getBoundingClientRect().top + window.scrollY : 0;
  return Math.round(top + window.innerHeight * vh);
};

/** Where the auto-advance should land: the title fully faded in, still centred. */
export const TITLE_SETTLED_VH = STAGE.titleInEnd;

/**
 * The six beats.
 *
 * NO YEARS, NO AGES. Both were here and both are gone: the rail used to carry
 * `0–4`, `5–9` and so on, and one whole stage per beat printed a four-digit
 * number alone on screen. A life is not a set of intervals, and reading her
 * childhood as a spreadsheet is the opposite of what this page is for. What is
 * left is a name and a paragraph, which is what a chapter actually is.
 *
 * `phase` is the short form — it has to survive a six-column rail on a phone.
 * `title` is the long one, on the panel. Two names for one beat on purpose: a
 * chapter marker in the margin, a title on the page.
 *
 * COLOURS ARE REAL and form a deliberate journey: hue travels cool to warm and
 * lands on the same rose the intro and the letter use, so the page's colour
 * arc resolves exactly where the love letter arrives. Lightness stays high
 * throughout, which is why one ink colour serves the whole timeline.
 *
 * The copy is written in the letter's voice, deliberately: second person, "I"
 * and "you" in the same line, short declaratives, every turn ending on something
 * concrete rather than on an aphorism. The letter is the thing this site is
 * for, and six panels of greeting-card sentiment in front of it would spend the
 * reader's patience before it arrived. `herWords` is the counterweight — terse,
 * slightly defensive, in her voice, and not to be improved.
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
  /**
   * Intrinsic size of the *shipped* file, which is always the 1200px rendition
   * (`${id}-1200.webp`), never the source.
   *
   * Declaring the source size looks harmless — the container has a fixed box
   * and the image is `object-cover`, so CSS wins either way — but it makes the
   * browser reserve a box with the wrong aspect ratio before the bytes arrive,
   * and a wrong intrinsic size is the kind of thing that silently reintroduces
   * layout shift somewhere else later.
   */
  width: number;
  height: number;
};

export type Clip = {
  /** Base name in content/media, without extension. */
  id: string;
  /**
   * What is happening in it, for anyone who cannot see it.
   *
   * The hero is `aria-hidden` and the four corner photographs are decorative,
   * so this is the only description of the clip that reaches assistive tech.
   */
  alt: string;
  /** Where the interesting part starts. */
  startSec: number;
  /** Where it ends. Keep the span short. */
  endSec: number;
};

export type Beat = {
  /** Stable identity, and the React key. Was `year`, before years went. */
  id: string;
  /** Short name for the rail. Has to fit a sixth of a phone's width. */
  phase: string;
  /** The name on the panel. */
  title: string;
  /** What changed, in the letter's voice. This is the beat, not the title. */
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
    id: "b1",
    phase: "First steps",
    title: "Before There Were Words",
    turn: "You were a person long before you were yourself. That has always been the easiest thing about you — you filled a room long before anyone told you what rooms were for. I have been trying to fill one ever since.",
    colour: "oklch(0.965 0.016 245)",
    photos: [
      { id: "y1-a", alt: "a baby in red and gold festival dress, a hand under her chin", width: 1200, height: 1776 },
      { id: "y1-b", alt: "a toddler in a red hat and dungarees, a dark tilak on her forehead, smiling", width: 1200, height: 1697 },
      { id: "y1-c", alt: "a girl in a blue and gold silk sari beside an older woman in a multicoloured sari, both standing in a doorway packed with flower garlands", width: 1200, height: 1362 },
      { id: "y1-d", alt: "a young woman in a patterned knit sweater and jeans, sitting on steps beside a lake with sunglasses on her head", width: 1200, height: 1368 },
    ],
    // The source is 6.3s, so the window is the whole thing. Declaring 8
    // would not fail — ffmpeg would hand back 6.3s and nobody would know.
    clip: { id: "y1-v", alt: "a PLACEHOLDER clip from the first years", startSec: 0, endSec: 6 },
  },
  {
    id: "b2",
    phase: "The Chair",
    title: "The Chair by the Window",
    turn: "You decided where you sat and the whole room rearranged itself around you. I have never met anyone who takes up exactly as much space as she is entitled to, and then some. I sat where you told me to. I have not moved since.",
    herWords: "I'm not coming in.",
    colour: "oklch(0.955 0.030 205)",
    photos: [
      { id: "y2-a", alt: "a young woman in a yellow top, looking straight at the camera between fronds of green leaves", width: 1200, height: 1470 },
      { id: "y2-b", alt: "a girl with long wet hair in a navy hoodie, smiling back over her shoulder", width: 1200, height: 800 },
      { id: "y2-c", alt: "a young woman in a yellow sari and red blouse wearing round sunglasses, both hands in her hair on a sunlit rooftop", width: 1200, height: 1600 },
      { id: "y2-d", alt: "a young woman holding a bunch of sunflowers on a balcony above a river, laughing downward at sunset", width: 1200, height: 1600 },
    ],
    clip: { id: "y2-v", alt: "a PLACEHOLDER clip from the chair by the window", startSec: 0, endSec: 8 },
  },
  {
    id: "b3",
    phase: "The Change",
    title: "The Year That Changed",
    turn: "Something happened that I still do not have the whole shape of. You came out of it quieter, and I have never once asked you to be louder. You do not owe anyone an explanation of your own weather.",
    herWords: "It's fine. Everything's fine.",
    colour: "oklch(0.950 0.042 160)",
    photos: [
      { id: "y3-a", alt: "a young woman in a white top photographed by phone flash at night, a small pendant at her throat", width: 1200, height: 1586 },
      { id: "y3-b", alt: "a girl with long wavy hair resting her chin on her hand and looking at the camera in a dim room", width: 1200, height: 2133 },
      { id: "y3-c", alt: "a young woman in a white printed top with her head tilted, silver jhumka earrings and a small nose ring", width: 1200, height: 1600 },
      { id: "y3-d", alt: "a young woman in a red sari with a gold ear cuff, looking straight into the camera", width: 1200, height: 1600 },
    ],
    clip: { id: "y3-v", alt: "a PLACEHOLDER clip from the year that changed", startSec: 0, endSec: 8 },
  },
  {
    id: "b4",
    phase: "The Quiet",
    title: "The Year You Stopped Explaining",
    turn: "You stopped explaining yourself, and I noticed before you did. It is the most attractive thing about you — not the sari, not the earrings, the absolute refusal to justify being who you are.",
    herWords: "You don't get it. You never get it.",
    colour: "oklch(0.950 0.045 100)",
    photos: [
      { id: "y4-a", alt: "a woman in a bright pink sari standing on a wooden staircase beneath a wall of framed vintage posters", width: 1200, height: 1595 },
      { id: "y4-b", alt: "a woman in a green blouse and red sari holding a decorated idol of Krishna, caught mid-sentence", width: 1200, height: 1200 },
      { id: "y4-c", alt: "a woman in a cream and pink sari seated on stone steps against ochre-yellow walls, one hand lifted to her hair", width: 1200, height: 1595 },
      { id: "y4-d", alt: "a woman in a dark green sari on a wide lawn with a domed white monument far behind her, holding sunglasses and looking down", width: 1200, height: 1595 },
    ],
    // 6.3s source; used whole for the same reason as y1.
    clip: { id: "y4-v", alt: "a PLACEHOLDER clip from the year you stopped explaining", startSec: 0, endSec: 6 },
  },
  {
    id: "b5",
    phase: "Leaving",
    title: "Almost",
    turn: "You were nearly gone from that building, and everything in it rearranged itself. I watched you carry a whole year on your back and pretend it weighed nothing. I wanted in. You would not let me.",
    herWords: "I've got it handled.",
    colour: "oklch(0.945 0.050 55)",
    photos: [
      { id: "y5-a", alt: "a girl in a cream top blowing out two candles on a cake in candlelight", width: 1200, height: 1593 },
      { id: "y5-b", alt: "a woman in a cream printed kurta biting a spiral fried snack on a stick, a paper plate in her other hand, a garden behind her", width: 1200, height: 1595 },
      { id: "y5-c", alt: "a woman in a cream sari and red blouse with gold jhumkas and red bangles, seated indoors with a hand at her hair", width: 1200, height: 2133 },
      { id: "y5-d", alt: "a woman in a cream and peach sari standing before a large green carved door in a weathered white wall, padlocked and shuttered", width: 1200, height: 1595 },
    ],
    // 19s, the only source with room to choose a window rather than take
    // the opening.
    clip: { id: "y5-v", alt: "a PLACEHOLDER clip from almost", startSec: 4, endSec: 12 },
  },
  {
    id: "b6",
    phase: "Now",
    title: "Nineteen",
    turn: "And then you let me in, in the middle of all of it, without waiting for a good time. There was never going to be a good time. I would have taken you in on a Tuesday in the rain.",
    herWords: "You always do this too much.",
    colour: "oklch(0.970 0.012 30)",
    // The one beat in full colour, deliberately.
    fullColour: true,
    photos: [
      { id: "y6-a", alt: "a black-and-white mirror selfie of a woman wrapped in a patterned shawl, holding a phone up", width: 1200, height: 1595 },
      { id: "y6-b", alt: "a woman in a black sequined sari with an open back, looking over her shoulder on a terrace", width: 1200, height: 2909 },
      { id: "y6-c", alt: "a woman in a green sari and sunglasses standing against a wall of painted graffiti", width: 1200, height: 1595 },
      { id: "y6-d", alt: "a woman in a red and gold sari, chin resting on her hand, at a table set with white plates", width: 1200, height: 1600 },
    ],
    clip: { id: "y6-v", alt: "a PLACEHOLDER clip from nineteen", startSec: 0, endSec: 8 },
  },
];

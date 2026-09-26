/**
 * The letter, as stanzas of lines.
 *
 * Structure is two levels — stanza, then line — because the reveal animation
 * is per line, while the visual gap is per stanza. Flattening this to a single
 * array of strings would push that gap logic into the component.
 */
export const letter: readonly (readonly string[])[] = [
  [
    "It’s only been a month and a half,",
    "yet my heart feels like it has known you forever.",
    "Somehow, in such a little time,",
    "you became a part of the way I see my world.",
  ],
  [
    "You are the peace in my chaos,",
    "the thought that stays when everything else fades.",
    "I never knew someone could feel this familiar,",
    "this close, this deeply mine.",
  ],
  [
    "I can’t promise that every day will be perfect,",
    "but I promise I’ll keep choosing you through the imperfect ones.",
    "Because Ankhi, I don’t just love having you in my life—",
    "I want to build a life where you always have a place in my heart. ❤️",
  ],
];

import type { ReactElement } from "react";
import type { Beat } from "@/content/years";
import Scene from "./Scene";

/**
 * One beat. A panel in the horizontally scrolling track, exactly one viewport
 * wide.
 *
 * All the content and choreography lives in `Scene`; this exists to be the thing
 * that measures a screen and slides past.
 *
 * A beat is one beat-width wide rather than something narrower, which is a
 * change of intent. The compositions the scene is built from are all centred —
 * the title, the year, the turn, the hero — and with a 62vw panel sitting beside
 * a figure column, "the middle" lands at 57% of the screen. Full-width panels
 * also make the travel a clean carousel, and make the takeover's handover
 * exact, because adjacent panels differ by precisely one viewport.
 */
export default function Beat({ beat, index }: { beat: Beat; index: number }): ReactElement {
  return (
    <article
      data-beat={index}
      className="h-full shrink-0 overflow-hidden"
      style={{ width: "var(--beat-w, 100vw)" }}
    >
      <Scene
        beat={beat}
        index={index}
        // One beat stays in full colour, deliberately: the only one not tinted,
        // which is what marks the move from her past to the present.
        filter={beat.fullColour ? undefined : `url(#duotone-${index})`}
      />
    </article>
  );
}

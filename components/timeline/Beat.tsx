import type { Beat } from "@/content/years";
import YearMedia from "./YearMedia";

/**
 * One year. A panel in the horizontally scrolling track.
 *
 * Widths are deliberately narrower than the panel. A 62vw panel is 794px on a
 * 1280 screen, and a 16:9 clip at that width is 447px tall on its own — half
 * the viewport, which pushed the filmstrip off the bottom. Capping the measure
 * keeps the whole beat on one screen, which matters more than filling it.
 *
 * `pt` clears the rail at the top; `pb` clears the signature at the bottom.
 */
export default function Beat({ beat, index }: { beat: Beat; index: number }) {
  return (
    <article
      data-beat={index}
      className="flex h-full w-[86vw] shrink-0 flex-col justify-center gap-5 px-7 pt-24 pb-16 sm:w-[62vw] sm:px-12"
    >
      <header className="flex items-baseline gap-4">
        <span className="font-display text-[clamp(2rem,5vw,3.4rem)] leading-none text-accent-deep">
          {beat.ageFrom === beat.ageTo ? beat.ageFrom : `${beat.ageFrom}–${beat.ageTo}`}
        </span>
        <span className="font-sans text-[0.68rem] uppercase tracking-[0.3em] text-ink-muted/80">
          {beat.year}
        </span>
      </header>

      <div className="max-w-sm">
        <h2 className="font-display text-[clamp(1.2rem,2.4vw,1.7rem)] leading-tight text-ink">
          {beat.title}
        </h2>
        <p className="mt-2 font-body text-[clamp(0.9rem,1.7vw,1.02rem)] leading-relaxed text-ink/80">
          {beat.turn}
        </p>
        {beat.herWords && (
          <blockquote className="mt-3 border-l-2 border-ink/20 pl-3 font-body text-[clamp(0.9rem,1.7vw,1.02rem)] italic leading-relaxed text-ink/70">
            {beat.herWords}
          </blockquote>
        )}
      </div>

      <div className="max-w-md">
        <YearMedia
          photos={beat.photos}
          clip={beat.clip}
          // One beat stays in full colour, deliberately: the only one not
          // tinted, which is what marks the move from her past to the present.
          filter={beat.fullColour ? undefined : `url(#duotone-${index})`}
        />
      </div>
    </article>
  );
}

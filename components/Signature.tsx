import { site } from "@/content/site";

/**
 * The name, held at the bottom of the viewport for the whole site.
 *
 * `pointer-events-none` because it sits above the letter and the balloon
 * stage, and the stage's click-to-pop must not be blocked by it.
 */
export default function Signature() {
  return (
    <p className="pointer-events-none fixed inset-x-0 bottom-5 z-20 text-center font-sans text-[0.7rem] uppercase tracking-[0.42em] text-ink-muted/70">
      {site.name}
    </p>
  );
}

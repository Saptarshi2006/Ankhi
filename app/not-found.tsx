import Link from "next/link";

/**
 * The 404.
 *
 * Next prerenders this to `out/404.html`, and Workers serves it for any
 * unmatched request via `assets.not_found_handling: "404-page"`.
 *
 * Deliberately no GSAP here. An error page should not need JavaScript to be
 * legible, and it should not animate.
 */
export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center px-6 text-center">
      <div className="max-w-md">
        <p className="font-display text-[clamp(1.5rem,5vw,2.75rem)] leading-tight text-ink">
          This page never existed.
        </p>
        <p className="mt-3 font-body text-[clamp(1rem,2.6vw,1.3rem)] tracking-[0.1em] text-ink-muted">
          But she does.
        </p>
        <Link
          href="/"
          className="mt-10 inline-block font-sans text-[0.72rem] uppercase tracking-[0.38em] text-ink-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          Back to the beginning
        </Link>
      </div>
    </main>
  );
}

/**
 * Resize timeline photos and emit WebP at a fixed set of widths.
 *
 * `output: "export"` disables Next's image optimiser, so originals would ship
 * raw — six phone cameras across fifteen years is well over 20MB. This is the
 * pipeline that stops that happening.
 *
 * The width set is fixed and every image gets all of them, upscaling if the
 * source is smaller, so a consumer can never ask for a width that was not
 * generated — there is no manifest to fall out of step with anything.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/optimize-images.mjs
 */
import { mkdir, readdir, stat } from "node:fs/promises";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { fullBleedImages } from "../content/site.ts";
import { BACKDROP_QUALITY } from "./blur-backdrop.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA = join(ROOT, "content", "media");
const OUT = join(ROOT, "public", "photos");

/**
 * Every width any consumer asks for today.
 *
 * Only `-1200.webp` is referenced — `Quadrants` and the `Scene` hero fallback —
 * so the other three are generated, shipped, and never requested. They are kept
 * because a `srcset` is the obvious next step and the widths are then already
 * on disk, but be aware this is currently paying for three unused files per
 * photograph.
 *
 * If the set is ever trimmed to just 1200, also drop the `width`/`height` claim
 * in `content/years.ts` to match whatever `src` actually resolves to.
 */
export const WIDTHS = [480, 768, 1200, 1600];

const SOURCES = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const newer = async (a, b) => {
  try {
    return (await stat(a)).mtimeMs > (await stat(b)).mtimeMs;
  } catch {
    return true;
  }
};

await mkdir(OUT, { recursive: true });

const files = (await readdir(MEDIA)).filter((f) =>
  SOURCES.has(extname(f).toLowerCase()),
);

let written = 0;
let cached = 0;
let backdrops = 0;

for (const file of files) {
  const id = basename(file, extname(file));
  const source = join(MEDIA, file);

  for (const width of WIDTHS) {
    const target = join(OUT, `${id}-${width}.webp`);

    if (!(await newer(source, target))) {
      cached += 1;
      continue;
    }

    await sharp(source)
      .rotate() // honour EXIF orientation before anything is thrown away
      .resize({ width, withoutEnlargement: false })
      .webp({ quality: 78, effort: 5 })
      .toFile(target);

    written += 1;
  }

  /*
   * A blurred backdrop, for the images that are shown whole over one.
   *
   * Those are named in `content/site.ts` rather than guessed at here, because
   * "is this one full-bleed" is a fact about the layout and not about the file:
   * the same picture can be a cropped corner thumbnail in the timeline and an
   * uncropped full-screen hero in the intro. Adding one is a line in that file.
   *
   * At the largest width only, since this is one per image and it is always
   * scaled to fill a viewport.
   */
  if (fullBleedImages.includes(id)) {
    const backdrop = join(OUT, `${id}-bg.webp`);
    if (await newer(source, backdrop)) {
      await sharp(source)
        .rotate()
        // Blur before the resize: blurring at source resolution and then
        // downscaling is smoother than downscaling and then blurring, and it is
        // the difference between a soft backdrop and one that is visibly soft
        // in steps.
        .blur(22)
        .resize({ width: WIDTHS[WIDTHS.length - 1], withoutEnlargement: false })
        .modulate({ brightness: 0.94, saturation: 1.3 })
        .webp({ quality: BACKDROP_QUALITY, effort: 5 })
        .toFile(backdrop);
      backdrops += 1;
    }
  }
}

console.log(`photos → public/photos  (${WIDTHS.join(", ")}px)`);
console.log(`  ${written} written, ${cached} already current, from ${files.length} sources`);
if (fullBleedImages.length > 0) {
  console.log(`  ${backdrops} blurred backdrop${backdrops === 1 ? "" : "s"} for ${fullBleedImages.join(", ")}`);
}

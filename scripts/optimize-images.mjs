/**
 * Resize timeline photos and emit WebP at a fixed set of widths.
 *
 * `output: "export"` disables Next's image optimiser, so originals would ship
 * raw — six phone cameras across fifteen years is well over 20MB. This is the
 * pipeline that stops that happening.
 *
 * The width set is fixed and every image gets all of them, upscaling if the
 * source is smaller. That is deliberate: it means a srcset is a static string
 * with no manifest to keep in sync, and therefore no way for a browser to
 * request a width that was never generated.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/optimize-images.mjs
 */
import { mkdir, readdir, stat } from "node:fs/promises";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA = join(ROOT, "content", "media");
const OUT = join(ROOT, "public", "photos");

/** Must match the srcset in components/timeline/YearMedia.tsx. */
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
}

console.log(`photos → public/photos  (${WIDTHS.join(", ")}px)`);
console.log(`  ${written} written, ${cached} already current, from ${files.length} sources`);

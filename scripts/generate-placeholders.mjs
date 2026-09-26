/**
 * Generate placeholder media for the timeline.
 *
 * The real photos and clips do not exist yet, so this fabricates a full set:
 * 24 images and 6 clips, named by the convention in content/years.ts. That
 * means the optimise and encode pipelines are genuinely exercised — real
 * decode behaviour, real posters, real byte counts — rather than stubbed out.
 *
 * Drop real files into content/media/ with the same names and re-run; the
 * generator leaves existing files alone unless --force is passed.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/generate-placeholders.mjs [--force]
 */
import { execFile } from "node:child_process";
import { mkdir, writeFile, access } from "node:fs/promises";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { beats } from "../content/years.ts";
import { hexFromOklch, duotoneRamp } from "../lib/colour.ts";

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA = join(ROOT, "content", "media");
const FORCE = process.argv.includes("--force");

const WIDTH = 1200;
const HEIGHT = 800;

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * Deliberately no <text> in here: librsvg, which sharp uses, cannot rely on
 * fonts being present and will silently render nothing. The index is shown as a
 * row of squares instead, which is enough to tell placeholders apart when
 * eyeballing the build.
 */
function placeholderSvg(beat, index) {
  const { highlight, shadow } = duotoneRamp(beat.colour);
  const pips = Array.from({ length: index + 1 }, (_, i) => {
    const x = 60 + i * 34;
    return `<rect x="${x}" y="${HEIGHT - 76}" width="20" height="20" rx="4" fill="${highlight}" fill-opacity="0.75"/>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${highlight}"/>
      <stop offset="1" stop-color="${shadow}"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <circle cx="${WIDTH / 2}" cy="${HEIGHT * 0.44}" r="${WIDTH * 0.2}" fill="${highlight}" fill-opacity="0.5"/>
  <circle cx="${WIDTH * 0.34}" cy="${HEIGHT * 0.62}" r="${WIDTH * 0.09}" fill="${shadow}" fill-opacity="0.35"/>
  ${pips}
</svg>`;
}

async function makePhotos() {
  let made = 0;
  let skipped = 0;

  for (const beat of beats) {
    for (const [index, photo] of beat.photos.entries()) {
      const out = join(MEDIA, `${photo.id}.jpg`);
      if (!FORCE && (await exists(out))) {
        skipped += 1;
        continue;
      }
      const svg = placeholderSvg(beat, index);
      await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toFile(out);
      made += 1;
    }
  }

  return { made, skipped };
}

async function makeClips() {
  let made = 0;
  let skipped = 0;

  for (const beat of beats) {
    if (!beat.clip) continue;
    const out = join(MEDIA, `${beat.clip.id}.mp4`);
    if (!FORCE && (await exists(out))) {
      skipped += 1;
      continue;
    }

    const ramp = duotoneRamp(beat.colour);
    const base = hexFromOklch(beat.colour);
    // Three drifting stops in the beat's own family, so a placeholder clip
    // already reads as belonging to its panel.
    const input = `gradients=s=1280x720:c0=${base}:c1=${ramp.highlight}:c2=${ramp.shadow}:n=3:speed=0.015:duration=8:r=30`;

    await run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", input,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      out,
    ]);

    made += 1;
  }

  return { made, skipped };
}

await mkdir(MEDIA, { recursive: true });

const photos = await makePhotos();
const clips = await makeClips();

await writeFile(
  join(MEDIA, "README.txt"),
  [
    "Source media for the timeline. Gitignored — too large to commit.",
    "",
    "Names follow the convention in content/years.ts:",
    "  y<N>-<letter>.jpg   one photo, four per beat (a b c d)",
    "  y<N>-v.mp4          one clip per beat",
    "",
    "Replace these with real files and re-run npm run build; the optimise and",
    "encode steps skip anything whose source is newer than its output.",
    "",
  ].join("\n"),
  "utf8",
);

console.log(`placeholders → content/media`);
console.log(`  photos  ${photos.made} written, ${photos.skipped} already present`);
console.log(`  clips   ${clips.made} written, ${clips.skipped} already present`);

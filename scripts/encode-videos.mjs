/**
 * Encode timeline clips: trim, downscale, and extract a poster frame.
 *
 * The trim is the lever on payload. A 20-second home video is ~3.5MB; the
 * 8 seconds worth keeping from it is ~1MB. Six of each is the difference
 * between 11MB and 3.6MB on a phone, so `startSec` / `endSec` in
 * content/years.ts are editorial and this script honours them exactly.
 *
 * Two renditions, selected by the browser with a media query on <source>:
 * 720p for desktop panels, 480p for phones, since a full-width panel on a
 * 390px screen gains nothing from more resolution and pays for every byte.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/encode-videos.mjs
 */
import { execFile } from "node:child_process";
import { mkdir, readdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { beats } from "../content/years.ts";

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA = join(ROOT, "content", "media");
const OUT = join(ROOT, "public", "videos");

const RENDITIONS = [
  { suffix: "720", height: 720, crf: 26 },
  { suffix: "480", height: 480, crf: 29 },
];

/**
 * H.264 only. Every browser that can run this site plays it, and VP9 would
 * save perhaps 30% for a second format nobody here needs.
 */
const CODEC_ARGS = (crf) => [
  "-c:v", "libx264",
  "-preset", "slow",
  "-crf", String(crf),
  // Baseline-ish profile and square pixels: the two settings that most often
  // decide whether a clip plays on an old phone.
  "-profile:v", "main",
  "-pix_fmt", "yuv420p",
  // Audio stripped — the clips are muted, so shipping it is dead weight.
  "-an",
  // Moves the index to the front of the file, so playback can begin before
  // the clip has finished downloading. Without this a video effectively does
  // not start until it is fully buffered.
  "-movflags", "+faststart",
];

const newer = async (a, b) => {
  try {
    return (await stat(a)).mtimeMs > (await stat(b)).mtimeMs;
  } catch {
    return true;
  }
};

await mkdir(OUT, { recursive: true });

const clips = beats.filter((b) => b.clip);
let written = 0;
let cached = 0;

for (const beat of clips) {
  const { id, startSec, endSec } = beat.clip;
  const source = join(MEDIA, `${id}.mp4`);

  try {
    await stat(source);
  } catch {
    console.warn(`  ! no source for ${id}, skipping`);
    continue;
  }

  for (const rendition of RENDITIONS) {
    const target = join(OUT, `${id}-${rendition.suffix}.mp4`);
    if (!(await newer(source, target))) {
      cached += 1;
      continue;
    }

    const span = Math.max(0.5, endSec - startSec);
    await run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      // -ss before -i for a fast seek; -t for the length. Using them as
      // output options would decode the whole file first.
      "-ss", String(startSec),
      "-i", source,
      "-t", String(span),
      "-vf", `scale=-2:${rendition.height}`,
      ...CODEC_ARGS(rendition.crf),
      target,
    ]);

    written += 1;
  }

  // Poster: a frame from the middle of the trimmed range, so it shows motion
  // rather than whatever fade-in the original happened to start with.
  const poster = join(OUT, `${id}.jpg`);
  if (await newer(source, poster)) {
    const mid = startSec + Math.max(0.5, endSec - startSec) / 2;
    await run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-ss", String(mid), "-i", source,
      "-frames:v", "1",
      "-q:v", "4",
      poster,
    ]);
    written += 1;
  }
}

const shipped = (await readdir(OUT)).length;
console.log(`clips → public/videos  (720p + 480p + poster each)`);
console.log(`  ${written} written, ${cached} already current, ${shipped} files in output`);

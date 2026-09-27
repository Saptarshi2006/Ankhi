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
import { funTargets } from "../content/fun.ts";

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

/** Source duration in seconds, or 0 if the file cannot be read. */
const durationOf = async (path) => {
  try {
    const { stdout } = await run("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      path,
    ]);
    return Number.parseFloat(stdout) || 0;
  } catch {
    return 0;
  }
};

const newer = async (a, b) => {
  try {
    return (await stat(a)).mtimeMs > (await stat(b)).mtimeMs;
  } catch {
    return true;
  }
};

await mkdir(OUT, { recursive: true });

/*
 * Both manifests, flattened to the one shape this script cares about.
 *
 * The timeline clips live on their beats and the fun page's live on targets, but
 * once a `startSec` and an `endSec` have been pulled off them they are the same
 * job: trim, two renditions, a poster, a backdrop. Keeping one encoder means one
 * staleness check and one set of codec settings, rather than two scripts that
 * drift apart the first time a phone needs a different profile.
 *
 * Audio is stripped from all of them, timeline and fun alike. The timeline clips
 * were always muted. The fun clips had real sound in the sources and it is
 * deliberately not shipped — the page is a game, the videos are the reward, and
 * nothing there is muted by the reader's choice, so an unmute control would be
 * a control most visitors never find.
 */
const clips = [
  ...beats.filter((b) => b.clip).map((b) => ({ ...b.clip, group: "timeline" })),
  ...funTargets.filter((t) => t.kind === "video").map((t) => ({
    id: t.media,
    startSec: t.startSec,
    endSec: t.endSec,
    group: "fun",
  })),
];

let written = 0;
let cached = 0;
let clamped = 0;

for (const clip of clips) {
  const { id, startSec, endSec } = clip;
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

    /*
     * Clamp the window to what the source actually has.
     *
     * Two of these clips are 6.3s against a declared 8s. ffmpeg does not fail —
     * it hands back 6.3s and writes the poster from a timestamp that happens to
     * still be inside — so an over-long window is invisible in the manifest and
     * only shows up as a slightly shorter video than anyone asked for. Clamping
     * makes the number mean what it says, and makes a later edit to 10s fail
     * visibly rather than quietly.
     */
    const total = await durationOf(source);
    const from = total > 0 ? Math.min(startSec, Math.max(0, total - 0.5)) : startSec;
    const to = total > 0 ? Math.min(endSec, total) : endSec;
    const span = Math.max(0.5, to - from);
    clamped += Math.round((endSec - startSec - span) * 100) / 100;

    await run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      // -ss before -i for a fast seek; -t for the length. Using them as
      // output options would decode the whole file first.
      "-ss", String(from),
      "-i", source,
      "-t", String(span),
      "-vf", `scale=-2:${rendition.height}`,
      ...CODEC_ARGS(rendition.crf),
      target,
    ]);

    written += 1;
  }

  /*
   * Poster: a frame from the middle of the trimmed range, so it shows motion
   * rather than whatever fade-in the original happened to start with.
   */
  const totalForPoster = await durationOf(source);
  const posterFrom = totalForPoster > 0 ? Math.min(startSec, Math.max(0, totalForPoster - 0.5)) : startSec;
  const posterTo = totalForPoster > 0 ? Math.min(endSec, totalForPoster) : endSec;
  const mid = posterFrom + Math.max(0.5, posterTo - posterFrom) / 2;

  const poster = join(OUT, `${id}.jpg`);
  if (await newer(source, poster)) {
    await run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-ss", String(mid), "-i", source,
      "-frames:v", "1",
      "-q:v", "4",
      poster,
    ]);
    written += 1;
  }

  /*
   * The backdrop behind a portrait clip.
   *
   * Five of these six are 9:16 and the frames they sit in are landscape, so the
   * clip is fitted whole and this fills the space around it. It is a *file*
   * rather than a second `<video>` with a CSS blur, for two reasons: a second
   * decoder for the same clip is a real cost on a phone and would fight the
   * takeover's existing playback handoff, and a pre-blurred JPEG costs nothing
   * to display where a runtime blur costs a frame.
   */
  const backdrop = join(OUT, `${id}-bg.jpg`);
  if (await newer(source, backdrop)) {
    await run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-ss", String(mid), "-i", source,
      "-frames:v", "1",
      // Scaled up and cropped before the blur, so the softness has something to
      // work with, and darkened so the fitted clip reads as the subject.
      "-vf", "scale=iw*1.6:ih*1.6,crop=iw/1.15:ih/1.15,gblur=sigma=22,eq=brightness=-0.06:saturation=1.3",
      "-q:v", "5",
      backdrop,
    ]);
    written += 1;
  }
}

const shipped = (await readdir(OUT)).length;
console.log(`clips → public/videos  (720p + 480p + poster each)`);
console.log(`  ${written} written, ${cached} already current, ${shipped} files in output`);

// Said out loud, because a clamped window is otherwise invisible: the run
// succeeds and the video is just quietly shorter than the manifest claims.
if (clamped > 0) {
  console.log(
    `  ! ${clamped.toFixed(2)}s of declared window was past the end of a source and was clamped`,
  );
}

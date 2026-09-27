/**
 * Cut the score.
 *
 * Reads `content/music.ts` and turns each declared window into a small AAC file
 * in `public/audio/`. Four things happen, and all four are because these are
 * pop masters rather than something produced for this:
 *
 * 1. **Trimmed** to the window in the manifest. A beat is thirty to forty
 *    seconds of reading; shipping three-minute tracks would be most of ten
 *    megabytes of music for no reason.
 * 2. **Faded** 1.5s at both ends. Every transition on this site is a
 *    crossfade, and a crossfade into a waveform that starts at full scale
 *    clicks.
 * 3. **Normalised** to a shared target. These masters measure between -7 and
 *    -9 LUFS, which is roughly six decibels above what music under a page of
 *    text should be, and the difference is either an unpleasant jump at every
 *    crossfade or dialogue-territory loudness.
 * 4. **Clamped** to the source's real duration, so a window that overruns a
 *    short file ships a shorter clip instead of failing the build.
 *
 * Sources live in `content/audio/music/` and are not committed. A missing
 * source is reported and skipped: the site still builds and still has the pop,
 * it just has no music yet.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/encode-music.mjs
 */
import { execFile } from "node:child_process";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";
import { music, TARGET_LUFS, TARGET_PEAK } from "../content/music.ts";

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "content", "audio", "music");
const OUT = join(ROOT, "public", "audio");

/** Fade length at each end of a cut, in seconds. */
const FADE = 1.5;

const newe = async (a, b) => {
  try {
    return (await stat(a)).mtimeMs > (await stat(b)).mtimeMs;
  } catch {
    return true;
  }
};

/** Source duration in seconds, or 0 if the file cannot be read. */
async function durationOf(path) {
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
}

await mkdir(OUT, { recursive: true });
await mkdir(SRC, { recursive: true });

/*
 * Clear out anything in the output that this script did not just produce.
 *
 * The output directory is the build, and it had 329KB of the retired crowd beds
 * sitting in it — gitignored, so they never showed up in `git status`, and still
 * shipped in `out/`. A stale audio file is invisible until someone measures the
 * payload and wonders where it went.
 */
const owned = new Set(music.map((m) => `${m.slot}.m4a`));
owned.add("manifest.json");
for (const name of await readdir(OUT)) {
  if (owned.has(name)) continue;
  await rm(join(OUT, name), { force: true });
  console.log(`  removed stale ${name}`);
}

/** Whatever a source file happens to be called, by base name. */
async function findSource(base) {
  for (const ext of [".mp3", ".wav", ".m4a", ".flac", ".aac", ".ogg"]) {
    const candidate = join(SRC, base + ext);
    try {
      await stat(candidate);
      return candidate;
    } catch {
      // try the next extension
    }
  }
  return null;
}

let cut = 0;
const missing = [];
const available = [];

for (const { slot, file, inSec, outSec, gainDb = 0 } of music) {
  const source = await findSource(file);
  if (!source) {
    missing.push(`${file} (${slot})`);
    continue;
  }

  const output = join(OUT, `${slot}.m4a`);
  if (!(await newe(source, output))) {
    console.log(`  ${slot}.m4a is current, skipping`);
    continue;
  }

  const total = await durationOf(source);
  if (total <= 0) {
    missing.push(`${file} (${slot}) — could not be read`);
    continue;
  }

  // Clamp rather than fail. A window that overruns its source should ship the
  // short clip it can, not break the build over a number in a table.
  const from = Math.max(0, Math.min(inSec, Math.max(0, total - 1)));
  const to = Math.min(outSec, total);
  const seconds = to - from;

  if (seconds < 3) {
    missing.push(`${file} (${slot}) — only ${seconds.toFixed(1)}s inside a ${total.toFixed(0)}s source`);
    continue;
  }

  // Fades are capped at a third of the clip, so a short window cannot fade away
  // most of itself.
  const fade = Math.min(FADE, seconds / 3);

  const filters = [
    `atrim=start=${from.toFixed(3)}:end=${to.toFixed(3)}`,
    "asetpts=N/SR/TB",
    `afade=t=in:st=0:d=${fade.toFixed(2)}`,
    `afade=t=out:st=${(seconds - fade).toFixed(2)}:d=${fade.toFixed(2)}`,
    `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_PEAK}:LRA=11`,
  ];
  if (gainDb !== 0) filters.push(`volume=${gainDb}dB`);

  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel", "error",
    "-y",
    "-i", source,
    "-af", filters.join(","),
    "-c:a", "aac",
    "-b:a", "80k",
    "-ac", "2",
    "-ar", "44100",
    "-profile:a", "aac_low",
    "-movflags", "+faststart",
    output,
  ]);

  const { size } = await stat(output);
  cut += 1;
  available.push(slot);
  console.log(
    `  ${slot.padEnd(8)} ${seconds.toFixed(0).padStart(3)}s  ` +
      `${from.toFixed(0)}–${to.toFixed(0)}s of ${file}  ${(size / 1000).toFixed(0)}KB` +
      (gainDb ? `  ${gainDb > 0 ? "+" : ""}${gainDb}dB` : ""),
  );
}

/*
 * Publish what was actually cut.
 *
 * Without this the site asks for all eight slots and gets six 404s logged in the
 * console on every visit until the music is in place. With it the score knows the
 * set up front, asks for nothing that is not there, and "no music yet" is a
 * silent state rather than a broken-looking one.
 */
await writeFile(join(OUT, "manifest.json"), `${JSON.stringify({ slots: available }, null, 2)}\n`);

if (missing.length) {
  console.log(`\n  ${cut} cut, ${missing.length} slot(s) have no source yet:`);
  for (const m of missing) console.log(`    · ${m}`);
  console.log(`  Drop files in content/audio/music/ and re-run. The site builds either way.`);
} else {
  console.log(`\n  ${cut} slots cut into public/audio/`);
}

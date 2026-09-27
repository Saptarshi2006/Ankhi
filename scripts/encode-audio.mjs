/**
 * Encode the intro's crowd audio.
 *
 * `fetch-audio.mjs` pulls two CC0 stadium recordings off the Internet Archive;
 * this cuts the segments worth keeping and turns them into seamlessly looping
 * beds.
 *
 * The loop is the whole trick. A hard cut at the loop point on a diffuse crowd
 * is a click, and every ten seconds. So each bed is built as
 * `crossfade(tail → head) + body`: the last 1.5s is blended into the first
 * 1.5s, which is what a crossfade is for, and the result wraps onto itself
 * without a seam.
 *
 * Mono AAC at 80kbps. The sources are mono, a crowd bed carries almost all of
 * its information in density rather than in stereo placement, and it halves
 * the payload. `decodeAudioData` plays .m4a everywhere this site is expected
 * to work, unlike the alternatives worth the bytes.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/encode-audio.mjs
 */
import { execFile } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "content", "audio");
const OUT = join(ROOT, "public", "audio");

/** How long the crossfade at the loop point runs. */
const XFADE = 1.5;

/**
 * `from` / `loop` are seconds into the source and the length of the finished
 * loop. The segments were chosen by measuring the RMS envelope: both recordings
 * sit at a steady -27dB through the middle and fall away at the ends, so the
 * cuts stay well inside the plateau and avoid the tape's head and tail noise.
 */
const BEDS = [
  {
    id: "crowd-bed",
    from: 1.0,
    loop: 16,
    // "Steady cheers" — a mid-level murmur for the swell as the balloon grows.
    loudness: -24,
  },
  {
    id: "crowd-roar",
    from: 40.0,
    loop: 16,
    // The fuller recording, for the return after the pop.
    loudness: -22,
  },
];

/**
 * The filter chain that turns one source segment into one seamless loop.
 *
 * `head` is the first XFADE seconds of the cut, `body` the middle, and `tail`
 * the XFADE seconds that follow. Crossfading tail into head and concatenating
 * the body after it means the loop's end dissolves into its own beginning.
 */
function loopFilter(from, loop, loudness) {
  const bodyEnd = from + loop;
  const tailEnd = bodyEnd + XFADE;
  return [
    `[0:a]atrim=start=${from}:end=${from + XFADE},asetpts=N/SR/TB[head]`,
    `[0:a]atrim=start=${from + XFADE}:end=${bodyEnd},asetpts=N/SR/TB[body]`,
    `[0:a]atrim=start=${bodyEnd}:end=${tailEnd},asetpts=N/SR/TB[tail]`,
    `[tail][head]acrossfade=d=${XFADE}:c1=tri:c2=tri[xf]`,
    `[xf][body]concat=n=2:v=0:a=1,` +
      `loudnorm=I=${loudness}:TP=-3:LRA=7,` +
      `aresample=48000[out]`,
  ].join(";");
}

const newer = async (a, b) => {
  try {
    return (await stat(a)).mtimeMs > (await stat(b)).mtimeMs;
  } catch {
    return true;
  }
};

await mkdir(OUT, { recursive: true });

for (const { id, from, loop, loudness } of BEDS) {
  const input = join(SRC, `${id}.wav`);
  const output = join(OUT, `${id}.m4a`);

  if (!(await newer(input, output))) {
    console.log(`  ${id}.m4a is current, skipping`);
    continue;
  }

  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel", "error",
    "-y",
    "-i", input,
    "-filter_complex", loopFilter(from, loop, loudness),
    "-map", "[out]",
    "-c:a", "aac",
    "-b:a", "80k",
    "-ac", "1",
    // Every browser that can run this site decodes AAC-LC in an MP4 container.
    "-profile:a", "aac_low",
    "-movflags", "+faststart",
    output,
  ]);

  const { size } = await stat(output);
  console.log(`  ${id}.m4a  ${loop}s loop from ${from}s  ${(size / 1000).toFixed(0)}KB`);
}

console.log("  crowd audio ready in public/audio/");

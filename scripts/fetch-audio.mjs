/**
 * Fetches the two stadium crowd recordings the intro plays.
 *
 * Both are from the USC Cinema / Sunset Editorial sound-effects collection on
 * the Internet Archive, dedicated to the public domain under CC0 1.0 — no
 * attribution required and no restriction on use:
 *
 *   https://creativecommons.org/publicdomain/zero/1.0/
 *   https://archive.org/details/Red_Library_Crowds_Sports
 *
 * Real recordings of real crowds off digitized tape, which is why they are
 * here rather than something synthesised. A crowd is many thousands of
 * overlapping voices; bandpassed noise gets you the shape of one but not the
 * grain, and the grain is most of why a stadium sounds like a stadium.
 *
 * Mono, 48kHz, 35s and 116s. `encode-audio.mjs` cuts the segments it needs.
 *
 * Not committed — same deal as `content/media/`. This script is the record of
 * where they came from, so a fresh clone can rebuild them.
 */
import { mkdir, writeFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const BASE = "https://archive.org/download/Red_Library_Crowds_Sports";

/**
 * `id` is the local name; `file` is the archive's name, spaces and all.
 *
 * `bed` is a steady mid-level murmur, used for the swell as the balloon grows.
 * `roar` is a fuller, wider crowd, used for the return after the pop — a
 * different recording on purpose, so coming back from the silence reads as the
 * room getting bigger rather than the same loop turned up.
 */
const SOURCES = [
  {
    id: "crowd-bed",
    file: "R07-27-Sporting Event with Steady Cheers.wav",
    expectBytes: 5_120_382,
    note: "steady cheers, ~-27dB from 1s to 30s",
  },
  {
    id: "crowd-roar",
    file: "R08-38-Cheering Crowd at Sporting Event.wav",
    expectBytes: 16_652_544,
    note: "fuller crowd, steady throughout",
  },
];

const OUT = resolve("content/audio");

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

await mkdir(OUT, { recursive: true });

for (const { id, file, expectBytes } of SOURCES) {
  const target = join(OUT, `${id}.wav`);

  if (await exists(target)) {
    console.log(`  ${id}.wav already here, skipping`);
    continue;
  }

  const url = `${BASE}/${encodeURIComponent(file).replace(/%2F/g, "/")}`;
  process.stdout.write(`  ${id}.wav  fetching… `);

  const response = await fetch(url, {
    headers: { "user-agent": "ankhi-19-build/1.0 (+birthday site build script)" },
  });
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength !== expectBytes) {
    throw new Error(
      `${file}: expected ${expectBytes} bytes, got ${bytes.byteLength}. ` +
        `The archive may have re-encoded it; check before trusting the cuts.`,
    );
  }

  await writeFile(target, bytes);
  console.log(`${(bytes.byteLength / 1e6).toFixed(1)}MB`);
}

console.log("  crowd audio ready in content/audio/");

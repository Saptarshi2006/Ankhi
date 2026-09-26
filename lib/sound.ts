/**
 * A balloon pop, synthesised.
 *
 * Two layered voices rather than a shipped audio file: a bandpassed noise
 * transient for the "crack" and a fast pitch-drooping sine for the "thump".
 * That keeps the repo asset-free and the payload ~0 bytes, and it means the
 * sound can never 404 on the day.
 *
 * Browsers only permit audio to start from a user gesture. The pop is
 * triggered by a click or keypress, so the context is always created inside
 * one — see `playPop`.
 */

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;

  context ??= new Ctor();
  if (context.state === "suspended") void context.resume();
  return context;
}

export function playPop() {
  const audio = getContext();
  if (!audio) return;

  const now = audio.currentTime;

  // Voice 1 — the crack. White noise under a fast exponential decay, bandpassed
  // to sit around 1.9kHz where a real latex pop reads brightest.
  const frames = Math.floor(audio.sampleRate * 0.12);
  const buffer = audio.createBuffer(1, frames, audio.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    channel[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 3;
  }

  const noise = audio.createBufferSource();
  noise.buffer = buffer;

  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1900;
  band.Q.value = 0.9;

  const noiseGain = audio.createGain();
  noiseGain.gain.setValueAtTime(0.85, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

  noise.connect(band).connect(noiseGain).connect(audio.destination);
  noise.start(now);

  // Voice 2 — the body. 720Hz down to 150Hz in 130ms.
  const thump = audio.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(720, now);
  thump.frequency.exponentialRampToValueAtTime(150, now + 0.13);

  const thumpGain = audio.createGain();
  thumpGain.gain.setValueAtTime(0.45, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

  thump.connect(thumpGain).connect(audio.destination);
  thump.start(now);
  thump.stop(now + 0.18);
}

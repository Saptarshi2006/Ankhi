/**
 * The balloon pop, and the one Web Audio context the whole site shares.
 *
 * Synthesised: a bandpassed noise transient for the crack and a fast
 * pitch-drooping sine for the thump. That keeps it asset-free, which means it
 * cannot 404 on the day, and it is the only sound here that has to be right —
 * the site stops and goes quiet for it.
 *
 * The music around it is cut and played by `lib/music.ts`; the context lives
 * here so both share one.
 *
 * **Browsers will not start audio from a scroll.** Audio needs a user gesture,
 * and the first click in this design is the pop itself. See `sound-unlock.ts`,
 * which takes whichever gesture arrives first.
 */

let context: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
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

/* ------------------------------------------------------------------ the pop */

export function playPop(at?: number) {
  const audio = getAudioContext();
  if (!audio) return;

  const now = at ?? audio.currentTime;

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

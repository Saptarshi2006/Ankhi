/**
 * The intro's two sounds: a stadium crowd, and the pop that silences it.
 *
 * `playPop` is synthesised — a bandpassed noise transient for the crack and a
 * fast pitch-drooping sine for the thump — which keeps the pop asset-free and
 * means it can never 404 on the day.
 *
 * The crowd is the opposite trade, and deliberately: a crowd is thousands of
 * overlapping voices, and bandpassed noise gets you the shape of one but not
 * the grain. The grain is most of why a stadium sounds like a stadium, so these
 * are real recordings off digitized tape, fetched and encoded by
 * `scripts/fetch-audio.mjs` and `scripts/encode-audio.mjs`. Both are CC0.
 *
 * Everything about how the crowd *moves* is synthesised and scroll-driven, so
 * the level and brightness are a function of progress rather than a recording's
 * own envelope. Two beds rather than one: the pre-pop swell is a mid-level
 * murmur and the return after the pop is a fuller crowd, so coming back out of
 * the silence reads as the room getting bigger rather than the same loop turned
 * up.
 *
 * **Browsers will not start audio from a scroll.** Audio needs a user gesture,
 * and the first click in this design is the pop itself — so on a reader whose
 * only interaction is that click, the crowd never plays before the pop. See
 * `sound-unlock.ts`, which takes the first gesture it can get.
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

/* ---------------------------------------------------------------- the crowd */

/**
 * Looping-filter cutoff at full and at nothing, in Hz.
 *
 * The filter is the second half of the scroll mapping. A crowd getting louder
 * reads as a volume knob; a crowd getting louder *and brighter* reads as a room
 * filling up, which is the anticipation the intro is built on.
 */
const BRIGHT_OPEN = 5200;
const BRIGHT_CLOSED = 620;

/** How fast the level and cutoff chase the scroll. Short enough to feel tied. */
const SMOOTHING = 0.12;

type BedId = "crowd-bed" | "crowd-roar";

export class Crowd {
  private readonly audio: AudioContext;
  private readonly master: GainNode;
  /** One running bed: the looping source and the filter that shapes it. */
  private readonly beds = new Map<BedId, { source: AudioBufferSourceNode; filter: BiquadFilterNode }>();
  private readonly buffers = new Map<BedId, AudioBuffer>();
  private current: BedId | null = null;
  private intensity = 0;
  private muted = false;

  private constructor(audio: AudioContext) {
    this.audio = audio;
    this.master = audio.createGain();
    this.master.gain.value = 0;
    this.master.connect(audio.destination);
  }

  static async load(): Promise<Crowd | null> {
    const audio = getAudioContext();
    if (!audio) return null;
    const crowd = new Crowd(audio);

    // Sequential rather than parallel: two 165KB files, and a phone opening
    // both decoders at once is the one moment this could stutter.
    for (const id of ["crowd-bed", "crowd-roar"] as BedId[]) {
      try {
        const response = await fetch(`/audio/${id}.m4a`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = await response.arrayBuffer();
        crowd.buffers.set(id, await audio.decodeAudioData(bytes));
      } catch {
        // No crowd is a quiet site, not a broken one. The intro still works.
        return null;
      }
    }
    return crowd;
  }

  /** Swap which recording is playing, at the same intensity. */
  private use(id: BedId) {
    if (this.current === id) return;
    this.current = id;

    for (const [bed, { source }] of this.beds) {
      if (bed === id) continue;
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
      source.disconnect();
      this.beds.delete(bed);
    }
    if (this.beds.has(id)) return;

    const buffer = this.buffers.get(id);
    if (!buffer) return;

    const source = this.audio.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = BRIGHT_CLOSED;
    filter.Q.value = 0.7;

    source.connect(filter).connect(this.master);
    source.start();
    this.beds.set(id, { source, filter });
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.apply();
  }

  /**
   * The scroll mapping. `0` is a distant murmur, `1` is a full room.
   *
   * Written with `setTargetAtTime` rather than a ramp because a scrub produces
   * a new target every frame, and a ramp restarted each time would lag the
   * scroll behind by however long the ramp was set to.
   */
  setIntensity(value: number) {
    this.intensity = Math.min(1, Math.max(0, value));
    this.apply();
  }

  private apply() {
    const now = this.audio.currentTime;
    const level = this.muted ? 0 : this.intensity;
    this.master.gain.setTargetAtTime(level * 0.9, now, SMOOTHING);

    const cutoff = BRIGHT_CLOSED + (BRIGHT_OPEN - BRIGHT_CLOSED) * this.intensity;
    for (const { filter } of this.beds.values()) {
      filter.frequency.setTargetAtTime(cutoff, now, SMOOTHING);
    }
  }

  /**
   * Cut to silence over `seconds`, so the pop has somewhere to land.
   *
   * Returns the instant the cut completes. The caller schedules the pop against
   * the same audio clock rather than a timer, which is the only way to be sure
   * the gap is the length it claims to be.
   */
  silence(seconds = 0.12): number {
    const now = this.audio.currentTime;
    const gain = this.master.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + seconds);
    return now + seconds;
  }

  /**
   * The crowd coming back. A fast attack with a slight settle, because a crowd
   * does not fade up — it goes up all at once and then eases off the peak.
   *
   * `at` is when it starts, on the audio clock, and it must be *after* the pop:
   * this cancels scheduled values, so calling it straight after `silence` wipes
   * the cut and leaves the pop landing on top of the crowd. Measured before the
   * fix, the master gain eased 0.9 → 0.53 and stopped, and the silence the whole
   * sequence is built around never happened.
   *
   * It starts from `from`, not from the gain's current value. At scheduling time
   * the silence ramp has not run yet, so the current value is still the loud
   * one, and reading it would jump the crowd back up to full at the moment it
   * was supposed to return.
   */
  surge(at: number, level = 0.85, seconds = 0.9, from = 0) {
    this.use("crowd-roar");
    this.intensity = level;

    const now = this.audio.currentTime;
    const gain = this.master.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(from, at);
    gain.linearRampToValueAtTime(level * 0.9, at + seconds * 0.35);
    gain.linearRampToValueAtTime(level * 0.62, at + seconds);

    for (const { filter } of this.beds.values()) {
      filter.frequency.cancelScheduledValues(now);
      filter.frequency.setValueAtTime(BRIGHT_CLOSED, at);
      filter.frequency.linearRampToValueAtTime(BRIGHT_OPEN, at + seconds * 0.4);
    }
  }

  /** Back to the pre-pop bed, at whatever the scroll says. */
  reset() {
    this.use("crowd-bed");
  }

  dispose() {
    for (const { source } of this.beds.values()) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
      source.disconnect();
    }
    this.beds.clear();
    this.master.disconnect();
  }
}

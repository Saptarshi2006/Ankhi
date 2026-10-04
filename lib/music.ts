"use client";

import { getAudioContext } from "@/lib/sound";
import { SLOT, type SlotId } from "@/content/music";

/**
 * The score: everything that plays music, and the transitions between it.
 *
 * A `Score` owns a set of *voices* — one looping source and one gain per slot —
 * and every transition is a pair of ramps on the audio clock. Crossfades need
 * two voices alive at once, so a voice is only stopped once whatever is
 * replacing it has finished ramping.
 *
 * ## Everything is scheduled, nothing is timed
 *
 * The pop, the silence that holds it, and the swell that follows are all placed
 * against `AudioContext.currentTime`. A `setTimeout` between two audio events
 * drifts by however long the main thread was busy, and a pop that lands early
 * lands on the music's tail instead of in the gap. This is the reason the class
 * takes absolute times rather than durations everywhere it matters.
 *
 * ## Ramping from an explicit value
 *
 * `silence` returns the instant the fade completes so the caller can place the
 * next sound inside it. Anything that starts *later* has to name its own
 * starting value rather than reading the gain's current one: at scheduling time
 * the fade has not run yet, so `gain.value` is still the loud value and using it
 * jumps the music back up at the exact moment it was meant to return. `resume`
 * therefore takes an explicit `from`.
 *
 * ## One slot at a time
 *
 * Slots are fetched and decoded on demand, and the caller preloads the next
 * beat's slot while the current one plays. A beat is thirty to forty seconds of
 * reading, which is far more than enough for a few hundred kilobytes, and it
 * keeps the first paint free of music.
 *
 * ## Nothing is required
 *
 * A slot that will not load is remembered as absent and skipped. The site then
 * has no music but still has the pop, and nothing throws.
 */

/** How long a crossfade between two beats takes, in seconds. */
export const BEAT_CROSSFADE = 1.8;

type Voice = {
  slot: SlotId;
  source: AudioBufferSourceNode;
  gain: GainNode;
  buffer: AudioBuffer;
};

/** Tracks a ramp that has been scheduled, so it can be cancelled cleanly. */
type Ramp = { from: number; to: number; start: number; end: number };

export class Score {
  private readonly audio: AudioContext;
  private readonly master: GainNode;
  private readonly voices = new Map<SlotId, Voice>();
  private readonly buffers = new Map<SlotId, AudioBuffer>();
  private readonly absent = new Set<SlotId>();
  /** Which slots the encoder actually cut, fetched once. Null until it lands. */
  private available: Set<SlotId> | null = null;
  private manifestLoaded = false;
  private readonly loading = new Map<SlotId, Promise<boolean>>();
  private readonly ramps = new Map<SlotId, Ramp>();
  private current: SlotId | null = null;
  private muted = false;
  /**
   * A transition that was asked for before its buffer arrived.
   *
   * Without this a crossfade to a slot that has not finished decoding is simply
   * dropped, and the beat is silent until the reader happens to scroll again.
   * Measured with the real files: `return` and `beat-0` were never preloaded, so
   * the pop silenced the music and nothing came back, and the first year had no
   * track at all. Latency on a phone makes this the normal case, not an edge one.
   */
  private wanted: { slot: SlotId; seconds: number; resolve: (v: boolean) => void } | null = null;

  private constructor(audio: AudioContext) {
    this.audio = audio;
    this.master = audio.createGain();
    this.master.gain.value = 1;
    this.master.connect(audio.destination);
  }

  /**
   * Null when there is no Web Audio, which is the honest answer: a caller that
   * got a `Score` back can rely on it, and a caller that got null knows to skip
   * the music while the pop still works, because `playPop` builds its own.
   */
  static create(): Score | null {
    const audio = getAudioContext();
    return audio ? new Score(audio) : null;
  }

  /** True if this slot has been loaded, or at least is worth trying. */
  has(slot: SlotId): boolean {
    return this.buffers.has(slot) || (!this.absent.has(slot) && this.loading.has(slot));
  }

  /**
   * Which slots exist, according to the encoder's manifest.
   *
   * Fetched once, and only consulted to avoid *asking* — the individual files
   * are still loaded on demand. Without it the site requests all eight slots and
   * logs a 404 for each on every visit until the music is in place, which makes
   * a deliberately quiet site look broken. A missing manifest is treated as
   * "unknown" rather than "empty", so the first load still tries.
   */
  private async known(): Promise<boolean> {
    if (this.manifestLoaded) return true;
    this.manifestLoaded = true;
    try {
      const response = await fetch("/audio/manifest.json");
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { slots?: string[] };
      if (Array.isArray(data.slots)) {
        this.available = new Set(data.slots as SlotId[]);
      }
    } catch {
      // No manifest: fall back to trying, and let the 404 path handle it.
    }
    return true;
  }

  /**
   * Load and decode a slot. Resolves false if it is not there, which is a
   * normal state rather than a failure.
   */
  async load(slot: SlotId): Promise<boolean> {
    if (this.buffers.has(slot)) return true;
    if (this.absent.has(slot)) return false;

    await this.known();
    if (this.available && !this.available.has(slot)) {
      this.absent.add(slot);
      return false;
    }

    const inFlight = this.loading.get(slot);
    if (inFlight) return inFlight;

    const job = (async () => {
      try {
        const response = await fetch(`/audio/${slot}.m4a`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = await response.arrayBuffer();
        this.buffers.set(slot, await this.audio.decodeAudioData(bytes));
        this.absent.delete(slot);
        return true;
      } catch {
        this.absent.add(slot);
        return false;
      } finally {
        this.loading.delete(slot);
      }
    })();

    this.loading.set(slot, job);
    return job;
  }

  /** Start loading without waiting. Never rejects. */
  preload(slot: SlotId): void {
    void this.load(slot);
  }

  private voiceFor(slot: SlotId): Voice | null {
    const existing = this.voices.get(slot);
    if (existing) return existing;

    const buffer = this.buffers.get(slot);
    if (!buffer) return null;

    const source = this.audio.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = this.audio.createGain();
    gain.gain.value = 0;

    source.connect(gain).connect(this.master);
    source.start();

    const voice: Voice = { slot, source, gain, buffer };
    this.voices.set(slot, voice);
    return voice;
  }

  /**
   * Stop a voice once nothing else wants it.
   *
   * `releaseAt` is on the audio clock, so a voice being faded out is not torn
   * down until the fade is genuinely over — otherwise the crossfade clicks at
   * the end instead of the beginning.
   */
  private release(slot: SlotId, releaseAt: number) {
    const voice = this.voices.get(slot);
    if (!voice) return;
    this.voices.delete(slot);
    this.ramps.delete(slot);
    try {
      voice.source.stop(releaseAt);
    } catch {
      // Already stopped.
    }
    window.setTimeout(
      () => {
        try {
          voice.source.disconnect();
          voice.gain.disconnect();
        } catch {
          // Already disconnected.
        }
      },
      Math.max(0, (releaseAt - this.audio.currentTime) * 1000) + 100,
    );
  }

  /**
   * Ramp one voice's gain. Always cancels what was scheduled before, and always
   * states the value it is coming *from* — see the note at the top of the file.
   */
  private ramp(voice: Voice, from: number, to: number, at: number, seconds: number) {
    const now = this.audio.currentTime;
    const start = Math.max(at, now);
    const param = voice.gain.gain;

    param.cancelScheduledValues(now);
    param.setValueAtTime(from, start);
    if (seconds <= 0) {
      param.setValueAtTime(to, start);
    } else {
      param.linearRampToValueAtTime(to, start + seconds);
    }
    this.ramps.set(voice.slot, { from, to, start, end: start + seconds });
  }

  private currentValue(slot: SlotId): number {
    return this.ramps.get(slot)?.to ?? this.voices.get(slot)?.gain.gain.value ?? 0;
  }

  /** Start a slot from silence, optionally already at a level. */
  play(slot: SlotId, options: { level?: number; at?: number; fade?: number } = {}): boolean {
    if (this.muted) return false;
    const voice = this.voiceFor(slot);
    if (!voice) return false;

    const at = options.at ?? this.audio.currentTime;
    const level = options.level ?? 1;
    this.ramp(voice, 0, level, at, options.fade ?? 0);
    this.current = slot;
    return true;
  }

  /**
   * Move to a new slot, crossfading from whatever is playing.
   *
   * A no-op if that slot is already current, which matters because the beat
   * tracker runs on every scroll frame. If the slot is still loading the
   * intention is remembered and applied the moment its buffer lands.
   */
  crossfade(to: SlotId, seconds = BEAT_CROSSFADE): void {
    if (to === this.current) {
      this.wanted = null;
      return;
    }
    if (this.muted) return;

    const incoming = this.voiceFor(to);
    if (!incoming) {
      // Remember, and retry once there is something to fade in. Only on success,
      // so a slot that will never arrive does not retry on every scroll frame.
      void this.load(to).then((ok) => {
        if (ok && this.wanted?.slot === to) this.crossfade(to, this.wanted.seconds);
      });
      this.wanted = { slot: to, seconds, resolve: () => {} };
      return;
    }
    this.wanted = null;

    const now = this.audio.currentTime;
    const outgoing = this.current;

    this.ramp(incoming, 0, 1, now, seconds);
    this.current = to;

    if (outgoing) {
      const from = this.currentValue(outgoing);
      const voice = this.voices.get(outgoing);
      if (voice) this.ramp(voice, from, 0, now, seconds);
      // Released once its fade is over, so the two overlap for the whole of it.
      this.releaseLater(outgoing, now + seconds);
    }
  }

  /**
   * A voice that is on its way out but must survive its own fade.
   *
   * `release` normally deletes the voice immediately and stops the source at a
   * future time, which is fine — but a crossfade can be interrupted by another
   * crossfade, and then the abandoned voice would keep running. This holds the
   * slot for the length of the fade and stops it properly.
   */
  private releaseLater(slot: SlotId, at: number) {
    window.setTimeout(() => {
      const voice = this.voices.get(slot);
      if (!voice) return;
      const ramp = this.ramps.get(slot);
      // Only release if this voice is still the one that was fading out, and it
      // never became the current slot again.
      if (this.current === slot) return;
      if (ramp && ramp.to > 0) return;
      this.release(slot, this.audio.currentTime);
    }, Math.max(0, (at - this.audio.currentTime) * 1000) + 60);
  }

  /**
   * Follow a value continuously, for the balloon. Smoothed rather than ramped,
   * because it is driven per frame from the scroll and a ramp restarted every
   * frame would lag behind.
   */
  track(slot: SlotId, value: number, smoothing = 0.12): void {
    const voice = this.voices.get(slot);
    if (!voice) return;
    const level = this.muted ? 0 : Math.min(1, Math.max(0, value));
    voice.gain.gain.setTargetAtTime(level, this.audio.currentTime, smoothing);
    this.ramps.set(slot, { from: level, to: level, start: 0, end: 0 });
  }

  /**
   * Cut to silence. Returns the instant it has finished, so the caller can
   * place the pop inside the gap rather than near it.
   */
  silence(seconds = 0.12): number {
    const now = this.audio.currentTime;
    const slot = this.current;
    if (slot) {
      const voice = this.voices.get(slot);
      const from = this.currentValue(slot);
      if (voice) this.ramp(voice, from, 0, now, seconds);
    }
    return now + seconds;
  }

  /**
   * Bring a slot back up out of nothing.
   *
   * `from` is explicit and defaults to 0: this is the call that follows
   * `silence`, and reading the gain's current value here would restart the music
   * at full level the instant it was meant to return.
   */
  resume(slot: SlotId, at: number, seconds = 0.9, level = 1, from = 0): void {
    if (this.muted) return;
    const voice = this.voiceFor(slot);
    if (!voice) {
      /*
       * The return from the pop. There is no second chance at this one — the
       * silence is already open and the pop is already scheduled, so a track
       * that has not arrived by now has missed its moment. Load it, and take it
       * as soon as it lands, even if that is slightly late: silence with no
       * music after it is worse than a late entrance.
       */
      void this.load(slot).then((ok) => {
        if (ok) this.resume(slot, this.audio.currentTime, seconds, level, from);
      });
      return;
    }
    this.ramp(voice, from, level, at, seconds);
    this.current = slot;
  }

  /** Fade a slot out and move on. */
  fadeOut(slot: SlotId, seconds = 1.2): void {
    const voice = this.voices.get(slot);
    const from = this.currentValue(slot);
    const now = this.audio.currentTime;
    if (voice) this.ramp(voice, from, 0, now, seconds);
    if (this.current === slot) this.current = null;
    this.releaseLater(slot, now + seconds);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    const now = this.audio.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(muted ? 0 : 1, now, 0.05);
  }

  get isMuted(): boolean {
    return this.muted;
  }

  get nowPlaying(): SlotId | null {
    return this.current;
  }

  /** Load the first slot and every slot after it, as a courtesy. */
  preloadAll(): void {
    for (const slot of Object.values(SLOT)) this.preload(slot);
  }

  dispose() {
    for (const slot of [...this.voices.keys()]) this.release(slot, this.audio.currentTime);
    this.voices.clear();
    this.buffers.clear();
    this.available = null;
    this.manifestLoaded = false;
    try {
      this.master.disconnect();
    } catch {
      // Already disconnected.
    }
  }
}

/*
 * A single score for the page.
 *
 * The same reason the `AudioContext` is a module singleton: two contexts means
 * two decode graphs and two sets of scheduled events, and the pop would have to
 * know which one to schedule against. The intro creates it on the first gesture
 * and the timeline reads it; neither owns it alone.
 */
let instance: Score | null = null;
let attempted = false;

export function getScore(): Score | null {
  return instance;
}

/** The score, creating it on first use. Null when there is no Web Audio. */
export function ensureScore(): Score | null {
  if (attempted) return instance;
  attempted = true;
  instance = Score.create();
  return instance;
}

export function releaseScore(): void {
  instance?.dispose();
  instance = null;
  attempted = false;
}

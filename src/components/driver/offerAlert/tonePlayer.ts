import type { TonePlayer } from "./controller";

const VOLUME_KEY = "1145-driver-alert-volume";

export function getAlertVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(v) && localStorage.getItem(VOLUME_KEY) !== null ? Math.min(1, Math.max(0, v)) : 1;
  } catch {
    return 1;
  }
}
export function setAlertVolume(v: number) {
  try {
    localStorage.setItem(VOLUME_KEY, String(Math.min(1, Math.max(0, v))));
  } catch {
    /* storage unavailable */
  }
}

/**
 * Looping offer tone synthesised with Web Audio (no asset to ship or cache),
 * plus a repeating vibration pattern. unlock() must run from a user gesture
 * (e.g. "Go online"); until then start() still vibrates and reports blocked.
 */
export class WebAudioTonePlayer implements TonePlayer {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private vibrateTimer: ReturnType<typeof setInterval> | null = null;
  private playing = false;
  onBlocked: (() => void) | null = null;

  constructor(private pattern: readonly number[]) {}

  private ensureCtx() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    return this.ctx;
  }

  get unlocked() {
    return this.ctx?.state === "running";
  }

  async unlock() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    try {
      await ctx.resume();
      // A silent blip primes iOS WebKit.
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.01);
    } catch {
      /* stays locked */
    }
  }

  /** One ring cycle for "Test sound"; independent of the alert's own playback. */
  async preview() {
    await this.unlock();
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return false;
    const g = ctx.createGain();
    g.gain.value = 0.6 * getAlertVolume();
    g.connect(ctx.destination);
    this.chirp(ctx.currentTime + 0.02, g);
    setTimeout(() => g.disconnect(), 1500);
    return true;
  }

  private chirp(at: number, out: GainNode | null = this.gain) {
    if (!this.ctx || !out) return;
    // Two-note ring, ~1.2 s cycle (seamless loop).
    [
      [880, 0],
      [1320, 0.18],
      [880, 0.5],
      [1320, 0.68],
    ].forEach(([freq, offset]) => {
      const o = this.ctx!.createOscillator();
      const env = this.ctx!.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      const t = at + offset;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(1, t + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(env).connect(out);
      o.start(t);
      o.stop(t + 0.18);
    });
  }

  start() {
    if (this.playing) return;
    this.playing = true;
    const ctx = this.ensureCtx();
    const volume = getAlertVolume();
    if (ctx && ctx.state === "running" && volume > 0) {
      this.gain = ctx.createGain();
      this.gain.gain.value = 0.6 * volume;
      this.gain.connect(ctx.destination);
      this.chirp(ctx.currentTime + 0.02);
      this.loopTimer = setInterval(() => this.chirp(ctx.currentTime + 0.02), 1200);
    } else if (volume > 0) {
      this.onBlocked?.();
    }
    const cycle = this.pattern.reduce((a, b) => a + b, 0);
    try {
      navigator.vibrate?.(this.pattern as number[]);
    } catch {
      /* unsupported */
    }
    this.vibrateTimer = setInterval(() => {
      try {
        navigator.vibrate?.(this.pattern as number[]);
      } catch {
        /* unsupported */
      }
    }, cycle);
  }

  /** Idempotent; also cancels vibration. */
  stop() {
    this.playing = false;
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    if (this.vibrateTimer) {
      clearInterval(this.vibrateTimer);
      this.vibrateTimer = null;
    }
    if (this.gain && this.ctx) {
      try {
        this.gain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.gain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.gain.disconnect();
      } catch {
        /* already disconnected */
      }
      this.gain = null;
    }
    try {
      navigator.vibrate?.(0);
    } catch {
      /* unsupported */
    }
  }
}

/** App-wide player so "Go online" can unlock the same instance the alert uses. */
export const offerTone = new WebAudioTonePlayer([400, 200, 400, 1000]);

/**
 * Incoming-offer alert state machine (no UI). See the implementation guide:
 *
 *   IDLE → RINGING → (slide) ACCEPTING → ACCEPTED | FAILED → IDLE
 *              │  └─ server cancel → IDLE
 *              └─ timeout → MISSED → IDLE (or next queued offer)
 *
 * Hard rules: the tone plays only in RINGING, and every exit from RINGING goes
 * through leaveRinging(), the single place the tone is stopped. The server,
 * not this timer, decides whether an accept succeeded.
 */

export const ALERT_CONFIG = {
  ringDurationMs: 10_000, // default; the server's ringMs overrides it per offer
  missedDurationMs: 5_000,
  failedDurationMs: 3_000,
  minShowMs: 2_000, // offers arriving with less left are reported missed, never shown
  slideAcceptThreshold: 0.85,
  allowLateAccept: false,
  vibratePattern: [400, 200, 400, 1000] as readonly number[],
} as const;

export type OfferKind = "order" | "ride";

export interface Offer {
  id: string;
  kind: OfferKind;
  createdAt: string;
  expiresAt: string;
  serverNow: string;
  ringMs?: number;
  /** One-way delivery delay estimated by the transport (ms). */
  transitMs?: number;
  /** performance.now() when this device received it (set by the controller). */
  receivedAt?: number;
  priority?: string;
  pickup: { label: string; lat?: number | null; lng?: number | null };
  dropoff?: { label: string; lat?: number | null; lng?: number | null };
  fare?: { amount: number; currency: string } | null;
  distanceKm?: number | null;
  etaMinutes?: number | null;
}

export type Phase = "IDLE" | "RINGING" | "ACCEPTING" | "MISSED" | "ACCEPTED" | "FAILED";

export interface AlertState {
  phase: Phase;
  offer: Offer | null;
  ringEndsAt: number | null; // performance.now() based
  ringTotalMs: number | null;
  message?: string;
}

export interface TonePlayer {
  start(): void;
  stop(): void;
  unlock(): Promise<void>;
}

export interface OfferApi {
  accept(offer: Offer): Promise<void>; // resolves on success, rejects (with message) if gone
  reportMissed(offer: Offer): void; // fire-and-forget
  log?(offer: Offer, event: string, payload?: Record<string, unknown>): void;
}

export class OfferAlertController {
  private state: AlertState = { phase: "IDLE", offer: null, ringEndsAt: null, ringTotalMs: null };
  private queue: Offer[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(s: AlertState) => void>();
  private shownAt = 0;
  /** Offer ids this device already handled; late duplicates are ignored. */
  private seen = new Set<string>();

  constructor(
    private tone: TonePlayer,
    private api: OfferApi,
    private cfg = ALERT_CONFIG,
  ) {}

  get current() {
    return this.state;
  }

  subscribe(fn: (s: AlertState) => void) {
    this.listeners.add(fn);
    fn(this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Called by the transport (realtime / poll / push). */
  onOffer(incoming: Offer) {
    const offer = { ...incoming, receivedAt: incoming.receivedAt ?? performance.now() };
    if (this.seen.has(offer.id) || this.state.offer?.id === offer.id || this.queue.some((o) => o.id === offer.id)) return;
    if (this.state.phase !== "IDLE") {
      this.queue.push(offer);
      return;
    }
    this.startRinging(offer);
  }

  /** The server withdrew the offer (customer cancelled, or someone else took it). */
  onOfferCancelled(offerId: string) {
    this.queue = this.queue.filter((o) => o.id !== offerId);
    if (this.state.offer?.id === offerId && this.state.phase === "RINGING") {
      const offer = this.state.offer;
      this.leaveRinging();
      this.api.log?.(offer, "offer_cancelled_by_server");
      this.seen.add(offerId);
      this.toIdle("Offer withdrawn");
    }
  }

  /** Slider passed the threshold (or keyboard / screen-reader accept). */
  async accept() {
    if (this.state.phase !== "RINGING" || !this.state.offer) return;
    const offer = this.state.offer;
    const msToAccept = Math.round(performance.now() - this.shownAt);
    this.leaveRinging(); // tone stops the moment the slide completes
    this.seen.add(offer.id);
    this.set({ phase: "ACCEPTING", offer, ringEndsAt: null, ringTotalMs: null });
    try {
      await this.api.accept(offer);
      this.api.log?.(offer, "offer_accepted", { msToAccept });
      this.set({ phase: "ACCEPTED", offer, ringEndsAt: null, ringTotalMs: null });
      this.timer = setTimeout(() => this.toIdle(), 0);
    } catch (e) {
      this.api.log?.(offer, "offer_accept_failed", { reason: e instanceof Error ? e.message : String(e) });
      this.set({ phase: "FAILED", offer, ringEndsAt: null, ringTotalMs: null, message: "Offer no longer available" });
      this.timer = setTimeout(() => this.toIdle(), this.cfg.failedDurationMs);
    }
  }

  dismiss() {
    if (this.state.phase === "MISSED" || this.state.phase === "FAILED") this.toIdle();
  }

  /** Re-check the ring deadline (after the app returns from the background). */
  resync() {
    if (this.state.phase === "RINGING" && this.state.ringEndsAt != null && performance.now() >= this.state.ringEndsAt) this.onTimeout();
  }

  /** Driver went offline / logged out / page hidden for good. */
  shutdown() {
    if (this.state.phase === "RINGING" && this.state.offer) {
      const offer = this.state.offer;
      this.leaveRinging();
      this.api.reportMissed(offer);
    }
    this.queue = [];
    this.toIdle();
  }

  // ---- internals ----

  private startRinging(offer: Offer) {
    const window = offer.ringMs ?? this.cfg.ringDurationMs;
    // Server-relative remaining time; the device clock is never trusted.
    const waited = offer.receivedAt != null ? performance.now() - offer.receivedAt : 0; // time spent queued
    const remaining = Math.min(window, Date.parse(offer.expiresAt) - Date.parse(offer.serverNow) - (offer.transitMs ?? 0) - waited);
    if (!(remaining >= this.cfg.minShowMs)) {
      this.seen.add(offer.id);
      this.api.reportMissed(offer);
      this.next();
      return;
    }
    this.tone.start();
    this.shownAt = performance.now();
    this.set({ phase: "RINGING", offer, ringEndsAt: this.shownAt + remaining, ringTotalMs: window });
    this.api.log?.(offer, "offer_shown", { remainingMs: Math.round(remaining), deliveryDelayMs: Math.round(window - remaining) });
    this.timer = setTimeout(() => this.onTimeout(), remaining);
  }

  private onTimeout() {
    if (this.state.phase !== "RINGING" || !this.state.offer) return;
    const offer = this.state.offer;
    this.leaveRinging(); // tone stops BEFORE the screen turns red
    this.seen.add(offer.id);
    this.api.reportMissed(offer);
    this.api.log?.(offer, "offer_missed");
    this.set({ phase: "MISSED", offer, ringEndsAt: null, ringTotalMs: null, message: "Missed: offer expired" });
    this.timer = setTimeout(() => this.toIdle(), this.cfg.missedDurationMs);
  }

  /** Single exit point from RINGING: the only place the tone is stopped while ringing. */
  private leaveRinging() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.tone.stop();
  }

  private toIdle(message?: string) {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.tone.stop(); // defensive; harmless if already stopped
    this.set({ phase: "IDLE", offer: null, ringEndsAt: null, ringTotalMs: null, message });
    this.next();
  }

  private next() {
    // startRinging() ages queued offers by their local wait and drops any under minShowMs.
    const o = this.queue.shift();
    if (o) this.startRinging(o);
  }

  private set(s: AlertState) {
    this.state = s;
    this.listeners.forEach((fn) => fn(s));
  }
}

import React, { useEffect, useRef, useState } from "react";
import { AlertOctagon, Bike, Car, Check, Loader2, MapPin, Navigation, Package, XCircle } from "lucide-react";
import type { AlertState, OfferAlertController } from "./controller";
import SlideToAccept from "./SlideToAccept";
import "./offerAlert.css";

/** requestAnimationFrame countdown (seconds, 1 decimal internally). */
function useCountdown(endsAt: number | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (endsAt == null) return;
    let raf = 0;
    const tick = () => {
      setLeft(Math.max(0, (endsAt - performance.now()) / 1000));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [endsAt]);
  return left;
}

const CountdownRing: React.FC<{ seconds: number; total: number }> = ({ seconds, total }) => {
  const r = 26;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, seconds / total) : 0;
  return (
    <div className="offer-alert__ring" role="timer" aria-label={`${Math.ceil(seconds)} seconds left`}>
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="#fff"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span>{Math.ceil(seconds)}</span>
    </div>
  );
};

const money = (n: number, cur: string) => `${cur === "ZAR" ? "R" : cur + " "}${Number(n).toFixed(2)}`;

/** Full-screen alert. Renders state only; all logic lives in the controller. */
const OfferAlert: React.FC<{ controller: OfferAlertController }> = ({ controller }) => {
  const [s, setS] = useState<AlertState>(controller.current);
  useEffect(() => controller.subscribe(setS), [controller]);
  const secondsLeft = useCountdown(s.phase === "RINGING" ? s.ringEndsAt : null);
  const root = useRef<HTMLDivElement>(null);
  const slider = useRef<{ focus: () => void }>(null);

  // Focus the slider when ringing starts; keep focus inside the dialog.
  useEffect(() => {
    if (s.phase === "RINGING") slider.current?.focus();
    else if (s.phase !== "IDLE") root.current?.focus();
  }, [s.phase, s.offer?.id]);

  // Keep the screen awake while ringing.
  useEffect(() => {
    if (s.phase !== "RINGING") return;
    let lock: { release: () => Promise<void> } | null = null;
    (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => undefined);
    return () => {
      lock?.release().catch(() => undefined);
    };
  }, [s.phase]);

  if (s.phase === "IDLE" || s.phase === "ACCEPTED" || !s.offer) return null;
  const o = s.offer;
  const KindIcon = o.kind === "ride" ? Car : o.priority === "urgent" ? Bike : Package;

  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !root.current) return;
    const items = root.current.querySelectorAll<HTMLElement>('button, [tabindex="0"]');
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={root}
      tabIndex={-1}
      className={`offer-alert offer-alert--${s.phase.toLowerCase()}`}
      role="alertdialog"
      aria-modal="true"
      aria-live="assertive"
      aria-label={`New ${o.kind === "ride" ? "ride" : "order"} offer`}
      onKeyDown={trapTab}
    >
      <header className="offer-alert__header">
        <span className="offer-alert__kind">
          {s.phase === "MISSED" || s.phase === "FAILED" ? <XCircle aria-hidden /> : s.phase === "ACCEPTING" ? <Check aria-hidden /> : <KindIcon aria-hidden />}
          {s.phase === "MISSED" ? "Missed" : s.phase === "FAILED" ? "Not available" : o.kind === "ride" ? "New ride" : o.priority === "urgent" ? "New urgent order" : "New order"}
        </span>
        {s.phase === "RINGING" && <CountdownRing seconds={secondsLeft} total={(s.ringTotalMs ?? 10_000) / 1000} />}
      </header>

      <div className="offer-alert__summary">
        {o.fare && <p className="offer-alert__fare">{money(o.fare.amount, o.fare.currency)}</p>}
        <p className="offer-alert__line">
          <MapPin aria-hidden /> <span>{o.pickup.label}</span>
        </p>
        {o.dropoff?.label && (
          <p className="offer-alert__line">
            <Navigation aria-hidden /> <span>{o.dropoff.label}</span>
          </p>
        )}
        <p className="offer-alert__meta">
          {o.distanceKm != null && <span>{Number(o.distanceKm).toFixed(1)} km trip</span>}
          {o.etaMinutes != null && <span>{o.etaMinutes} min to pickup</span>}
        </p>
      </div>

      <footer className="offer-alert__footer">
        {s.phase === "RINGING" && (
          <>
            <SlideToAccept ref={slider} onAccept={() => controller.accept()} label="Slide to accept" />
            {/* Screen-reader / switch-control alternative to dragging. */}
            <button type="button" className="sr-only" onClick={() => controller.accept()}>
              Accept offer
            </button>
          </>
        )}
        {s.phase === "ACCEPTING" && (
          <p className="offer-alert__status">
            <Loader2 className="animate-spin" aria-hidden /> Accepting…
          </p>
        )}
        {s.phase === "MISSED" && (
          <>
            <p className="offer-alert__status">
              <AlertOctagon aria-hidden /> {s.message ?? "Missed: offer expired"}
            </p>
            <button type="button" className="offer-alert__dismiss" onClick={() => controller.dismiss()}>
              Dismiss
            </button>
          </>
        )}
        {s.phase === "FAILED" && (
          <>
            <p className="offer-alert__status">
              <XCircle aria-hidden /> {s.message ?? "Offer no longer available"}
            </p>
            <button type="button" className="offer-alert__dismiss" onClick={() => controller.dismiss()}>
              OK
            </button>
          </>
        )}
      </footer>
    </div>
  );
};

export default OfferAlert;

import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { ALERT_CONFIG } from "./controller";

const THUMB = 64;

/**
 * Slide-to-accept: fires once on release past the threshold, snaps back
 * otherwise. Pointer capture + touch-action:none keep the drag on track.
 * Enter/Space on the focused thumb accepts (keyboard / switch access).
 */
const SlideToAccept = forwardRef<{ focus: () => void }, { onAccept: () => void; label: string }>(({ onAccept, label }, ref) => {
  const track = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [done, setDone] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startX: number; max: number; crossed: boolean } | null>(null);

  useImperativeHandle(ref, () => ({ focus: () => thumb.current?.focus() }));

  const fire = () => {
    if (done) return;
    setDone(true);
    try {
      navigator.vibrate?.(30);
    } catch {
      /* unsupported */
    }
    onAccept();
  };

  const down = (e: React.PointerEvent) => {
    if (done || !track.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX - x, max: track.current.clientWidth - THUMB - 8, crossed: false };
    setDragging(true);
  };
  const move = (e: React.PointerEvent) => {
    if (!drag.current || done) return;
    const nx = Math.max(0, Math.min(drag.current.max, e.clientX - drag.current.startX));
    const crossed = nx / drag.current.max >= ALERT_CONFIG.slideAcceptThreshold;
    if (crossed && !drag.current.crossed) {
      try {
        navigator.vibrate?.(12); // haptic tick at the threshold
      } catch {
        /* unsupported */
      }
    }
    drag.current.crossed = crossed;
    setX(nx);
  };
  const up = () => {
    if (!drag.current || done) return;
    const { max } = drag.current;
    drag.current = null;
    setDragging(false);
    if (max > 0 && x / max >= ALERT_CONFIG.slideAcceptThreshold) {
      setX(max);
      fire();
    } else {
      setX(0);
    }
  };

  const max = (track.current?.clientWidth ?? THUMB + 8) - THUMB - 8;
  const pct = max > 0 ? Math.round((x / max) * 100) : 0;

  return (
    <div ref={track} className="offer-slide">
      <span className="offer-slide__label" style={{ opacity: Math.max(0, 1 - x / 200) }} aria-hidden>
        {label} ›››
      </span>
      <div
        ref={thumb}
        className="offer-slide__thumb"
        role="slider"
        tabIndex={0}
        aria-label={`${label}. Press Enter to accept.`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        style={{ transform: `translateX(${x}px)`, transition: dragging ? "none" : "transform 200ms" }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setX(max);
            fire();
          }
        }}
      >
        ➜
      </div>
    </div>
  );
});
SlideToAccept.displayName = "SlideToAccept";

export default SlideToAccept;

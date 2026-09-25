import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ProductImageViewerProps {
  src: string;
  alt: string;
  /** Swipe handlers; omit when there is only one image. */
  onNext?: () => void;
  onPrev?: () => void;
  className?: string;
}

const ZOOM = 2.5;
const SWIPE_PX = 50;
const DOUBLE_TAP_MS = 300;

type Point = { x: number; y: number };

/**
 * Product image with double-click / double-tap zoom (pan while zoomed) and
 * horizontal swipe to change image. Pagination controls live outside this
 * component and keep working as before.
 */
const ProductImageViewer: React.FC<ProductImageViewerProps> = ({ src, alt, onNext, onPrev, className }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [dragX, setDragX] = useState(0); // live swipe feedback at scale 1
  const [animating, setAnimating] = useState(true);
  const gesture = useRef<{ id: number; start: Point; startOffset: Point; moved: boolean } | null>(null);
  const lastTap = useRef<{ t: number; p: Point } | null>(null);

  // Reset zoom whenever the image changes.
  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setDragX(0);
  }, [src]);

  const clamp = useCallback((o: Point, s: number): Point => {
    const box = boxRef.current;
    if (!box || s === 1) return { x: 0, y: 0 };
    const { width: w, height: h } = box.getBoundingClientRect();
    return {
      x: Math.min(0, Math.max(w * (1 - s), o.x)),
      y: Math.min(0, Math.max(h * (1 - s), o.y)),
    };
  }, []);

  const localPoint = (clientX: number, clientY: number): Point => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };

  /** Zoom in keeping the tapped point under the finger, or zoom out. */
  const toggleZoom = useCallback((p: Point) => {
    setAnimating(true);
    if (scale > 1) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    } else {
      setScale(ZOOM);
      setOffset(clamp({ x: p.x - p.x * ZOOM, y: p.y - p.y * ZOOM }, ZOOM));
    }
  }, [scale, clamp]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    gesture.current = { id: e.pointerId, start: { x: e.clientX, y: e.clientY }, startOffset: offset, moved: false };
    setAnimating(false);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.start.x;
    const dy = e.clientY - g.start.y;
    if (!g.moved && Math.hypot(dx, dy) > 6) {
      g.moved = true;
      // Capture only once it's a real drag, so taps/clicks behave normally.
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    if (!g.moved) return;
    if (scale > 1) {
      setOffset(clamp({ x: g.startOffset.x + dx, y: g.startOffset.y + dy }, scale));
    } else if ((onNext || onPrev) && Math.abs(dx) > Math.abs(dy)) {
      setDragX(dx);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    setAnimating(true);
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.start.x;
    const dy = e.clientY - g.start.y;

    if (g.moved) {
      if (scale === 1 && Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
        (dx < 0 ? onNext : onPrev)?.();
      }
      setDragX(0);
      return;
    }

    // Double-tap on touch/pen (mouse uses onDoubleClick).
    if (e.pointerType !== "mouse") {
      const p = localPoint(e.clientX, e.clientY);
      const now = Date.now();
      const prev = lastTap.current;
      if (prev && now - prev.t < DOUBLE_TAP_MS && Math.hypot(p.x - prev.p.x, p.y - prev.p.y) < 30) {
        lastTap.current = null;
        toggleZoom(p);
      } else {
        lastTap.current = { t: now, p };
      }
    }
  };

  return (
    <div
      ref={boxRef}
      className={cn(
        "relative h-full w-full select-none overflow-hidden",
        scale > 1 ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-zoom-in touch-pan-y",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { gesture.current = null; setDragX(0); setAnimating(true); }}
      onDoubleClick={(e) => toggleZoom(localPoint(e.clientX, e.clientY))}
      role="img"
      aria-label={`${alt}. Double-tap to zoom${onNext ? ", swipe for more images" : ""}.`}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={cn("h-full w-full origin-top-left object-cover object-center", animating && "transition-transform duration-300 ease-out")}
        style={{ transform: `translate(${offset.x + dragX}px, ${offset.y}px) scale(${scale})` }}
        onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }}
      />
    </div>
  );
};

export default ProductImageViewer;

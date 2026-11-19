import React, { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Keyboard, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface ScanOutcome {
  ok: boolean;
  message: string;
}

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

const DEFAULT_FORMATS = ["code_128", "qr_code", "code_39", "ean_13"];

function getDetector(formats: string[]): BarcodeDetectorLike | null {
  const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats });
  } catch {
    return null;
  }
}

/** True when the device can scan with the camera (Android Chrome / WebView, desktop Chrome). */
export const cameraScanSupported = () =>
  typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;

/**
 * Camera barcode scanner (native BarcodeDetector, no extra libraries), with a
 * typed fallback for devices without it (e.g. iOS Safari). In continuous mode
 * it keeps scanning and shows the outcome of each code.
 */
const BarcodeScanner: React.FC<{
  open: boolean;
  onClose: () => void;
  onDetect: (code: string) => Promise<ScanOutcome | void> | ScanOutcome | void;
  title?: string;
  description?: string;
  continuous?: boolean;
  /** Barcode formats to look for (defaults suit parcel labels). */
  formats?: string[];
  /** Hint in the typed-code box. */
  placeholder?: string;
  /** Upper-case typed codes (parcel labels are); off for product codes. */
  uppercase?: boolean;
}> = ({ open, onClose, onDetect, title = "Scan barcode", description, continuous = false,
  formats = DEFAULT_FORMATS, placeholder = "or type LX…-1", uppercase = true }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [last, setLast] = useState<ScanOutcome | null>(null);
  const busy = useRef(false);
  const recent = useRef<Map<string, number>>(new Map());
  const supported = cameraScanSupported();

  const handle = async (code: string) => {
    const value = code.trim();
    if (!value || busy.current) return;
    const seen = recent.current.get(value);
    if (seen && Date.now() - seen < 2500) return; // ignore the same label held in view
    recent.current.set(value, Date.now());
    busy.current = true;
    try {
      const outcome = await onDetect(value);
      if (outcome) setLast(outcome);
      try {
        navigator.vibrate?.(outcome && !outcome.ok ? [80, 60, 80] : 60);
      } catch {
        /* unsupported */
      }
      if (!continuous && (!outcome || outcome.ok)) onClose();
    } finally {
      busy.current = false;
    }
  };

  useEffect(() => {
    if (!open || !supported) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const detector = getDetector(formats);
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        let lastRun = 0;
        const loop = async (t: number) => {
          if (stopped) return;
          if (detector && videoRef.current && t - lastRun > 250 && videoRef.current.readyState >= 2) {
            lastRun = t;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes[0]?.rawValue) await handle(codes[0].rawValue);
            } catch {
              /* transient decode error */
            }
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch (e) {
        setError(e instanceof Error && e.name === "NotAllowedError" ? "Camera permission was denied. Type the code instead." : "Camera unavailable. Type the code instead.");
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supported]);

  useEffect(() => {
    if (!open) {
      setLast(null);
      setManual("");
      setError(null);
      recent.current.clear();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" /> {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {supported && !error ? (
          <div className="relative overflow-hidden rounded-lg bg-black aspect-[4/3]">
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-md border-2 border-white/80" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Keyboard className="h-4 w-4" /> {error ?? "Camera scanning isn't supported on this device. Type the code from the label."}
          </p>
        )}

        {last && (
          <p className={`flex items-center gap-2 text-sm ${last.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>
            {last.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />} {last.message}
          </p>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handle(manual);
            setManual("");
          }}
        >
          <Input value={manual} onChange={(e) => setManual(uppercase ? e.target.value.toUpperCase() : e.target.value)} placeholder={placeholder} className="font-mono" autoComplete="off" />
          <Button type="submit" variant="outline" disabled={!manual.trim()}>
            Enter
          </Button>
        </form>
        {continuous && (
          <Button onClick={onClose} className="w-full">
            Done
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScanner;

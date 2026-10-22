import React, { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parsePayCode } from "@/services/merchantAi";
import { QrDetector as Detector } from "@/lib/qrScan";

/**
 * Scans a store's 1145 Pay QR code with the camera and hands back the pay
 * code. Only 1145 Pay links are accepted; anything else is ignored.
 */
const PayQrScanner: React.FC<{ onCode: (code: string) => void; onClose: () => void }> = ({ onCode, onClose }) => {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [wrongCode, setWrongCode] = useState(false);

  useEffect(() => {
    if (!Detector) return;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let done = false;
    const detector = new Detector({ formats: ["qr_code"] });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        setStarting(false);
        const scan = async () => {
          if (done || !video.current) return;
          try {
            const codes = await detector.detect(video.current);
            for (const c of codes) {
              const code = parsePayCode(c.rawValue);
              if (code) {
                done = true;
                navigator.vibrate?.(60);
                onCode(code);
                return;
              }
              setWrongCode(true);
            }
          } catch {
            // a frame that could not be read; try the next one
          }
          timer = window.setTimeout(scan, 250);
        };
        void scan();
      } catch {
        setError("We couldn't open the camera. Allow camera access, or paste the payment link below.");
        setStarting(false);
      }
    })();

    return () => {
      done = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video ref={video} className="aspect-square w-full object-cover" playsInline muted aria-label="Camera view for scanning a 1145 Pay QR code" />
      {/* Viewfinder */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-3/5 w-3/5 rounded-2xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
      </div>
      {starting && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>}
      <p className="absolute inset-x-0 bottom-3 text-center text-sm font-medium text-white drop-shadow">
        {error ?? (wrongCode ? "That isn't a 1145 Pay code. Point at the store's 1145 Pay QR." : "Point at the store's 1145 Pay QR code")}
      </p>
      <Button size="icon" variant="secondary" className="absolute right-3 top-3 rounded-full" onClick={onClose} aria-label="Close camera">
        <X className="h-4 w-4" />
      </Button>
      {error && <Camera className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-white/60" aria-hidden />}
    </div>
  );
};

export default PayQrScanner;

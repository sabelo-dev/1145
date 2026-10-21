import { getPlatformBaseUrl } from "@/lib/appUrl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SEO from "@/components/SEO";

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
export default function ScanPayPage() {
  const navigate = useNavigate();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const stop = () => { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; };
  useEffect(() => () => stop(), []);
  const open = useCallback((value: string) => {
    try {
      const url = new URL(value, window.location.origin);
      if (url.origin !== window.location.origin && url.origin !== new URL(getPlatformBaseUrl()).origin && url.origin !== "https://1145.io" && url.origin !== "https://www.1145.io") throw new Error();
      if (!/^\/pay\/[0-9a-f]{36}$/.test(url.pathname)) throw new Error();
      stop(); setScanning(false); navigate(url.pathname);
      return true;
    } catch { setError("Use a valid 1145 Pay link from your merchant."); return false; }
  }, [navigate]);
  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const scan = async () => {
      try {
        const Constructor = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => Detector }).BarcodeDetector;
        if (!Constructor) throw new Error("Use your phone camera app to scan the merchant QR code, or paste the payment link below.");
        const detector = new Constructor({ formats: ["qr_code"] });
        const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (cancelled) { camera.getTracks().forEach(t => t.stop()); return; }
        stream.current = camera;
        if (!video.current) { stop(); return; }
        video.current.srcObject = camera;
        await video.current.play();
        const tick = async () => {
          if (cancelled) return;
          try {
            const results = video.current ? await detector.detect(video.current) : [];
            if (!cancelled && results.some(r => open(r.rawValue))) return;
          } catch { /* Retry while the camera is focusing. */ }
          if (!cancelled) timer = setTimeout(tick, 300);
        };
        await tick();
      } catch (e) {
        if (!cancelled) { setError(e instanceof Error ? e.message : "Camera unavailable. Paste the payment link below."); setScanning(false); }
        stop();
      }
    };
    void scan();
    return () => { cancelled = true; clearTimeout(timer); stop(); };
  }, [scanning, open]);
  return <div className="mx-auto max-w-md space-y-5 p-5">
    <SEO title="1145 Pay | Scan and pay" />
    <h1 className="text-2xl font-bold">1145 Pay</h1>
    <p>Scan the merchant's QR code with your smartphone. Check the merchant and amount, then confirm with UCoin, a saved card, or PayFast.</p>
    {scanning && <video ref={video} playsInline muted className="w-full rounded-xl" aria-label="QR code camera" />}
    <Button className="w-full" onClick={() => { setError(""); setScanning(s => !s); }}>{scanning ? "Stop camera" : "Scan merchant QR code"}</Button>
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); open(link.trim()); }}>
      <label htmlFor="pay-link">Or paste the merchant's payment link</label>
      <Input id="pay-link" value={link} onChange={e => setLink(e.target.value)} placeholder="1145 Pay link" required />
      <Button type="submit" variant="outline" className="w-full">Review payment</Button>
    </form>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <p className="text-xs text-muted-foreground">You can also scan with your phone's camera app to open the payment link.</p>
  </div>;
}

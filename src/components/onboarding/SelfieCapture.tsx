import React, { useEffect, useRef, useState } from "react";
import { Camera, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface Props {
  bucket: string;
  folder: string;
  onCaptured: (data: { path: string; hash: string }) => void;
  captured?: { path: string; hash: string };
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SelfieCapture: React.FC<Props> = ({ bucket, folder, onCaptured, captured }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Camera unavailable", description: e.message });
    }
  };

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  };

  useEffect(() => {
    if (!captured) start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setBusy(true);
    try {
      const v = videoRef.current;
      const c = canvasRef.current;
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d")!.drawImage(v, 0, 0);
      const blob: Blob = await new Promise((res) =>
        c.toBlob((b) => res(b as Blob), "image/jpeg", 0.85)
      );
      const buf = await blob.arrayBuffer();
      const hash = await sha256(buf);
      const path = `${folder}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from(bucket).upload(path, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (error) throw error;
      stop();
      onCaptured({ path, hash });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Capture failed", description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const retake = () => {
    onCaptured({ path: "", hash: "" });
    start();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <ShieldCheck className="h-4 w-4" />
          Face the camera in good light. No hats or sunglasses. This selfie is compared against your ID.
        </div>
        <div className="relative aspect-video overflow-hidden rounded-md bg-black">
          {captured?.path ? (
            <div className="flex h-full items-center justify-center text-white text-sm">
              ✓ Selfie captured &amp; encrypted
            </div>
          ) : (
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </div>
      <div className="flex gap-2">
        {captured?.path ? (
          <Button type="button" variant="outline" onClick={retake}>
            <RefreshCw className="h-4 w-4 mr-2" /> Retake selfie
          </Button>
        ) : (
          <Button type="button" onClick={capture} disabled={!ready || busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
            Capture selfie
          </Button>
        )}
      </div>
    </div>
  );
};

export default SelfieCapture;

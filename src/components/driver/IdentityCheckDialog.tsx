import React, { useEffect, useRef, useState } from "react";
import { Camera, Loader2, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { driverVerification, type IdentityCheck, type RpcResult } from "@/services/driverVerificationService";

interface IdentityCheckDialogProps {
  check: IdentityCheck | null;
  userId: string;
  /** Called once the selfie has been handed in, or the request has closed. */
  onSubmitted: (result: RpcResult) => void;
  /** Leaving without a selfie: cancels going online, or goes offline mid-shift. */
  onDecline: () => void;
}

const minutesLeft = (dueAt: string) => Math.max(0, Math.ceil((new Date(dueAt).getTime() - Date.now()) / 60_000));

/**
 * Takes a live selfie for an identity check. The photo comes straight from the
 * camera (no file picker) and the driver holds the pose the server asked for,
 * so a reviewer can tell it was taken for this request.
 */
const IdentityCheckDialog: React.FC<IdentityCheckDialogProps> = ({ check, userId, onSubmitted, onDecline }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    if (!check) return;
    let cancelled = false;
    setReady(false);
    setCameraError(null);
    setMinutes(minutesLeft(check.due_at));

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: 640, height: 480 }, audio: false })
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      })
      .catch(() => setCameraError("We could not open your camera. Allow camera access for 1145 and try again."));

    const timer = window.setInterval(() => setMinutes(minutesLeft(check.due_at)), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [check]);

  const capture = async () => {
    const video = videoRef.current;
    if (!check || !video) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      const selfie = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
      if (!selfie) throw new Error("capture failed");

      const result = await driverVerification.submitIdentityCheck(userId, check, selfie);
      // A request that has closed cannot be retried, so the dialog ends either way.
      if (result.ok || result.code === "check_expired" || result.code === "check_closed") {
        onSubmitted(result);
      } else {
        toast({ variant: "destructive", title: "Selfie not sent", description: result.message });
      }
    } catch {
      toast({ variant: "destructive", title: "Selfie not taken", description: "Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const midShift = check?.trigger === "random";

  return (
    <Dialog open={!!check} onOpenChange={(open) => { if (!open && !midShift && !busy) onDecline(); }}>
      <DialogContent
        className="max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => { if (midShift) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            {midShift ? "Quick identity check" : "Confirm it's you"}
          </DialogTitle>
          <DialogDescription>
            {midShift
              ? `Pull over somewhere safe first. You have about ${minutes} ${minutes === 1 ? "minute" : "minutes"} to take a selfie, or you will be taken offline.`
              : "Take a selfie before you go online. It is compared with the photo from your registration."}
          </DialogDescription>
        </DialogHeader>

        {check && (
          <div className="space-y-3">
            <p className="rounded-lg bg-muted p-3 text-sm">
              <span className="font-semibold">In the photo: </span>
              {check.challenge}. No hat, sunglasses or mask.
            </p>
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-black">
              {cameraError ? (
                <p role="alert" className="flex h-full items-center justify-center p-6 text-center text-sm text-white">
                  {cameraError}
                </p>
              ) : (
                <video ref={videoRef} className="h-full w-full -scale-x-100 object-cover" muted playsInline />
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onDecline} disabled={busy}>
            {midShift ? "Go offline instead" : "Cancel"}
          </Button>
          <Button type="button" onClick={capture} disabled={!ready || busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
            Take selfie
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default IdentityCheckDialog;

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  driverVerification,
  offlineReason,
  type IdentityCheck,
  type RpcResult,
} from "@/services/driverVerificationService";

const HEARTBEAT_MS = 60_000;

/**
 * The driver's online session: going online behind a selfie check, the
 * once-a-minute heartbeat that carries random selfie requests, and going
 * offline. `onChange` is called whenever the driver's status may have changed.
 */
export function useDriverSession(driverStatus: string | undefined, onChange: () => void) {
  const { toast } = useToast();
  const [check, setCheck] = useState<IdentityCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Set once the driver has been told this device is not the one online.
  const toldOffline = useRef(false);

  const online = driverStatus === "available" || driverStatus === "busy";

  const goOnline = useCallback(async () => {
    setBusy(true);
    try {
      let result = await driverVerification.goOnline();
      if (result.code === "identity_check_required") {
        const requested = await driverVerification.requestIdentityCheck();
        if (requested.ok && requested.check) {
          setCheck(requested.check);
          return;
        }
        result = requested;
      }
      if (result.ok) toast({ title: "You're online" });
      else toast({ variant: "destructive", title: "Can't go online", description: result.message });
      onChangeRef.current();
    } finally {
      setBusy(false);
    }
  }, [toast]);

  const goOffline = useCallback(async () => {
    setBusy(true);
    try {
      setCheck(null);
      const result = await driverVerification.goOffline();
      if (!result.ok) toast({ variant: "destructive", title: "Could not go offline", description: result.message });
      onChangeRef.current();
    } finally {
      setBusy(false);
    }
  }, [toast]);

  const onCheckSubmitted = useCallback(
    async (result: RpcResult) => {
      const wasGoingOnline = check?.trigger === "go_online";
      setCheck(null);
      if (!result.ok) {
        toast({ variant: "destructive", title: "Selfie request closed", description: result.message });
        onChangeRef.current();
      } else if (wasGoingOnline) {
        await goOnline();
      } else {
        toast({ title: "Thanks, you're verified", description: "You can carry on driving." });
      }
    },
    [check, goOnline, toast],
  );

  const onCheckDeclined = useCallback(() => {
    if (check?.trigger === "random") void goOffline();
    else setCheck(null);
  }, [check, goOffline]);

  useEffect(() => {
    if (!online) return;
    let stopped = false;
    toldOffline.current = false;

    const beat = async () => {
      if (document.visibilityState !== "visible") return;
      const result = await driverVerification.heartbeat();
      if (stopped || !result) return;
      if (!result.online) {
        setCheck(null);
        if (!toldOffline.current) {
          toldOffline.current = true;
          const elsewhere = result.status === "available" || result.status === "busy";
          toast({
            variant: "destructive",
            title: elsewhere ? "Online on another device" : "You are offline",
            description: elsewhere ? "Go offline there before driving from this device." : offlineReason(result.reason),
          });
        }
        onChangeRef.current();
      } else if (result.check) {
        setCheck((current) => (current?.id === result.check!.id ? current : result.check!));
      }
    };

    void beat();
    const timer = window.setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [online, toast]);

  return { check, busy, goOnline, goOffline, onCheckSubmitted, onCheckDeclined };
}

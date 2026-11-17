import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/logistics/lib/db";
import { ALERT_CONFIG, OfferAlertController, type Offer, type OfferApi, type OfferKind } from "./controller";
import { getAlertVolume, offerTone, setAlertVolume } from "./tonePlayer";
import OfferAlert from "./OfferAlert";

const isNetworkError = (m?: string) => /failed to fetch|networkerror|network request failed|load failed/i.test(m ?? "");

/**
 * Connects the offer alert to the backend: realtime + polling transport,
 * server-timed offers, accept/missed RPCs, analytics, lifecycle (background,
 * offline, unmount) and the "Still there?" auto-offline rule.
 */
const OfferAlertHost: React.FC<{
  driverId: string | undefined;
  online: boolean;
  onAccepted: (kind: OfferKind) => void;
  onStatusChanged: () => void;
}> = ({ driverId, online, onAccepted, onStatusChanged }) => {
  const { toast } = useToast();
  const [stillThere, setStillThere] = useState(false);
  const [toneBlocked, setToneBlocked] = useState(false);
  const [volume, setVolume] = useState(getAlertVolume());
  const onAcceptedRef = useRef(onAccepted);
  onAcceptedRef.current = onAccepted;

  const api: OfferApi = useMemo(
    () => ({
      async accept(offer: Offer) {
        // Same offer id = idempotent server-side; retry only on transport errors.
        for (let attempt = 0; attempt < 3; attempt++) {
          const { data, error } = await db.rpc("driver_accept_offer", { p_kind: offer.kind, p_id: offer.id });
          if (error && isNetworkError(error.message) && attempt < 2) {
            await new Promise((r) => setTimeout(r, 400));
            continue;
          }
          const res = data as { ok?: boolean; error?: string } | null;
          if (error || !res?.ok) throw new Error(res?.error ?? error?.message ?? "accept_failed");
          return;
        }
      },
      reportMissed(offer: Offer) {
        db.rpc("driver_offer_missed", { p_kind: offer.kind, p_id: offer.id }).then(({ data }) => {
          if ((data as { went_offline?: boolean } | null)?.went_offline) {
            setStillThere(true);
            onStatusChanged();
          }
        });
      },
      log(offer: Offer, event: string, payload?: Record<string, unknown>) {
        db.rpc("driver_log_offer_event", { p_kind: offer.kind, p_id: offer.id, p_event: event, p_payload: payload ?? {} }).then(() => undefined);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const controller = useMemo(() => new OfferAlertController(offerTone, api, ALERT_CONFIG), [api]);

  // Accepted → hand over to the job screen.
  useEffect(
    () =>
      controller.subscribe((s) => {
        if (s.phase === "ACCEPTED" && s.offer) onAcceptedRef.current(s.offer.kind);
        if (s.phase === "IDLE" && s.message === "Offer withdrawn") toast({ title: "Offer withdrawn", description: "The customer cancelled or it went to another driver." });
      }),
    [controller, toast],
  );

  useEffect(() => {
    offerTone.onBlocked = () => {
      setToneBlocked(true);
      const o = controller.current.offer;
      if (o) api.log?.(o, "tone_blocked");
    };
    return () => {
      offerTone.onBlocked = null;
    };
  }, [controller, api]);

  // Transport: fetch live offers (server-timed) and reconcile with the controller.
  const fetchOffers = useCallback(async () => {
    if (!driverId || !online) return;
    const t0 = performance.now();
    const { data, error } = await db.rpc("driver_live_offers");
    if (error) return;
    const transitMs = (performance.now() - t0) / 2;
    const offers = ((data ?? []) as Offer[]).map((o) => ({ ...o, transitMs }));
    const cur = controller.current;
    if (cur.phase === "RINGING" && cur.offer && !offers.some((o) => o.id === cur.offer!.id)) {
      // Gone from the server while still ringing → withdrawn (ignore the final second: that's just expiry).
      if (cur.ringEndsAt != null && cur.ringEndsAt - performance.now() > 1500) controller.onOfferCancelled(cur.offer.id);
    }
    offers.forEach((o) => controller.onOffer(o));
  }, [driverId, online, controller]);

  useEffect(() => {
    if (!driverId || !online) return;
    fetchOffers();
    let tick = 0;
    const channel = supabase
      .channel(`offer-alert-${driverId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_jobs", filter: `offered_driver_id=eq.${driverId}` }, () => fetchOffers())
      .on("postgres_changes", { event: "*", schema: "public", table: "dispatch_assignments", filter: `driver_id=eq.${driverId}` }, () => fetchOffers())
      .subscribe();
    // Fast poll while ringing (to catch withdrawals), slow otherwise (realtime backup).
    const id = window.setInterval(() => {
      tick = (tick + 1) % 4;
      if (controller.current.phase === "RINGING" || tick === 0) fetchOffers(); // 4 s ringing, 16 s idle
    }, 4000);
    return () => {
      window.clearInterval(id);
      supabase.removeChannel(channel);
    };
  }, [driverId, online, fetchOffers, controller]);

  // Lifecycle: going offline or leaving the screen ends any ring.
  useEffect(() => {
    if (!online) controller.shutdown();
  }, [online, controller]);
  useEffect(() => () => controller.shutdown(), [controller]);
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        controller.resync();
        fetchOffers();
      }
    };
    const onHide = () => offerTone.stop(); // never keep sounding from a hidden page
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
    };
  }, [controller, fetchOffers]);

  // Audio must be unlocked by a gesture; any tap on the dashboard counts.
  useEffect(() => {
    const unlock = () => offerTone.unlock().then(() => setToneBlocked(!offerTone.unlocked));
    document.addEventListener("pointerdown", unlock, { once: true });
    return () => document.removeEventListener("pointerdown", unlock);
  }, []);

  const goOnline = async () => {
    await offerTone.unlock();
    if (driverId) await supabase.from("drivers").update({ status: "available" }).eq("id", driverId);
    setStillThere(false);
    onStatusChanged();
  };

  const soundOff = volume === 0 || toneBlocked;

  return (
    <>
      <OfferAlert controller={controller} />

      {online && (
        <div
          className={`mb-4 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
            soundOff ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" : "bg-muted/40"
          }`}
          role={soundOff ? "alert" : undefined}
        >
          {soundOff ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4 text-emerald-600" />}
          <span className="flex-1 min-w-40">
            {volume === 0
              ? "Alert sound is off. You could miss offers."
              : toneBlocked
                ? "Tap Enable so offers can ring."
                : "Offer alerts on: new jobs ring full-screen for a few seconds."}
          </span>
          <label className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" aria-hidden />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                setVolume(v);
                setAlertVolume(v);
              }}
              aria-label="Alert volume"
              className="w-24"
            />
          </label>
          {toneBlocked && (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await offerTone.unlock();
                setToneBlocked(!offerTone.unlocked);
              }}
            >
              Enable
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              const ok = await offerTone.preview();
              setToneBlocked(!ok);
            }}
          >
            Test
          </Button>
        </div>
      )}

      <AlertDialog open={stillThere} onOpenChange={setStillThere}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Still there?</AlertDialogTitle>
            <AlertDialogDescription>
              You missed several offers in a row, so we've set you offline to give them to other drivers. Go back online when you're ready.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay offline</AlertDialogCancel>
            <AlertDialogAction onClick={goOnline}>Go online</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default OfferAlertHost;

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Camera,
  CheckCircle2,
  Circle,
  CloudOff,
  Coins,
  MapPin,
  Navigation,
  Package,
  Phone,
  Play,
  Route as RouteIcon,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatAddress, openDirections } from "@/lib/navigation";
import { db, type DeliveryRoute, type RouteStop } from "@/logistics/lib/db";
import { enqueue, flushQueue, isNetworkError, readQueue } from "./routeOfflineQueue";
import BarcodeScanner from "@/components/scanning/BarcodeScanner";
import { ScanLine } from "lucide-react";

export const FAILURE_REASONS = [
  "Recipient not available",
  "Wrong or incomplete address",
  "Recipient refused parcel",
  "Access denied (gate / security)",
  "Business closed",
  "Unsafe to deliver",
  "Parcel damaged",
];

const RPC_ERRORS: Record<string, string> = {
  invalid_otp: "That code doesn't match. Ask the recipient to check their SMS.",
  otp_locked: "Too many wrong codes. This parcel is locked, so call dispatch to reset the code.",
  route_not_started: "Start the route first.",
  stop_already_closed: "This stop is already closed.",
  failure_reason_required: "Choose a reason.",
  route_not_dispatched: "This route hasn't been dispatched yet.",
};

function rpcMessage(err: { message?: string } | null): string {
  const m = err?.message ?? "Something went wrong";
  const key = Object.keys(RPC_ERRORS).find((k) => m.includes(k));
  return key ? RPC_ERRORS[key] : m;
}

async function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  if (!("geolocation" in navigator)) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 30_000 },
    );
  });
}

interface Props {
  driver: { id: string; name: string } | null;
  onStatusUpdate?: () => void;
}

const DriverRouteRun: React.FC<Props> = ({ driver, onStatusUpdate }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [queued, setQueued] = useState(() => readQueue());

  // Cash collected at the door that still has to be handed in.
  const { data: cashHeld = 0 } = useQuery({
    queryKey: ["driver-cod", driver?.id],
    enabled: !!driver,
    queryFn: async () => {
      const { data } = await db.from("cod_collections").select("amount").eq("driver_id", driver!.id).is("remitted_at", null);
      return (data ?? []).reduce((a: number, r: { amount: number }) => a + Number(r.amount), 0);
    },
    refetchInterval: 120_000,
  });
  const [busy, setBusy] = useState(false);
  const [completeStop, setCompleteStop] = useState<RouteStop | null>(null);
  const [failStop, setFailStop] = useState<RouteStop | null>(null);
  const [scanStop, setScanStop] = useState<RouteStop | null>(null);

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ["driver-routes", driver?.id],
    enabled: !!driver,
    queryFn: async () => {
      const { data, error } = await db
        .from("delivery_routes")
        .select("*")
        .eq("driver_id", driver!.id)
        .in("status", ["dispatched", "in_progress"])
        .order("route_date")
        .order("planned_start", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as DeliveryRoute[];
    },
  });

  const route = useMemo(
    () => routes.find((r) => r.id === selectedRouteId) ?? routes.find((r) => r.status === "in_progress") ?? routes[0] ?? null,
    [routes, selectedRouteId],
  );

  const { data: stops = [] } = useQuery({
    queryKey: ["driver-route-stops", route?.id],
    enabled: !!route,
    queryFn: async () => {
      const { data, error } = await db.from("route_stops").select("*").eq("route_id", route!.id).order("sequence");
      if (error) throw error;
      return (data ?? []) as RouteStop[];
    },
  });

  // Box-scan progress per stop (multi-parcel shipments).
  const { data: pieceProgress = {} } = useQuery({
    queryKey: ["driver-pieces", route?.id],
    enabled: !!route && route.status === "in_progress",
    queryFn: async () => {
      const { data } = await db.rpc("driver_route_piece_progress", { p_route_id: route!.id });
      const out: Record<string, { scanned: number; total: number }> = {};
      ((data ?? []) as Array<{ stop_id: string; scanned: number; total: number }>).forEach((r) => (out[r.stop_id] = { scanned: r.scanned, total: r.total }));
      return out;
    },
  });

  // Live updates when dispatch re-optimises or assigns a new route.
  useEffect(() => {
    if (!driver) return;
    const channel = db
      .channel(`driver-routes-${driver.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_routes", filter: `driver_id=eq.${driver.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["driver-routes", driver.id] });
        qc.invalidateQueries({ queryKey: ["driver-route-stops"] });
      })
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }, [driver, qc]);

  // Replay offline actions when the connection returns (and periodically).
  useEffect(() => {
    const onOnline = () => syncQueue();
    window.addEventListener("online", onOnline);
    const id = window.setInterval(() => navigator.onLine && syncQueue(), 30_000);
    if (navigator.onLine) syncQueue();
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Location heartbeat while on the road: keeps the ops map, ETAs and
  // nearest-driver dispatch current. Throttled to one write per 30 s.
  const onRoad = route?.status === "in_progress";
  useEffect(() => {
    if (!driver || !onRoad || !("geolocation" in navigator)) return;
    let last = 0;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const now = Date.now();
        if (now - last < 30_000) return;
        last = now;
        supabase
          .from("drivers")
          .update({
            current_location: {
              lat: p.coords.latitude,
              lng: p.coords.longitude,
              accuracy: p.coords.accuracy ?? null,
              heading: p.coords.heading ?? null,
              speed: p.coords.speed ?? null,
              timestamp: new Date(now).toISOString(),
            },
          })
          .eq("id", driver.id)
          .then(() => undefined);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [driver, onRoad]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["driver-routes", driver?.id] });
    qc.invalidateQueries({ queryKey: ["driver-route-stops", route?.id] });
    onStatusUpdate?.();
  };

  const startRoute = async () => {
    if (!route) return;
    setBusy(true);
    const { error } = await db.rpc("driver_start_route", { p_route_id: route.id });
    setBusy(false);
    if (error) {
      toast({ variant: "destructive", title: "Couldn't start route", description: rpcMessage(error) });
      return;
    }
    toast({ title: "Route started", description: "Drive safe. Your first stop is at the top." });
    refresh();
  };

  const queueForLater = (stop: RouteStop, action: "arrive" | "complete" | "fail" | "skip", params: Record<string, unknown>) => {
    enqueue({ stopId: stop.id, routeId: stop.route_id, sequence: stop.sequence, action, params });
    setQueued(readQueue());
    toast({ title: "Saved offline", description: "No signal. This will sync automatically when you're back online." });
    return true;
  };

  const updateStop = async (stop: RouteStop, action: "arrive" | "complete" | "fail" | "skip", extra: Record<string, unknown> = {}) => {
    setBusy(true);
    const pos = await currentPosition();
    const params = {
      p_stop_id: stop.id,
      p_action: action,
      p_lat: pos?.lat ?? null,
      p_lng: pos?.lng ?? null,
      p_occurred_at: new Date().toISOString(),
      ...extra,
    };
    // Keep order: if anything is already queued, queue behind it.
    if (!navigator.onLine || readQueue().length > 0) {
      setBusy(false);
      const ok = queueForLater(stop, action, params);
      if (navigator.onLine) syncQueue();
      return ok;
    }
    const { data, error } = await db.rpc("driver_update_stop", params);
    setBusy(false);
    if (error && isNetworkError(error)) return queueForLater(stop, action, params);
    const res = data as { ok?: boolean; error?: string; attempts_left?: number } | null;
    if (error || !res?.ok) {
      const left = res?.attempts_left != null && res.error === "invalid_otp" ? ` ${res.attempts_left} tries left.` : "";
      toast({ variant: "destructive", title: "Update failed", description: rpcMessage(error ?? { message: res?.error }) + left });
      return false;
    }
    refresh();
    return true;
  };

  const syncQueue = async () => {
    if (!readQueue().length) return;
    const res = await flushQueue();
    setQueued(readQueue());
    if (res.synced) toast({ title: "Synced", description: `${res.synced} offline update${res.synced === 1 ? "" : "s"} sent.` });
    res.rejected.forEach(({ item, reason }) =>
      toast({ variant: "destructive", title: `Stop ${item.sequence} needs attention`, description: `${rpcMessage({ message: reason })} Please redo it.` }),
    );
    if (res.synced || res.rejected.length) {
      // Broad invalidation: this runs from long-lived listeners.
      qc.invalidateQueries({ queryKey: ["driver-routes"] });
      qc.invalidateQueries({ queryKey: ["driver-route-stops"] });
      onStatusUpdate?.();
    }
  };

  // Auto-arrive: within ~100 m of the next stop, mark it arrived (one tap saved
  // per stop, and accurate arrival times for customers and reports).
  const autoArrived = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!onRoad || !("geolocation" in navigator)) return;
    const queuedIds = new Set(queued.map((q) => q.stopId));
    const next = stops.find((s) => (s.status === "pending" || s.status === "arrived") && !queuedIds.has(s.id));
    if (!next || next.status !== "pending" || next.lat == null || next.lng == null || autoArrived.current.has(next.id)) return;
    const target = { lat: Number(next.lat), lng: Number(next.lng) };
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const dLat = ((target.lat - p.coords.latitude) * Math.PI) / 180;
        const dLng = ((target.lng - p.coords.longitude) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((p.coords.latitude * Math.PI) / 180) * Math.cos((target.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        const meters = 2 * 6371000 * Math.asin(Math.sqrt(a));
        if (meters <= 100 && (p.coords.accuracy ?? 0) <= 80 && !autoArrived.current.has(next.id)) {
          autoArrived.current.add(next.id);
          updateStop(next, "arrive").then((ok) => ok && toast({ title: `Arrived at stop ${next.sequence}`, description: next.contact_name ?? undefined }));
        }
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRoad, stops, queued]);

  if (!driver) return null;

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading your routes…</div>;
  }

  if (!route) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <RouteIcon className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="mt-3 font-medium">No route assigned</p>
          <p className="text-sm text-muted-foreground mt-1">When dispatch sends you a multi-stop route it shows up here automatically.</p>
        </CardContent>
      </Card>
    );
  }

  // Show queued (offline) actions as if they had already happened.
  const overlay = new Map<string, RouteStop["status"]>();
  queued.forEach((q) =>
    overlay.set(q.stopId, q.action === "arrive" ? "arrived" : q.action === "complete" ? "completed" : q.action === "fail" ? "failed" : "skipped"),
  );
  const stopsView = stops.map((s) => (overlay.has(s.id) ? { ...s, status: overlay.get(s.id)! } : s));
  const open = stopsView.filter((s) => s.status === "pending" || s.status === "arrived");
  const closed = stops.length - open.length;
  const current = route.status === "in_progress" ? open[0] : undefined;
  const pct = stops.length ? Math.round((closed / stops.length) * 100) : 0;
  const codDue = open.filter((s) => s.stop_type === "delivery").reduce((sum, s) => sum + Number(s.cod_amount ?? 0), 0);

  return (
    <div className="space-y-4">
      {queued.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <CloudOff className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            {queued.length} update{queued.length === 1 ? "" : "s"} waiting for signal. Keep working; they'll sync automatically.
          </span>
          {navigator.onLine && (
            <Button size="sm" variant="outline" onClick={syncQueue}>
              Sync now
            </Button>
          )}
        </div>
      )}
      {routes.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {routes.map((r) => (
            <Button key={r.id} size="sm" variant={r.id === route.id ? "default" : "outline"} onClick={() => setSelectedRouteId(r.id)}>
              {r.name}
            </Button>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">{route.name}</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(route.route_date), "EEE d MMM")}
                {route.planned_start ? ` · start ${format(new Date(route.planned_start), "HH:mm")}` : ""} · {stops.length} stops
                {route.total_distance_km ? ` · ${Number(route.total_distance_km).toFixed(1)} km` : ""}
              </p>
            </div>
            {route.status === "dispatched" ? (
              <Button onClick={startRoute} disabled={busy}>
                <Play className="h-4 w-4 mr-1.5" /> Start route
              </Button>
            ) : (
              <span className="text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-2 py-1 rounded-full">In progress</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Progress value={pct} className="h-2" />
            <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
              {closed}/{stops.length}
            </span>
          </div>
          {cashHeld > 0 && (
            <p className="text-sm flex items-center gap-1.5">
              <Coins className="h-4 w-4" /> R {cashHeld.toFixed(2)} collected, to hand in at the hub
            </p>
          )}
          {codDue > 0 && (
            <p className="text-sm flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
              <Coins className="h-4 w-4" /> R {codDue.toFixed(2)} cash to collect on remaining stops
            </p>
          )}
        </CardContent>
      </Card>

      {current && (
        <Card className="border-primary/60 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                Stop {current.sequence} · {current.stop_type === "pickup" ? "Collect" : current.stop_type === "hub" ? "Hub drop" : "Deliver"}
              </span>
              {current.eta && <span className="ml-auto text-xs text-muted-foreground">ETA {format(new Date(current.eta), "HH:mm")}</span>}
            </div>
            {current.window_start && current.window_end && (
              <div
                className={`text-xs font-medium ${
                  Date.now() < new Date(current.window_start).getTime() ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"
                }`}
              >
                Customer window {format(new Date(current.window_start), "HH:mm")}–{format(new Date(current.window_end), "HH:mm")}
                {Date.now() < new Date(current.window_start).getTime() ? " · too early, so go to the next stop first if possible" : ""}
              </div>
            )}
            <div>
              <p className="text-lg font-semibold">{current.contact_name ?? "—"}</p>
              <p className="text-sm text-muted-foreground flex gap-1.5">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5" /> {formatAddress(current.address)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                <Package className="h-3.5 w-3.5" /> {current.parcel_count} parcel{current.parcel_count > 1 ? "s" : ""}
              </span>
              {current.cod_amount ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 px-2 py-1">
                  <Coins className="h-3.5 w-3.5" /> Collect R {Number(current.cod_amount).toFixed(2)}
                </span>
              ) : null}
              {current.require_otp && current.stop_type === "delivery" && (
                <span className="rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 px-2 py-1">OTP required</span>
              )}
            </div>
            {current.notes && <p className="text-sm rounded-lg bg-muted/60 p-2">{current.notes}</p>}
            {current.shipment_id && current.stop_type !== "hub" && pieceProgress[current.id]?.total > 0 && (
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <ScanLine className="h-4 w-4" />
                <span className="text-sm flex-1">
                  Boxes scanned{" "}
                  <span
                    className={`font-semibold tabular-nums ${
                      pieceProgress[current.id].scanned >= pieceProgress[current.id].total ? "text-emerald-600" : ""
                    }`}
                  >
                    {pieceProgress[current.id].scanned}/{pieceProgress[current.id].total}
                  </span>
                </span>
                <Button size="sm" variant="outline" onClick={() => setScanStop(current)}>
                  Scan
                </Button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  openDirections({ lat: current.lat != null ? Number(current.lat) : null, lng: current.lng != null ? Number(current.lng) : null, address: formatAddress(current.address) })
                }
              >
                <Navigation className="h-4 w-4 mr-1.5" /> Navigate
              </Button>
              {current.contact_phone ? (
                <Button variant="outline" asChild>
                  <a href={`tel:${current.contact_phone}`}>
                    <Phone className="h-4 w-4 mr-1.5" /> Call
                  </a>
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  <Phone className="h-4 w-4 mr-1.5" /> No phone
                </Button>
              )}
              {current.status === "pending" ? (
                <Button className="col-span-2" disabled={busy} onClick={() => updateStop(current, "arrive")}>
                  I've arrived
                </Button>
              ) : (
                <>
                  <Button variant="outline" className="text-orange-700 border-orange-300" disabled={busy} onClick={() => setFailStop(current)}>
                    <XCircle className="h-4 w-4 mr-1.5" /> Can't {current.stop_type === "pickup" ? "collect" : "deliver"}
                  </Button>
                  <Button disabled={busy} onClick={() => setCompleteStop(current)}>
                    <CheckCircle2 className="h-4 w-4 mr-1.5" /> {current.stop_type === "pickup" ? "Collected" : "Delivered"}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <ol className="divide-y">
            {stopsView.map((s) => (
              <li key={s.id} className={`flex gap-3 px-4 py-3 ${s.id === current?.id ? "bg-primary/5" : ""}`}>
                <div className="pt-0.5">
                  {s.status === "completed" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : s.status === "failed" || s.status === "skipped" ? (
                    <XCircle className="h-5 w-5 text-orange-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {s.sequence}. {s.stop_type === "pickup" ? "Collect from" : "Deliver to"} {s.contact_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{formatAddress(s.address)}</p>
                  {s.window_start && s.window_end && (
                    <p className="text-xs text-muted-foreground">
                      Window {format(new Date(s.window_start), "HH:mm")}–{format(new Date(s.window_end), "HH:mm")}
                    </p>
                  )}
                  {s.failure_reason && <p className="text-xs text-orange-600">{s.failure_reason}</p>}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {s.completed_at ? format(new Date(s.completed_at), "HH:mm") : s.eta ? format(new Date(s.eta), "HH:mm") : ""}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <BarcodeScanner
        open={!!scanStop}
        continuous
        title={scanStop ? `Scan boxes · stop ${scanStop.sequence}` : "Scan boxes"}
        description="Hold each box label inside the frame."
        onClose={() => {
          setScanStop(null);
          qc.invalidateQueries({ queryKey: ["driver-pieces", route?.id] });
        }}
        onDetect={async (code) => {
          if (!scanStop) return;
          const { data, error } = await db.rpc("driver_scan_piece", { p_stop_id: scanStop.id, p_code: code });
          const res = data as { ok?: boolean; error?: string; piece_no?: number; scanned?: number; total?: number } | null;
          qc.invalidateQueries({ queryKey: ["driver-pieces", route?.id] });
          if (error || !res?.ok) {
            return { ok: false, message: res?.error === "wrong_parcel" ? `${code} isn't part of this stop` : rpcMessage(error ?? { message: res?.error }) };
          }
          return { ok: true, message: `Box ${res.piece_no} ✓ · ${res.scanned}/${res.total} scanned` };
        }}
      />

      <CompleteStopDialog
        stop={completeStop}
        pieces={completeStop ? pieceProgress[completeStop.id] : undefined}
        busy={busy}
        onClose={() => setCompleteStop(null)}
        onSubmit={async (proof, otp) => {
          if (!completeStop) return;
          const ok = await updateStop(completeStop, "complete", { p_proof: proof, p_otp: otp || null });
          if (ok) {
            toast({ title: completeStop.stop_type === "pickup" ? "Collected" : "Delivered", description: `Stop ${completeStop.sequence} done.` });
            setCompleteStop(null);
          }
        }}
      />

      <FailStopDialog
        stop={failStop}
        busy={busy}
        onClose={() => setFailStop(null)}
        onSubmit={async (reason) => {
          if (!failStop) return;
          const ok = await updateStop(failStop, "fail", { p_failure_reason: reason });
          if (ok) {
            toast({ title: "Attempt recorded", description: "Dispatch has been notified. Moving to the next stop." });
            setFailStop(null);
          }
        }}
      />
    </div>
  );
};

const CompleteStopDialog: React.FC<{
  stop: RouteStop | null;
  pieces?: { scanned: number; total: number };
  busy: boolean;
  onClose: () => void;
  onSubmit: (proof: Record<string, unknown>, otp: string) => Promise<void>;
}> = ({ stop, pieces, busy, onClose, onSubmit }) => {
  const { toast } = useToast();
  const [receivedBy, setReceivedBy] = useState("");
  const [missingOk, setMissingOk] = useState(false);
  const [otp, setOtp] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setReceivedBy(stop?.stop_type === "delivery" ? stop?.contact_name ?? "" : "");
    setMissingOk(false);
    setOtp("");
    setPhoto(null);
  }, [stop]);

  if (!stop) return null;
  const isDelivery = stop.stop_type === "delivery";
  const missing = !!pieces && pieces.total > 1 && pieces.scanned < pieces.total;
  const needsOtp = isDelivery && stop.require_otp;

  const submit = async () => {
    let photoPath: string | null = null;
    if (photo && !navigator.onLine) {
      toast({ title: "Offline", description: "The photo can't be uploaded without signal. Completing with name only." });
    } else if (photo) {
      setUploading(true);
      const { data: auth } = await supabase.auth.getUser();
      const ext = photo.name.split(".").pop() || "jpg";
      const path = `${auth.user?.id}/${stop.route_id}/${stop.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("delivery-proofs").upload(path, photo, { contentType: photo.type });
      setUploading(false);
      if (error) {
        toast({ variant: "destructive", title: "Photo upload failed", description: "You can still complete without a photo." });
      } else {
        photoPath = path;
      }
    }
    await onSubmit(
      {
        received_by: receivedBy.trim() || null,
        photo_path: photoPath,
        method: needsOtp ? "otp" : photoPath ? "photo" : "name",
        pieces_scanned: pieces?.scanned ?? null,
        pieces_total: pieces?.total ?? null,
        unscanned_confirmed: missing ? true : undefined,
        captured_at: new Date().toISOString(),
      },
      otp.trim(),
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isDelivery ? "Confirm delivery" : "Confirm collection"}</DialogTitle>
          <DialogDescription>
            Stop {stop.sequence} · {stop.contact_name}
            {stop.cod_amount ? ` · collect R ${Number(stop.cod_amount).toFixed(2)} cash` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {missing && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <input type="checkbox" className="mt-1" checked={missingOk} onChange={(e) => setMissingOk(e.target.checked)} />
              <span>
                Only {pieces!.scanned} of {pieces!.total} boxes scanned. I've counted all {pieces!.total} boxes by hand. This is recorded.
              </span>
            </label>
          )}
          <div className="space-y-1.5">
            <Label>{isDelivery ? "Received by" : "Handed over by"}</Label>
            <Input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Full name" />
          </div>
          {needsOtp && (
            <div className="space-y-1.5">
              <Label>Recipient OTP</Label>
              <Input inputMode="numeric" maxLength={4} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="4-digit code" className="tracking-[0.5em] text-center text-lg" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Photo (optional)</Label>
            <Button type="button" variant="outline" className="w-full" asChild>
              <label className="cursor-pointer">
                <Camera className="h-4 w-4 mr-1.5" /> {photo ? photo.name : "Take photo"}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
              </label>
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Back
          </Button>
          <Button onClick={submit} disabled={busy || uploading || (needsOtp && otp.length !== 4) || (isDelivery && !receivedBy.trim()) || (missing && !missingOk)}>
            {uploading ? "Uploading…" : busy ? "Saving…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const FailStopDialog: React.FC<{
  stop: { sequence?: number; contact_name?: string | null } | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}> = ({ stop, busy, onClose, onSubmit }) => {
  const [reason, setReason] = useState(FAILURE_REASONS[0]);
  const [other, setOther] = useState("");
  useEffect(() => {
    setReason(FAILURE_REASONS[0]);
    setOther("");
  }, [stop]);
  if (!stop) return null;
  const final = reason === "other" ? other.trim() : reason;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>What went wrong?</DialogTitle>
          <DialogDescription>{stop.contact_name ? `${stop.contact_name}. ` : ""}Dispatch and the customer will see this reason.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={reason} onValueChange={setReason} className="space-y-1">
          {[...FAILURE_REASONS, "other"].map((r) => (
            <label key={r} className="flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer has-[:checked]:border-primary">
              <RadioGroupItem value={r} />
              <span className="text-sm">{r === "other" ? "Other" : r}</span>
            </label>
          ))}
        </RadioGroup>
        {reason === "other" && <Textarea rows={2} value={other} onChange={(e) => setOther(e.target.value)} placeholder="Describe what happened" />}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Back
          </Button>
          <Button variant="destructive" disabled={busy || !final} onClick={() => onSubmit(final)}>
            Record failed attempt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DriverRouteRun;

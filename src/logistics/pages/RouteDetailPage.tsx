import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Circle, ListOrdered, MapPin, Send, Sparkles, XCircle } from "lucide-react";
import GoogleMap from "@/components/maps/GoogleMap";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { db, formatAddress, invokeDispatch, type DeliveryRoute, type RouteStop, type Shipment } from "../lib/db";
import { useDriverLocations, useDrivers, useHubs, useRealtimeInvalidate } from "../lib/queries";
import { useLogisticsAuth } from "../auth/LogisticsAuth";
import { PageHeader, RouteStatusBadge, ShipmentStatusBadge, Spinner, StatCard } from "../components/common";

const STOP_ICON: Record<RouteStop["status"], React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  arrived: <MapPin className="h-4 w-4 text-blue-600" />,
  completed: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  failed: <XCircle className="h-4 w-4 text-orange-600" />,
  skipped: <XCircle className="h-4 w-4 text-muted-foreground" />,
};

const RouteDetailPage: React.FC = () => {
  const { routeId } = useParams();
  const { can } = useLogisticsAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [draftOrder, setDraftOrder] = useState<RouteStop[] | null>(null);
  const { data: drivers = [] } = useDrivers();
  const { data: hubs = [] } = useHubs();
  const { data: locations = [] } = useDriverLocations();

  const { data, isLoading } = useQuery({
    queryKey: ["lx", "routes", "detail", routeId],
    queryFn: async () => {
      const [r, s] = await Promise.all([
        db.from("delivery_routes").select("*").eq("id", routeId).single(),
        db.from("route_stops").select("*").eq("route_id", routeId).order("sequence"),
      ]);
      if (r.error) throw r.error;
      if (s.error) throw s.error;
      const stops = (s.data ?? []) as RouteStop[];
      const shipmentIds = [...new Set(stops.map((x) => x.shipment_id).filter(Boolean))] as string[];
      const sh = shipmentIds.length ? await db.from("shipments").select("id, tracking_number, status").in("id", shipmentIds) : { data: [] };
      return {
        route: r.data as DeliveryRoute,
        stops,
        shipments: new Map(((sh.data ?? []) as Pick<Shipment, "id" | "tracking_number" | "status">[]).map((x) => [x.id, x])),
      };
    },
  });

  const { data: pieceProgress = {} } = useQuery({
    queryKey: ["lx", "routes", "pieces", routeId],
    queryFn: async () => {
      const { data } = await db.rpc("driver_route_piece_progress", { p_route_id: routeId });
      const out: Record<string, { scanned: number; total: number }> = {};
      ((data ?? []) as Array<{ stop_id: string; scanned: number; total: number }>).forEach((r) => (out[r.stop_id] = r));
      return out;
    },
    refetchInterval: 60_000,
  });

  useRealtimeInvalidate(`lx-route-${routeId}`, ["route_stops", "delivery_routes"], [["lx", "routes", "detail", routeId]]);

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const { route, stops, shipments } = data;
  const editable = ["draft", "planned"].includes(route.status);
  const canDispatch = can("owner", "dispatcher");
  const driver = drivers.find((d) => d.id === route.driver_id);
  const driverLoc = locations.find((l) => l.driver_id === route.driver_id && l.is_online);
  const done = stops.filter((s) => s.status === "completed").length;
  const failed = stops.filter((s) => s.status === "failed" || s.status === "skipped").length;
  const refresh = () => qc.invalidateQueries({ queryKey: ["lx", "routes"] });

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast({ title: ok });
      refresh();
    } catch (err) {
      toast({ variant: "destructive", title: "Action failed", description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  };

  const setDriver = (driverId: string) =>
    run(
      "driver",
      async () => {
        const { error } = await db.from("delivery_routes").update({ driver_id: driverId }).eq("id", route.id);
        if (error) throw error;
      },
      "Driver assigned",
    );

  const cancelRoute = () =>
    run(
      "cancel",
      async () => {
        const { error } = await db.from("delivery_routes").update({ status: "cancelled" }).eq("id", route.id);
        if (error) throw error;
        // Release linked jobs so they can be re-dispatched.
        await db.from("delivery_jobs").update({ route_id: null }).eq("route_id", route.id);
      },
      "Route cancelled",
    );

  // Manual reorder: only open stops move; closed stops stay where they were.
  const reorderable = ["draft", "planned", "dispatched", "in_progress"].includes(route.status);
  const move = (idx: number, dir: -1 | 1) =>
    setDraftOrder((cur) => {
      if (!cur) return cur;
      const j = idx + dir;
      if (j < 0 || j >= cur.length || cur[j].status !== "pending" || cur[idx].status !== "pending") return cur;
      const next = [...cur];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  const saveOrder = () =>
    run(
      "reorder",
      async () => {
        if (!draftOrder) return;
        // Validate pickup-before-delivery locally for a friendly message.
        const seen = new Set<string>();
        const pickups = new Set(draftOrder.filter((s) => s.stop_type === "pickup" && s.shipment_id).map((s) => s.shipment_id));
        for (const s of draftOrder) {
          if (s.stop_type === "pickup" && s.shipment_id) seen.add(s.shipment_id);
          if (s.stop_type === "delivery" && s.shipment_id && pickups.has(s.shipment_id) && !seen.has(s.shipment_id)) {
            throw new Error(`Stop for ${s.contact_name ?? "a parcel"} is delivered before it's collected.`);
          }
        }
        const changed = draftOrder.map((s, i) => ({ id: s.id, sequence: i + 1, old: s.sequence })).filter((x) => x.sequence !== x.old);
        for (const c of changed) {
          const { error } = await db.from("route_stops").update({ sequence: c.sequence }).eq("id", c.id);
          if (error) throw error;
        }
        await invokeDispatch("recalc_route", { routeId: route.id });
        setDraftOrder(null);
      },
      "Stop order saved",
    );

  const markers = stops
    .filter((s) => s.lat != null && s.lng != null)
    .map((s) => ({
      position: { lat: Number(s.lat), lng: Number(s.lng) },
      label: String(s.sequence),
      title: `${s.sequence}. ${s.stop_type} · ${s.contact_name ?? ""}`,
    }));

  return (
    <div>
      <Link to="/routes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-4 w-4" /> Routes
      </Link>
      <PageHeader
        title={route.name}
        description={`${format(new Date(route.route_date), "EEEE d MMMM")}${route.planned_start ? ` · starts ${format(new Date(route.planned_start), "HH:mm")}` : ""}${
          route.hub_id ? ` · from ${hubs.find((h) => h.id === route.hub_id)?.name ?? "hub"}` : ""
        }`}
        actions={
          canDispatch && (
            <>
              {editable && (
                <Button variant="outline" disabled={!!busy} onClick={() => run("opt", () => invokeDispatch("optimize_route", { routeId: route.id }), "Route re-optimised")}>
                  <Sparkles className="h-4 w-4 mr-1.5" /> {busy === "opt" ? "Optimising…" : "Optimise"}
                </Button>
              )}
              {editable && (
                <Button
                  disabled={!!busy || !route.driver_id}
                  onClick={() => run("dispatch", () => invokeDispatch("dispatch_route", { routeId: route.id }), "Route sent to driver")}
                >
                  <Send className="h-4 w-4 mr-1.5" /> {busy === "dispatch" ? "Dispatching…" : "Dispatch"}
                </Button>
              )}
              {["draft", "planned", "dispatched"].includes(route.status) && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="text-destructive" disabled={!!busy}>
                      Cancel route
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel this route?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Its shipments go back to the pool and can be planned onto another route. The driver will no longer see it.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep route</AlertDialogCancel>
                      <AlertDialogAction onClick={cancelRoute}>Cancel route</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <StatCard label="Status" value={<RouteStatusBadge status={route.status} className="text-sm" />} />
        <StatCard label="Stops" value={`${done}/${stops.length}`} hint={failed ? `${failed} failed or skipped` : undefined} tone={failed ? "warn" : "default"} />
        <StatCard
          label="Distance"
          value={route.total_distance_km != null ? `${Number(route.total_distance_km).toFixed(1)} km` : "—"}
          hint={route.co2_kg != null ? `≈ ${Number(route.co2_kg).toFixed(1)} kg CO₂` : undefined}
        />
        <StatCard
          label="Est. duration"
          value={route.total_duration_mins != null ? `${Math.floor(route.total_duration_mins / 60)}h ${route.total_duration_mins % 60}m` : "—"}
        />
        <div className="rounded-xl border bg-card p-4 col-span-2 md:col-span-1">
          <div className="text-xs font-medium text-muted-foreground">Driver</div>
          {canDispatch && editable ? (
            <Select value={route.driver_id ?? undefined} onValueChange={setDriver} disabled={!!busy}>
              <SelectTrigger className="mt-2 h-9">
                <SelectValue placeholder="Assign driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} · {d.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="mt-2 text-sm font-medium">{driver?.name ?? "Unassigned"}</div>
          )}
          {driverLoc && <div className="mt-1 text-xs text-emerald-600">Online</div>}
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <section className="lg:col-span-3 rounded-xl border bg-card">
          <div className="flex items-center justify-between px-4 py-2.5 border-b">
            <span className="text-sm font-semibold">Stops</span>
            {canDispatch && reorderable && (
              draftOrder ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setDraftOrder(null)} disabled={!!busy}>
                    Discard
                  </Button>
                  <Button size="sm" onClick={saveOrder} disabled={!!busy}>
                    {busy === "reorder" ? "Saving…" : "Save order"}
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setDraftOrder(stops)}>
                  <ListOrdered className="h-4 w-4 mr-1.5" /> Reorder
                </Button>
              )
            )}
          </div>
          <ol className="divide-y">
            {(draftOrder ?? stops).map((s, idx, list) => {
              const sh = s.shipment_id ? shipments.get(s.shipment_id) : undefined;
              return (
                <li key={s.id} className="flex gap-3 px-4 py-3">
                  <div className="flex flex-col items-center gap-1 pt-0.5">
                    <span className="text-xs font-semibold tabular-nums w-6 text-center">{draftOrder ? idx + 1 : s.sequence}</span>
                    {STOP_ICON[s.status]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                          s.stop_type === "pickup" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                        }`}
                      >
                        {s.stop_type}
                      </span>
                      <span className="text-sm font-medium truncate">{s.contact_name}</span>
                      {sh && <span className="font-mono text-xs text-muted-foreground">{sh.tracking_number}</span>}
                      {pieceProgress[s.id]?.total > 1 && (
                        <span
                          className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${
                            pieceProgress[s.id].scanned >= pieceProgress[s.id].total ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-muted"
                          }`}
                        >
                          {pieceProgress[s.id].scanned}/{pieceProgress[s.id].total} boxes
                        </span>
                      )}
                      {s.proof && (s.proof as { unscanned_confirmed?: boolean }).unscanned_confirmed && (
                        <span className="text-[10px] font-semibold text-amber-700">boxes counted by hand</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{formatAddress(s.address)}</p>
                    {s.window_start && s.window_end && (
                      <p className="text-xs text-muted-foreground">
                        Window {format(new Date(s.window_start), "HH:mm")}–{format(new Date(s.window_end), "HH:mm")}
                        {s.eta && new Date(s.eta) > new Date(s.window_end) && <span className="text-red-600 font-medium"> · ETA after window</span>}
                      </p>
                    )}
                    {s.lat == null && <p className="text-xs text-amber-600">No coordinates, so this stop is placed at the end</p>}
                    {s.failure_reason && <p className="text-xs text-orange-600">{s.failure_reason}</p>}
                    {s.status === "completed" && s.proof && (
                      <p className="text-xs text-muted-foreground">
                        {s.proof.received_by ? `Received by ${String(s.proof.received_by)}` : "Completed"}
                        {s.proof.method === "otp" ? " · OTP verified" : ""}
                        {typeof s.proof.photo_path === "string" && (
                          <button
                            type="button"
                            className="ml-2 text-primary hover:underline"
                            onClick={async () => {
                              const { data: signed, error } = await db.storage
                                .from("delivery-proofs")
                                .createSignedUrl(s.proof!.photo_path as string, 300);
                              if (error || !signed) toast({ variant: "destructive", title: "Could not load photo" });
                              else window.open(signed.signedUrl, "_blank", "noopener");
                            }}
                          >
                            View photo
                          </button>
                        )}
                      </p>
                    )}
                  </div>
                  {draftOrder && s.status === "pending" && (
                    <div className="flex flex-col">
                      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Move up" disabled={idx === 0 || list[idx - 1].status !== "pending"} onClick={() => move(idx, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Move down" disabled={idx === list.length - 1} onClick={() => move(idx, 1)}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div className="text-right text-xs text-muted-foreground whitespace-nowrap space-y-1">
                    {s.completed_at ? (
                      <div>{format(new Date(s.completed_at), "HH:mm")}</div>
                    ) : s.eta ? (
                      <div>ETA {format(new Date(s.eta), "HH:mm")}</div>
                    ) : null}
                    {sh && s.stop_type === "delivery" && <ShipmentStatusBadge status={sh.status} />}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
        <aside className="lg:col-span-2">
          <div className="rounded-xl border bg-card overflow-hidden lg:sticky lg:top-20">
            <GoogleMap
              className="w-full h-[420px]"
              zoom={11}
              center={markers[0]?.position}
              markers={markers}
              driverLocation={driverLoc ? { lat: driverLoc.latitude, lng: driverLoc.longitude } : undefined}
            />
          </div>
        </aside>
      </div>
    </div>
  );
};

export default RouteDetailPage;

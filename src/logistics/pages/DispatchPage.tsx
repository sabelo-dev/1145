import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, Radar, RefreshCw, Zap } from "lucide-react";
import GoogleMap from "@/components/maps/GoogleMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { extractCoords } from "@/lib/navigation";
import { db, formatAddress, invokeDispatch, type Address } from "../lib/db";
import { useDriverLocations, useDrivers, useRealtimeInvalidate } from "../lib/queries";
import { useLogisticsAuth } from "../auth/LogisticsAuth";
import { EmptyState, PageHeader, Spinner } from "../components/common";

interface JobRow {
  id: string;
  order_id: string | null;
  driver_id: string | null;
  status: string;
  priority: string;
  pickup_address: Address;
  delivery_address: Address;
  failure_reason: string | null;
  offered_driver_id: string | null;
  offer_expires_at: string | null;
  offer_count: number | null;
  distance_km: number | null;
  earnings: number | null;
  created_at: string;
}

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const DispatchPage: React.FC = () => {
  const { can } = useLogisticsAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [radius, setRadius] = useState("15");
  const [autoBusy, setAutoBusy] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const { data: drivers = [] } = useDrivers();
  const { data: locations = [] } = useDriverLocations();

  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ["lx", "dispatch-jobs"],
    queryFn: async () => {
      const { data, error } = await db
        .from("delivery_jobs")
        .select("id, order_id, driver_id, status, priority, pickup_address, delivery_address, failure_reason, offered_driver_id, offer_expires_at, offer_count, distance_km, earnings, created_at")
        .or("and(status.eq.pending,driver_id.is.null),status.eq.failed")
        .is("route_id", null)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as JobRow[];
    },
  });

  useRealtimeInvalidate("lx-dispatch", ["delivery_jobs"], [["lx", "dispatch-jobs"]]);

  const online = useMemo(
    () =>
      locations
        .filter((l) => l.is_online)
        .map((l) => ({ ...l, driver: drivers.find((d) => d.id === l.driver_id) }))
        .filter((l) => l.driver),
    [locations, drivers],
  );
  const available = online.filter((l) => l.is_available && l.driver?.status === "available");

  const nearestFor = (job: JobRow) => {
    const p = extractCoords(job.pickup_address);
    if (!p) return [];
    return available
      .map((l) => ({ id: l.driver_id, name: l.driver!.name, km: km(p, { lat: l.latitude, lng: l.longitude }) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 6);
  };

  const assign = async (jobId: string, driverId: string) => {
    setAssigning(jobId);
    const { data, error } = await db
      .from("delivery_jobs")
      .update({ driver_id: driverId, status: "accepted", failure_reason: null })
      .eq("id", jobId)
      .in("status", ["pending", "failed"])
      .select("id");
    setAssigning(null);
    if (error || !data?.length) {
      toast({ variant: "destructive", title: "Assignment failed", description: error?.message ?? "The job was taken or changed. Refreshing." });
    } else {
      toast({ title: "Driver assigned", description: drivers.find((d) => d.id === driverId)?.name });
    }
    qc.invalidateQueries({ queryKey: ["lx", "dispatch-jobs"] });
  };

  const autoAssign = async () => {
    setAutoBusy(true);
    try {
      const res = await invokeDispatch<{ assigned: number; unassigned: Array<{ reason: string }>; driversAvailable: number }>("auto_assign", {
        maxRadiusKm: Number(radius) || 15,
      });
      const noDriver = res.unassigned.filter((u) => u.reason === "no_driver_in_radius").length;
      const noGeo = res.unassigned.filter((u) => u.reason === "pickup_not_geocoded").length;
      toast({
        title: `Assigned ${res.assigned} job${res.assigned === 1 ? "" : "s"}`,
        description: [
          `${res.driversAvailable} drivers available`,
          noDriver ? `${noDriver} with no driver in ${radius} km` : null,
          noGeo ? `${noGeo} without pickup coordinates` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      });
      qc.invalidateQueries({ queryKey: ["lx", "dispatch-jobs"] });
    } catch (err) {
      toast({ variant: "destructive", title: "Auto-assign failed", description: err instanceof Error ? err.message : String(err) });
    } finally {
      setAutoBusy(false);
    }
  };

  const markers = [
    ...jobs
      .map((j) => extractCoords(j.pickup_address))
      .filter((p): p is { lat: number; lng: number } => !!p)
      .map((p) => ({ position: p, title: "Pickup", label: "P" })),
    ...available.map((l) => ({ position: { lat: l.latitude, lng: l.longitude }, title: l.driver!.name, label: l.driver!.name.charAt(0) })),
  ];

  const canDispatch = can("owner", "dispatcher");

  return (
    <div>
      <PageHeader
        title="Dispatch"
        description="On-demand jobs waiting for a driver. Routed shipments are dispatched from Routes."
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={() => refetch()} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {canDispatch && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Input value={radius} onChange={(e) => setRadius(e.target.value)} className="w-24 pr-9" inputMode="numeric" aria-label="Radius km" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">km</span>
                </div>
                <Button onClick={autoAssign} disabled={autoBusy || jobs.length === 0}>
                  <Zap className="h-4 w-4 mr-1.5" /> {autoBusy ? "Assigning…" : "Auto-assign"}
                </Button>
              </div>
            )}
          </>
        }
      />

      <div className="grid lg:grid-cols-5 gap-4">
        <section className="lg:col-span-3 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : jobs.length === 0 ? (
            <EmptyState icon={<Radar className="h-8 w-8" />} title="Queue is clear" description="New on-demand delivery jobs appear here in real time." />
          ) : (
            jobs.map((job) => {
              const nearest = nearestFor(job);
              const geocoded = !!extractCoords(job.pickup_address);
              return (
                <div key={job.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{job.order_id ? `Order ${job.order_id.slice(0, 8)}` : `Job ${job.id.slice(0, 8)}`}</span>
                        <span>· waiting {formatDistanceToNowStrict(new Date(job.created_at))}</span>
                        {job.priority === "urgent" && <span className="text-red-600 font-medium">URGENT</span>}
                        {job.status === "failed" && <span className="text-orange-600 font-medium">FAILED · {job.failure_reason}</span>}
                        {job.offered_driver_id && job.offer_expires_at && new Date(job.offer_expires_at) > new Date() && (
                          <span className="text-blue-600 font-medium">
                            Offered to {drivers.find((d) => d.id === job.offered_driver_id)?.name ?? "driver"} · {job.offer_count} offer{job.offer_count === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                      <p className="text-sm">
                        <span className="text-muted-foreground">From</span> {formatAddress(job.pickup_address) || "—"}
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">To</span> {formatAddress(job.delivery_address) || "—"}
                      </p>
                    </div>
                    {job.earnings != null && <span className="text-sm font-medium whitespace-nowrap">R {Number(job.earnings).toFixed(2)}</span>}
                  </div>
                  {canDispatch && (
                    <div className="mt-3 flex items-center gap-2">
                      {!geocoded ? (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" /> Pickup has no coordinates, so assign manually.
                        </p>
                      ) : nearest.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No available drivers online.</p>
                      ) : null}
                      <Select disabled={assigning === job.id} onValueChange={(v) => assign(job.id, v)}>
                        <SelectTrigger className="ml-auto w-64">
                          <SelectValue placeholder="Assign driver…" />
                        </SelectTrigger>
                        <SelectContent>
                          {nearest.map((n) => (
                            <SelectItem key={n.id} value={n.id}>
                              {n.name} · {n.km.toFixed(1)} km
                            </SelectItem>
                          ))}
                          {drivers
                            .filter((d) => !nearest.some((n) => n.id === d.id) && d.status !== "offline")
                            .map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name} · {d.status}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        <aside className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b text-sm font-semibold">Pickups & available drivers</div>
            <GoogleMap
              className="w-full h-[320px]"
              zoom={11}
              center={markers[0]?.position}
              markers={markers}
            />
          </div>
          <div className="rounded-xl border bg-card">
            <div className="px-4 py-3 border-b text-sm font-semibold">
              Online drivers <span className="text-muted-foreground font-normal">({online.length})</span>
            </div>
            <ul className="divide-y max-h-[320px] overflow-y-auto">
              {online.length === 0 && <li className="p-4 text-sm text-muted-foreground">Nobody is online.</li>}
              {online.map((l) => (
                <li key={l.driver_id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span>{l.driver!.name}</span>
                  <span className={`text-xs ${l.is_available ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {l.is_available ? "available" : l.driver!.status} · {formatDistanceToNowStrict(new Date(l.last_updated))} ago
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default DispatchPage;

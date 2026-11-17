import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict, subDays } from "date-fns";
import { Star, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "../lib/db";
import { useDriverLocations, useDrivers } from "../lib/queries";
import { EmptyState, PageHeader, StatCard } from "../components/common";

const DriversPage: React.FC = () => {
  const { data: drivers = [] } = useDrivers();
  const { data: locations = [] } = useDriverLocations();
  const [q, setQ] = useState("");
  const since = useMemo(() => subDays(new Date(), 7).toISOString(), []);

  // 7-day stop performance per driver (from route stops on their routes).
  const { data: perf = {} } = useQuery({
    queryKey: ["lx", "driver-perf", since],
    queryFn: async () => {
      const { data, error } = await db
        .from("route_stops")
        .select("status, stop_type, delivery_routes!inner(driver_id)")
        .eq("stop_type", "delivery")
        .gte("completed_at", since)
        .in("status", ["completed", "failed"])
        .limit(10000);
      if (error) throw error;
      const out: Record<string, { ok: number; failed: number }> = {};
      // Many-to-one embed: PostgREST returns an object, the generic types say array.
      (data ?? []).forEach((r) => {
        const route = r.delivery_routes as unknown as { driver_id: string | null } | null;
        const id = route?.driver_id;
        if (!id) return;
        out[id] ??= { ok: 0, failed: 0 };
        if (r.status === "completed") out[id].ok++;
        else out[id].failed++;
      });
      return out;
    },
  });

  const rows = drivers.filter((d) => !q || d.name.toLowerCase().includes(q.toLowerCase()) || d.phone?.includes(q));
  const online = locations.filter((l) => l.is_online);

  return (
    <div>
      <PageHeader title="Drivers" description="Driver pool, availability and 7-day delivery performance." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="Registered" value={drivers.length} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Online now" value={online.length} tone="good" />
        <StatCard label="Available" value={online.filter((l) => l.is_available).length} />
        <StatCard label="On a job" value={drivers.filter((d) => d.status === "busy").length} />
      </div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone" className="mb-3 sm:w-72" />
      {rows.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title="No drivers found" />
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Vehicle</TableHead>
                <TableHead className="hidden md:table-cell">Rating</TableHead>
                <TableHead>Success (7d)</TableHead>
                <TableHead className="hidden lg:table-cell">Lifetime</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => {
                const loc = locations.find((l) => l.driver_id === d.id);
                const p = perf[d.id];
                const total = p ? p.ok + p.failed : 0;
                const rate = total ? Math.round((p!.ok / total) * 100) : null;
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{d.phone ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm ${loc?.is_online ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {loc?.is_online ? (loc.is_available ? "Available" : "Busy") : "Offline"}
                      </span>
                      {loc && <div className="text-xs text-muted-foreground">seen {formatDistanceToNowStrict(new Date(loc.last_updated))} ago</div>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {[d.vehicle_type, d.vehicle_registration].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="inline-flex items-center gap-1 text-sm tabular-nums">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {d.rating != null ? Number(d.rating).toFixed(1) : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {rate == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={rate < 85 ? "text-amber-600" : ""}>
                          {rate}% <span className="text-xs text-muted-foreground">({total})</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell tabular-nums text-sm text-muted-foreground">{d.total_deliveries ?? 0}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default DriversPage;

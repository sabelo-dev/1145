import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Leaf, Route as RouteIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import AutoPlanDialog from "../components/AutoPlanDialog";
import { useLogisticsAuth } from "../auth/LogisticsAuth";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, ROUTE_STATUS, type DeliveryRoute } from "../lib/db";
import { useDrivers, useHubs, useRealtimeInvalidate } from "../lib/queries";
import { EmptyState, PageHeader, RouteStatusBadge, Spinner } from "../components/common";

const RoutesPage: React.FC = () => {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [status, setStatus] = useState("all");
  const [planning, setPlanning] = useState(false);
  const { can } = useLogisticsAuth();
  const { data: drivers = [] } = useDrivers();
  const { data: hubs = [] } = useHubs();

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ["lx", "routes", "list", date, status],
    queryFn: async () => {
      let q = db.from("delivery_routes").select("*").order("created_at", { ascending: false }).limit(300);
      if (date) q = q.eq("route_date", date);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DeliveryRoute[];
    },
  });

  // Progress per route (completed stops / total).
  const { data: progress = {} } = useQuery({
    queryKey: ["lx", "routes", "progress", routes.map((r) => r.id).join(",")],
    enabled: routes.length > 0,
    queryFn: async () => {
      const { data, error } = await db
        .from("route_stops")
        .select("route_id, status")
        .in(
          "route_id",
          routes.map((r) => r.id),
        );
      if (error) throw error;
      const out: Record<string, { done: number; failed: number }> = {};
      (data ?? []).forEach((s: { route_id: string; status: string }) => {
        out[s.route_id] ??= { done: 0, failed: 0 };
        if (s.status === "completed") out[s.route_id].done++;
        if (s.status === "failed" || s.status === "skipped") out[s.route_id].failed++;
      });
      return out;
    },
  });

  useRealtimeInvalidate("lx-routes", ["delivery_routes", "route_stops"], [["lx", "routes"]]);

  return (
    <div>
      <PageHeader
        title="Routes"
        description="Plan the whole day automatically, or select shipments on the Shipments page to build a route by hand."
        actions={
          can("owner", "dispatcher") && (
            <Button onClick={() => setPlanning(true)}>
              <Sparkles className="h-4 w-4 mr-1.5" /> Plan my day
            </Button>
          )
        }
      />
      <AutoPlanDialog open={planning} onOpenChange={setPlanning} defaultDate={date} />

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-48" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(ROUTE_STATUS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : routes.length === 0 ? (
        <EmptyState
          icon={<RouteIcon className="h-8 w-8" />}
          title="No routes for this day"
          description="Go to Shipments, filter by 'Ready to route', select parcels and choose Plan route."
          action={
            <Link to="/shipments?status=routable" className="text-sm text-primary hover:underline">
              Open shipments ready to route
            </Link>
          }
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead className="hidden md:table-cell">Hub</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="hidden md:table-cell">Distance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((r) => {
                const p = progress[r.id] ?? { done: 0, failed: 0 };
                const pct = r.total_stops ? Math.round(((p.done + p.failed) / r.total_stops) * 100) : 0;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link to={`/routes/${r.id}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {r.planned_start ? format(new Date(r.planned_start), "HH:mm") : format(new Date(r.route_date), "d MMM")}
                      </div>
                    </TableCell>
                    <TableCell>{drivers.find((d) => d.id === r.driver_id)?.name ?? <span className="text-amber-600">Unassigned</span>}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{hubs.find((h) => h.id === r.hub_id)?.code ?? "—"}</TableCell>
                    <TableCell className="min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {p.done}/{r.total_stops}
                          {p.failed ? <span className="text-orange-600"> · {p.failed} failed</span> : null}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground tabular-nums">
                      {r.total_distance_km != null ? `${Number(r.total_distance_km).toFixed(1)} km` : "—"}
                      {r.co2_kg != null && (
                        <div className="text-xs inline-flex items-center gap-1">
                          <Leaf className="h-3 w-3" /> {Number(r.co2_kg).toFixed(1)} kg CO₂
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <RouteStatusBadge status={r.status} />
                    </TableCell>
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

export default RoutesPage;

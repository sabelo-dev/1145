import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, startOfDay, subDays } from "date-fns";
import { AlertTriangle, Clock, Package, PackageCheck, Route as RouteIcon, Truck, Users } from "lucide-react";
import GoogleMap from "@/components/maps/GoogleMap";
import { db, isLate, OPEN_SHIPMENT_STATUSES, type Shipment } from "../lib/db";
import { useDriverLocations, useDrivers, useOpenRoutes, useRealtimeInvalidate } from "../lib/queries";
import { PageHeader, RouteStatusBadge, ShipmentStatusBadge, StatCard } from "../components/common";

const OverviewPage: React.FC = () => {
  const since = useMemo(() => subDays(startOfDay(new Date()), 6).toISOString(), []);

  const { data: shipments = [] } = useQuery({
    queryKey: ["lx", "shipments", "overview", since],
    queryFn: async () => {
      const [recent, open] = await Promise.all([
        db.from("shipments").select("*").gte("created_at", since).limit(2000),
        db.from("shipments").select("*").in("status", OPEN_SHIPMENT_STATUSES).limit(2000),
      ]);
      if (recent.error) throw recent.error;
      if (open.error) throw open.error;
      const byId = new Map<string, Shipment>();
      [...(recent.data ?? []), ...(open.data ?? [])].forEach((s) => byId.set(s.id, s as Shipment));
      return [...byId.values()];
    },
  });
  const { data: routes = [] } = useOpenRoutes();
  const { data: drivers = [] } = useDrivers();
  const { data: locations = [] } = useDriverLocations();

  useRealtimeInvalidate("lx-overview", ["shipments", "delivery_routes"], [["lx", "shipments"], ["lx", "routes"]]);

  const stats = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    const open = shipments.filter((s) => OPEN_SHIPMENT_STATUSES.includes(s.status));
    const deliveredToday = shipments.filter((s) => s.delivered_at && new Date(s.delivered_at).getTime() >= today);
    const delivered7d = shipments.filter((s) => s.status === "delivered" && s.promised_by);
    const onTime = delivered7d.filter((s) => !isLate(s)).length;
    const exceptions = open.filter((s) => ["exception", "failed_attempt", "returning"].includes(s.status));
    const late = open.filter((s) => isLate(s));
    const atRisk = open.filter((s) => !isLate(s) && s.sla_risk_at);
    return {
      createdToday: shipments.filter((s) => new Date(s.created_at).getTime() >= today).length,
      open: open.length,
      deliveredToday: deliveredToday.length,
      onTimeRate: delivered7d.length ? Math.round((onTime / delivered7d.length) * 100) : null,
      exceptions,
      late,
      atRisk,
      awaitingPickup: open.filter((s) => s.status === "awaiting_pickup" || s.status === "created").length,
    };
  }, [shipments]);

  const online = locations.filter((l) => l.is_online);
  const driverName = (id: string) => drivers.find((d) => d.id === id)?.name ?? "Driver";
  const activeRoutes = routes.filter((r) => r.status === "in_progress" || r.status === "dispatched");

  const attention = [
    ...stats.exceptions,
    ...stats.late.filter((s) => !stats.exceptions.includes(s)),
    ...stats.atRisk.filter((s) => !stats.exceptions.includes(s)),
  ].slice(0, 10);

  return (
    <div>
      <PageHeader title="Operations overview" description="Live view of today's network." />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard label="Booked today" value={stats.createdToday} icon={<Package className="h-4 w-4" />} />
        <StatCard label="In network" value={stats.open} hint={`${stats.awaitingPickup} awaiting pickup`} icon={<Truck className="h-4 w-4" />} />
        <StatCard label="Delivered today" value={stats.deliveredToday} tone="good" icon={<PackageCheck className="h-4 w-4" />} />
        <StatCard
          label="On-time (7d)"
          value={stats.onTimeRate == null ? "—" : `${stats.onTimeRate}%`}
          tone={stats.onTimeRate != null && stats.onTimeRate < 90 ? "warn" : "default"}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Needs attention"
          value={stats.exceptions.length + stats.late.length + stats.atRisk.length}
          tone={stats.exceptions.length + stats.late.length ? "danger" : stats.atRisk.length ? "warn" : "default"}
          hint={`${stats.late.length} past promise · ${stats.atRisk.length} at risk`}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="Drivers online"
          value={online.length}
          hint={`${online.filter((l) => l.is_available).length} available`}
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <section className="lg:col-span-2 rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h2 className="text-sm font-semibold">Live fleet</h2>
            <span className="text-xs text-muted-foreground">{online.length} online</span>
          </div>
          <GoogleMap
            className="w-full h-[360px]"
            zoom={11}
            center={online[0] ? { lat: online[0].latitude, lng: online[0].longitude } : undefined}
            markers={online.map((l) => ({
              position: { lat: l.latitude, lng: l.longitude },
              title: `${driverName(l.driver_id)} · ${l.is_available ? "available" : "busy"}`,
              label: driverName(l.driver_id).charAt(0),
            }))}
          />
        </section>

        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h2 className="text-sm font-semibold">Active routes</h2>
            <Link to="/routes" className="text-xs text-primary hover:underline">
              All routes
            </Link>
          </div>
          {activeRoutes.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No routes on the road right now.</p>
          ) : (
            <ul className="divide-y">
              {activeRoutes.slice(0, 8).map((r) => (
                <li key={r.id}>
                  <Link to={`/routes/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate flex items-center gap-1.5">
                        <RouteIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        {r.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.driver_id ? driverName(r.driver_id) : "Unassigned"} · {r.total_stops} stops
                      </p>
                    </div>
                    <RouteStatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-xl border bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold">Needs attention</h2>
          <Link to="/shipments?status=attention" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </div>
        {attention.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nothing late or stuck. 👍</p>
        ) : (
          <ul className="divide-y">
            {attention.map((s) => (
              <li key={s.id}>
                <Link to={`/shipments?q=${s.tracking_number}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="text-sm font-mono">{s.tracking_number}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.recipient_name}
                      {s.last_failure_reason ? ` · ${s.last_failure_reason}` : ""}
                      {isLate(s) && s.promised_by ? ` · due ${formatDistanceToNow(new Date(s.promised_by), { addSuffix: true })}` : ""}
                    </p>
                  </div>
                  <ShipmentStatusBadge status={s.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default OverviewPage;

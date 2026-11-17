import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { eachDayOfInterval, format, startOfDay, subDays } from "date-fns";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { db, formatAddress, isLate, SERVICE_LEVELS, type ServiceLevel, type Shipment } from "../lib/db";
import { PageHeader, Spinner, StatCard } from "../components/common";

const RANGES = { "7": 7, "30": 30, "90": 90 } as const;
type RangeKey = keyof typeof RANGES;

// Validated reference palette, slots 1–2 (adjacent pair passes CVD in both modes).
const VIZ_STYLE = `
.lx-viz { --series-1:#2a78d6; --series-2:#eb6834; --viz-grid:#e5e4df; --viz-axis:#52514e; }
.dark .lx-viz { --series-1:#3987e5; --series-2:#d95926; --viz-grid:#2c2c2a; --viz-axis:#c3c2b7; }
`;

const hours = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;

function toCsv(rows: Shipment[]): string {
  const cols = [
    "tracking_number", "reference", "status", "service_level", "source", "sender_name", "recipient_name",
    "recipient_phone", "delivery_address", "attempt_count", "promised_by", "delivered_at", "on_time", "created_at",
  ];
  const cell = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((s) =>
    [
      s.tracking_number, s.reference, s.status, s.service_level, (s as Shipment & { source?: string }).source, s.sender_name,
      s.recipient_name, s.recipient_phone, formatAddress(s.delivery_address), s.attempt_count, s.promised_by, s.delivered_at,
      s.status === "delivered" && s.promised_by ? (!isLate(s) ? "yes" : "no") : "", s.created_at,
    ].map(cell).join(","),
  );
  return [cols.join(","), ...lines].join("\n");
}

const ChartTooltip: React.FC<{ active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }> = ({
  active,
  payload,
  label,
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto tabular-nums font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const ReportsPage: React.FC = () => {
  const [range, setRange] = useState<RangeKey>("30");
  const [showTable, setShowTable] = useState(false);
  const since = useMemo(() => subDays(startOfDay(new Date()), RANGES[range] - 1), [range]);

  const { data, isLoading } = useQuery({
    queryKey: ["lx", "reports", range],
    queryFn: async () => {
      const [ships, fails, routes, eta] = await Promise.all([
        db.from("shipments").select("*").gte("created_at", since.toISOString()).order("created_at").limit(10000),
        db
          .from("shipment_events")
          .select("notes, created_at")
          .eq("status", "failed_attempt")
          .eq("event_type", "status_change")
          .gte("created_at", since.toISOString())
          .limit(10000),
        db
          .from("delivery_routes")
          .select("total_distance_km, co2_kg, status")
          .gte("route_date", format(since, "yyyy-MM-dd"))
          .in("status", ["in_progress", "completed"])
          .limit(5000),
        db.rpc("logistics_eta_accuracy", { p_since: since.toISOString() }),
      ]);
      if (ships.error) throw ships.error;
      if (routes.error) throw routes.error;
      if (fails.error) throw fails.error;
      return {
        shipments: (ships.data ?? []) as Shipment[],
        failures: (fails.data ?? []) as Array<{ notes: string | null }>,
        routes: (routes.data ?? []) as Array<{ total_distance_km: number | null; co2_kg: number | null }>,
        eta: (eta.data ?? null) as { samples: number; median_abs_error_mins: number | null; within_15_mins_pct: number | null } | null,
      };
    },
  });

  const report = useMemo(() => {
    const shipments = data?.shipments ?? [];
    const delivered = shipments.filter((s) => s.status === "delivered" && s.delivered_at);
    const withPromise = delivered.filter((s) => s.promised_by);
    const onTime = withPromise.filter((s) => !isLate(s));
    const firstAttempt = delivered.filter((s) => s.attempt_count === 0);
    const leadTimes = delivered.map((s) => hours(s.created_at, s.delivered_at!)).filter((h) => h >= 0);

    const days = eachDayOfInterval({ start: since, end: new Date() }).map((d) => ({
      key: format(d, "yyyy-MM-dd"),
      label: format(d, RANGES[range] > 31 ? "d MMM" : "EEE d"),
      onTime: 0,
      late: 0,
    }));
    const byDay = new Map(days.map((d) => [d.key, d]));
    delivered.forEach((s) => {
      const d = byDay.get(format(new Date(s.delivered_at!), "yyyy-MM-dd"));
      if (!d) return;
      if (s.promised_by && isLate(s)) d.late++;
      else d.onTime++;
    });

    const reasons = new Map<string, number>();
    (data?.failures ?? []).forEach((f) => {
      const r = f.notes?.trim() || "No reason given";
      reasons.set(r, (reasons.get(r) ?? 0) + 1);
    });
    const failureReasons = [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);

    const byService = (Object.keys(SERVICE_LEVELS) as ServiceLevel[]).map((level) => {
      const rows = shipments.filter((s) => s.service_level === level);
      const del = rows.filter((s) => s.status === "delivered" && s.delivered_at);
      const prom = del.filter((s) => s.promised_by);
      const lt = del.map((s) => hours(s.created_at, s.delivered_at!));
      return {
        level,
        booked: rows.length,
        delivered: del.length,
        onTime: prom.length ? Math.round((prom.filter((s) => !isLate(s)).length / prom.length) * 100) : null,
        avgHours: lt.length ? lt.reduce((a, b) => a + b, 0) / lt.length : null,
      };
    });

    const routes = data?.routes ?? [];
    const co2 = routes.reduce((a, r) => a + Number(r.co2_kg ?? 0), 0);
    const km = routes.reduce((a, r) => a + Number(r.total_distance_km ?? 0), 0);
    const rated = shipments.filter((s) => s.rating);
    return {
      co2Kg: co2,
      routeKm: km,
      co2PerParcel: delivered.length && co2 ? co2 / delivered.length : null,
      avgRating: rated.length ? rated.reduce((a, s) => a + Number(s.rating), 0) / rated.length : null,
      ratings: rated.length,
      booked: shipments.length,
      delivered: delivered.length,
      onTimeRate: withPromise.length ? Math.round((onTime.length / withPromise.length) * 100) : null,
      firstAttemptRate: delivered.length ? Math.round((firstAttempt.length / delivered.length) * 100) : null,
      avgLeadHours: leadTimes.length ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : null,
      failedAttempts: data?.failures.length ?? 0,
      returned: shipments.filter((s) => s.status === "returned" || s.status === "returning").length,
      days,
      failureReasons,
      byService,
      shipments,
    };
  }, [data, since, range]);

  const exportCsv = () => {
    const blob = new Blob([toCsv(report.shipments)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `1145-logistics-shipments-${format(since, "yyyyMMdd")}-${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmtHours = (h: number | null) => (h == null ? "—" : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} d`);

  return (
    <div className="lx-viz">
      <style>{VIZ_STYLE}</style>
      <PageHeader
        title="Reports"
        description="Service performance for shipments booked in the selected period."
        actions={
          <>
            <ToggleGroup type="single" value={range} onValueChange={(v) => v && setRange(v as RangeKey)} variant="outline" size="sm">
              {(Object.keys(RANGES) as RangeKey[]).map((k) => (
                <ToggleGroupItem key={k} value={k} aria-label={`Last ${k} days`}>
                  {k}d
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!report.shipments.length}>
              <Download className="h-4 w-4 mr-1.5" /> Export CSV
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatCard label="Booked" value={report.booked} />
            <StatCard label="Delivered" value={report.delivered} />
            <StatCard label="On-time" value={report.onTimeRate == null ? "—" : `${report.onTimeRate}%`} hint="of deliveries with a promise" />
            <StatCard label="First-attempt success" value={report.firstAttemptRate == null ? "—" : `${report.firstAttemptRate}%`} />
            <StatCard label="Avg. booking → delivery" value={fmtHours(report.avgLeadHours)} />
            <StatCard label="Failed attempts" value={report.failedAttempts} hint={`${report.returned} returned or returning`} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <StatCard
              label="ETA accuracy"
              value={data?.eta?.samples ? `±${data.eta.median_abs_error_mins ?? 0} min` : "—"}
              hint={data?.eta?.samples ? `${data.eta.within_15_mins_pct}% within 15 min · ${data.eta.samples} stops` : "Builds up as routes complete"}
            />
            <StatCard
              label="Customer rating"
              value={report.avgRating == null ? "—" : `${report.avgRating.toFixed(1)} / 5`}
              hint={`${report.ratings} rating${report.ratings === 1 ? "" : "s"}`}
            />
            <StatCard
              label="Route CO₂ (est.)"
              value={`${report.co2Kg.toFixed(0)} kg`}
              hint={`${report.routeKm.toFixed(0)} km driven on routes`}
            />
            <StatCard
              label="CO₂ per delivered parcel"
              value={report.co2PerParcel == null ? "—" : `${(report.co2PerParcel * 1000).toFixed(0)} g`}
              hint="Consolidated routes vs. one trip per parcel"
            />
          </div>

          <section className="mt-4 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm font-semibold">Deliveries per day</h2>
                <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground" aria-label="Legend">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-1)" }} /> On time
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-2)" }} /> Late
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowTable((v) => !v)}>
                {showTable ? "Show chart" : "Show table"}
              </Button>
            </div>
            {showTable ? (
              <div className="max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Day</TableHead>
                      <TableHead className="text-right">On time</TableHead>
                      <TableHead className="text-right">Late</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.days.map((d) => (
                      <TableRow key={d.key}>
                        <TableCell>{d.label}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.onTime}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.late}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="h-[280px]" role="img" aria-label="Stacked columns of on-time and late deliveries per day">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.days} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="20%">
                    <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--viz-axis)" }} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--viz-axis)" }} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.6 }} />
                    <Bar dataKey="onTime" name="On time" stackId="d" fill="var(--series-1)" stroke="hsl(var(--card))" strokeWidth={2} maxBarSize={24} />
                    <Bar dataKey="late" name="Late" stackId="d" fill="var(--series-2)" stroke="hsl(var(--card))" strokeWidth={2} maxBarSize={24} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <div className="grid lg:grid-cols-2 gap-4 mt-4">
            <section className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold mb-3">Why deliveries fail</h2>
              {report.failureReasons.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No failed attempts in this period.</p>
              ) : (
                <div style={{ height: Math.max(120, report.failureReasons.slice(0, 8).length * 40) }} role="img" aria-label="Failed attempts by reason">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.failureReasons.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                      <XAxis type="number" hide allowDecimals={false} />
                      <YAxis type="category" dataKey="reason" width={180} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--viz-axis)" }} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.6 }} />
                      <Bar dataKey="count" name="Failed attempts" fill="var(--series-1)" maxBarSize={20} radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="count" position="right" style={{ fontSize: 12, fill: "hsl(var(--foreground))" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="rounded-xl border bg-card">
              <h2 className="text-sm font-semibold px-4 pt-4 pb-2">By service level</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead className="text-right">Booked</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                    <TableHead className="text-right">On-time</TableHead>
                    <TableHead className="text-right">Avg. time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.byService.map((r) => (
                    <TableRow key={r.level}>
                      <TableCell>{SERVICE_LEVELS[r.level]}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.booked}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.delivered}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.onTime == null ? "—" : `${r.onTime}%`}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtHours(r.avgHours)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportsPage;

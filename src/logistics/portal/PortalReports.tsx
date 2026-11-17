import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { eachDayOfInterval, format, startOfDay, subDays } from "date-fns";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, isLate, SERVICE_LEVELS, type ServiceLevel, type Shipment } from "../lib/db";
import { PageHeader, Spinner, StatCard } from "../components/common";
import { usePortal } from "./PortalApp";

// Reference palette slot 1 (single series), light/dark steps.
const VIZ_STYLE = `
.lx-pviz { --series-1:#2a78d6; --viz-grid:#e5e4df; --viz-axis:#52514e; }
.dark .lx-pviz { --series-1:#3987e5; --viz-grid:#2c2c2a; --viz-axis:#c3c2b7; }
`;
const RANGES = { "30": 30, "90": 90 } as const;
type RangeKey = keyof typeof RANGES;

const Tip: React.FC<{ active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }> = ({ active, payload, label }) =>
  active && payload?.length ? (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium">{label}</div>
      <div className="tabular-nums">
        {payload[0].value} {payload[0].name.toLowerCase()}
      </div>
    </div>
  ) : null;

const PortalReports: React.FC = () => {
  const { account } = usePortal();
  const [range, setRange] = useState<RangeKey>("30");
  const [table, setTable] = useState(false);
  const since = useMemo(() => subDays(startOfDay(new Date()), RANGES[range] - 1), [range]);

  const { data, isLoading } = useQuery({
    queryKey: ["portal", account.id, "reports", range],
    queryFn: async () => {
      const [ships, fails] = await Promise.all([
        db.from("shipments").select("*").eq("account_id", account.id).gte("created_at", since.toISOString()).limit(10000),
        db
          .from("shipment_events")
          .select("notes, shipments!inner(account_id)")
          .eq("shipments.account_id", account.id)
          .eq("status", "failed_attempt")
          .eq("event_type", "status_change")
          .gte("created_at", since.toISOString())
          .limit(5000),
      ]);
      return { shipments: (ships.data ?? []) as Shipment[], failures: (fails.data ?? []) as Array<{ notes: string | null }> };
    },
  });

  const r = useMemo(() => {
    const s = data?.shipments ?? [];
    const delivered = s.filter((x) => x.status === "delivered" && x.delivered_at);
    const promised = delivered.filter((x) => x.promised_by);
    const lead = delivered.map((x) => (new Date(x.delivered_at!).getTime() - new Date(x.created_at).getTime()) / 3_600_000).filter((h) => h >= 0);
    const days = eachDayOfInterval({ start: since, end: new Date() }).map((d) => ({ key: format(d, "yyyy-MM-dd"), label: format(d, "d MMM"), delivered: 0 }));
    const byDay = new Map(days.map((d) => [d.key, d]));
    delivered.forEach((x) => {
      const d = byDay.get(format(new Date(x.delivered_at!), "yyyy-MM-dd"));
      if (d) d.delivered++;
    });
    const reasons = new Map<string, number>();
    (data?.failures ?? []).forEach((f) => reasons.set(f.notes?.trim() || "No reason given", (reasons.get(f.notes?.trim() || "No reason given") ?? 0) + 1));
    return {
      booked: s.length,
      delivered: delivered.length,
      onTime: promised.length ? Math.round((promised.filter((x) => !isLate(x)).length / promised.length) * 100) : null,
      firstAttempt: delivered.length ? Math.round((delivered.filter((x) => x.attempt_count === 0).length / delivered.length) * 100) : null,
      leadHours: lead.length ? lead.reduce((a, b) => a + b, 0) / lead.length : null,
      returns: s.filter((x) => x.return_of_shipment_id).length,
      spend: s.filter((x) => x.status !== "cancelled").reduce((a, x) => a + Number(x.shipping_fee ?? 0), 0),
      days,
      reasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 6),
      byService: (Object.keys(SERVICE_LEVELS) as ServiceLevel[])
        .map((lvl) => {
          const rows = s.filter((x) => x.service_level === lvl);
          const del = rows.filter((x) => x.status === "delivered" && x.promised_by);
          return { lvl, booked: rows.length, onTime: del.length ? Math.round((del.filter((x) => !isLate(x)).length / del.length) * 100) : null };
        })
        .filter((x) => x.booked > 0),
      rows: s,
    };
  }, [data, since]);

  const exportCsv = () => {
    const cols = ["tracking_number", "reference", "service_level", "status", "created_at", "promised_by", "delivered_at", "attempt_count", "shipping_fee"];
    const cell = (v: unknown) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const csv = [cols.join(","), ...r.rows.map((x) => cols.map((c) => cell((x as unknown as Record<string, unknown>)[c])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${account.name.replace(/\W+/g, "-")}-performance-${range}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmtH = (h: number | null) => (h == null ? "—" : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} d`);

  return (
    <div className="lx-pviz space-y-4">
      <style>{VIZ_STYLE}</style>
      <PageHeader
        title="Delivery performance"
        description={`Parcels booked by ${account.name} in the last ${range} days.`}
        actions={
          <>
            <ToggleGroup type="single" size="sm" variant="outline" value={range} onValueChange={(v) => v && setRange(v as RangeKey)}>
              <ToggleGroupItem value="30">30d</ToggleGroupItem>
              <ToggleGroupItem value="90">90d</ToggleGroupItem>
            </ToggleGroup>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!r.rows.length}>
              <Download className="h-4 w-4 mr-1.5" /> CSV
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
            <StatCard label="Booked" value={r.booked} />
            <StatCard label="Delivered" value={r.delivered} />
            <StatCard label="On time" value={r.onTime == null ? "—" : `${r.onTime}%`} />
            <StatCard label="First-attempt success" value={r.firstAttempt == null ? "—" : `${r.firstAttempt}%`} />
            <StatCard label="Avg. booking → delivery" value={fmtH(r.leadHours)} />
            <StatCard label="Spend" value={`R ${r.spend.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`} hint={`${r.returns} returns`} />
          </div>

          <section className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Deliveries per day</h2>
              <Button size="sm" variant="ghost" onClick={() => setTable((v) => !v)}>
                {table ? "Show chart" : "Show table"}
              </Button>
            </div>
            {table ? (
              <div className="max-h-72 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Day</TableHead>
                      <TableHead className="text-right">Delivered</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.days.map((d) => (
                      <TableRow key={d.key}>
                        <TableCell>{d.label}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.delivered}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="h-64" role="img" aria-label="Deliveries per day">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={r.days} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--viz-axis)" }} minTickGap={16} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--viz-axis)" }} />
                    <Tooltip content={<Tip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.6 }} />
                    <Bar dataKey="delivered" name="Delivered" fill="var(--series-1)" maxBarSize={24} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <div className="grid lg:grid-cols-2 gap-4">
            <section className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold mb-3">Why deliveries were missed</h2>
              {r.reasons.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No failed attempts in this period.</p>
              ) : (
                <div style={{ height: Math.max(120, r.reasons.length * 40) }} role="img" aria-label="Failed attempts by reason">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={r.reasons} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }}>
                      <XAxis type="number" hide allowDecimals={false} />
                      <YAxis type="category" dataKey="reason" width={170} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--viz-axis)" }} />
                      <Tooltip content={<Tip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.6 }} />
                      <Bar dataKey="count" name="Missed" fill="var(--series-1)" maxBarSize={20} radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="count" position="right" style={{ fontSize: 12, fill: "hsl(var(--foreground))" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
            <section className="rounded-xl border bg-card">
              <h2 className="text-sm font-semibold px-4 pt-4 pb-2">By service</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead className="text-right">Booked</TableHead>
                    <TableHead className="text-right">On time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.byService.map((x) => (
                    <TableRow key={x.lvl}>
                      <TableCell>{SERVICE_LEVELS[x.lvl]}</TableCell>
                      <TableCell className="text-right tabular-nums">{x.booked}</TableCell>
                      <TableCell className="text-right tabular-nums">{x.onTime == null ? "—" : `${x.onTime}%`}</TableCell>
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

export default PortalReports;

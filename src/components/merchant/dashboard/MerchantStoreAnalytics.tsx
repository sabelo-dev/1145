import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Info, Loader2, Minus, PackageX, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { fetchStoreAnalytics, isNotInstalled, type StoreAnalytics } from "@/services/merchantAi";

/*
 * Dashboard-home analytics for the merchant's whole business (all stores).
 * Chart rules followed (dataviz method):
 *  - one measure per chart, never two y-axes (sales and orders are separate charts);
 *  - single-series charts use one validated colour (--viz-series-1) and no legend;
 *  - the only two-colour mark (new vs returning) is labelled directly;
 *  - status colours (--viz-good/warning/critical) only for stock state, with icon + label;
 *  - text stays in text colours; every chart has a hover tooltip; the trend has a table view.
 */

type Days = 7 | 30 | 90 | 365;
const PERIODS: Array<{ days: Days; label: string; compare: string }> = [
  { days: 7, label: "7 days", compare: "previous 7 days" },
  { days: 30, label: "30 days", compare: "previous 30 days" },
  { days: 90, label: "90 days", compare: "previous 90 days" },
  { days: 365, label: "12 months", compare: "previous 12 months" },
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STEP_LABELS: Record<string, string> = {
  pending: "New", accepted: "Accepted", preparing: "Preparing", ready: "Ready",
  shipped: "Dispatched", out_for_delivery: "Out for delivery",
};

const rand = (minor: number, compact = false) => {
  const value = minor / 100;
  if (compact && Math.abs(value) >= 1000) {
    return `R${new Intl.NumberFormat("en-ZA", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;
  }
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: compact ? 0 : 2 }).format(value);
};
const count = (n: number) => new Intl.NumberFormat("en-ZA").format(n);

const axisProps = {
  tick: { fill: "var(--viz-axis)", fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: "var(--viz-grid)" },
} as const;

/** Tooltip box in text colours; the swatch beside the value carries identity. */
const TooltipBox: React.FC<{ title: string; rows: Array<{ label: string; value: string; color?: string }> }> = ({ title, rows }) => (
  <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
    <p className="mb-1 font-medium text-foreground">{title}</p>
    {rows.map((r) => (
      <p key={r.label} className="flex items-center gap-2 text-muted-foreground">
        {r.color && <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />}
        {r.label}: <span className="font-medium text-foreground">{r.value}</span>
      </p>
    ))}
  </div>
);

const Delta: React.FC<{ current: number; previous: number; compare: string; invert?: boolean }> = ({ current, previous, compare, invert }) => {
  if (previous === 0) {
    return <p className="text-xs text-muted-foreground">{current === 0 ? "No activity yet" : `New this period (none in ${compare})`}</p>;
  }
  const change = (current - previous) / previous;
  const Icon = change > 0.0005 ? ArrowUpRight : change < -0.0005 ? ArrowDownRight : Minus;
  const better = invert ? change < 0 : change > 0;
  return (
    <p className="flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className={`h-3.5 w-3.5 ${Math.abs(change) < 0.0005 ? "" : better ? "text-[color:var(--viz-good)]" : "text-[color:var(--viz-critical)]"}`} aria-hidden />
      <span className="font-medium text-foreground">{change > 0 ? "+" : ""}{(change * 100).toFixed(Math.abs(change) < 0.1 ? 1 : 0)}%</span>
      vs {compare}
    </p>
  );
};

const KpiTile: React.FC<{ label: string; value: string; children?: React.ReactNode }> = ({ label, value, children }) => (
  <Card>
    <CardContent className="space-y-1 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {children}
    </CardContent>
  </Card>
);

/** Horizontal single-colour bars with the value at the end of each bar. */
const RankedBars: React.FC<{ data: Array<{ name: string; value: number; detail: string }>; empty: string }> = ({ data, empty }) => {
  if (data.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * 40, 120)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 72, bottom: 0, left: 0 }} barCategoryGap={8}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={140} {...axisProps} axisLine={false}
          tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)} />
        <Tooltip cursor={{ fill: "var(--viz-grid)", opacity: 0.4 }}
          content={({ active, payload }) => active && payload?.[0]
            ? <TooltipBox title={String(payload[0].payload.name)} rows={[{ label: "Sales", value: rand(Number(payload[0].payload.value)) }, { label: "Sold", value: String(payload[0].payload.detail) }]} />
            : null} />
        <Bar dataKey="value" fill="var(--viz-series-1)" radius={[0, 4, 4, 0]} maxBarSize={22}>
          <LabelList dataKey="value" position="right" formatter={(v: number) => rand(v, true)} className="fill-foreground text-xs" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

const MerchantStoreAnalytics: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const [days, setDays] = useState<Days>(30);
  const [showTable, setShowTable] = useState(false);
  const analytics = useQuery({
    queryKey: ["merchant-store-analytics", days],
    queryFn: () => fetchStoreAnalytics(days),
    retry: (n, error) => !isNotInstalled(error) && n < 2,
    staleTime: 60_000,
  });
  const period = PERIODS.find((p) => p.days === days)!;
  const data = analytics.data;

  const daily = useMemo(() => (data?.daily ?? []).map((d) => ({
    ...d,
    label: format(parseISO(d.date), days > 90 ? "d MMM yy" : "d MMM"),
  })), [data, days]);

  if (analytics.error) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          {isNotInstalled(analytics.error)
            ? "Store analytics will appear here once the latest 1145 update is installed."
            : `Store analytics could not load: ${(analytics.error as Error).message}`}
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="store-analytics-title">
      {/* Filters in one row above the charts */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="store-analytics-title" className="text-xl font-semibold">Store analytics</h2>
          <p className="text-sm text-muted-foreground">
            All your stores · {data ? `${format(parseISO(data.period.from), "d MMM yyyy")} – ${format(parseISO(data.period.to), "d MMM yyyy")}` : "…"} · South Africa time
          </p>
        </div>
        <ToggleGroup type="single" value={String(days)} onValueChange={(v) => v && setDays(Number(v) as Days)}
          className="rounded-md border p-1" aria-label="Period">
          {PERIODS.map((p) => (
            <ToggleGroupItem key={p.days} value={String(p.days)} className="h-8 px-3 text-sm">{p.label}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {!data ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* KPI tiles: the headline numbers, each against the previous period */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiTile label="Gross sales" value={rand(data.kpis.gross_sales_minor.current)}>
              <Delta {...data.kpis.gross_sales_minor} compare={period.compare} />
            </KpiTile>
            <KpiTile label="Orders" value={count(data.kpis.orders.current)}>
              <Delta {...data.kpis.orders} compare={period.compare} />
            </KpiTile>
            <KpiTile label="Average order" value={rand(data.kpis.average_order_minor.current)}>
              <Delta {...data.kpis.average_order_minor} compare={period.compare} />
            </KpiTile>
            <KpiTile label="Units sold" value={count(data.kpis.units.current)}>
              <Delta {...data.kpis.units} compare={period.compare} />
            </KpiTile>
            <KpiTile label="Customers" value={count(data.kpis.customers.current)}>
              <Delta current={data.kpis.customers.current} previous={data.kpis.customers.previous} compare={period.compare} />
            </KpiTile>
            <KpiTile label="1145 Pay collected" value={rand(data.kpis.pay_collected_minor.current)}>
              <Delta {...data.kpis.pay_collected_minor} compare={period.compare} />
            </KpiTile>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {/* Sales trend */}
            <Card className="xl:col-span-2">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base">Gross sales per day</CardTitle>
                  <CardDescription>Before VAT, excluding shipping, cancelled and refunded orders</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowTable((s) => !s)}>
                  {showTable ? "View as chart" : "View as table"}
                </Button>
              </CardHeader>
              <CardContent>
                {showTable ? (
                  <div className="max-h-72 overflow-y-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Orders</TableHead><TableHead className="text-right">Gross sales</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {[...daily].reverse().map((d) => (
                          <TableRow key={d.date}>
                            <TableCell>{format(parseISO(d.date), "EEE d MMM yyyy")}</TableCell>
                            <TableCell className="text-right">{d.orders}</TableCell>
                            <TableCell className="text-right">{rand(d.gross_minor)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--viz-series-1)" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="var(--viz-series-1)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
                      <XAxis dataKey="label" {...axisProps} minTickGap={24} />
                      <YAxis {...axisProps} axisLine={false} width={64} tickFormatter={(v: number) => rand(v, true)} />
                      <Tooltip cursor={{ stroke: "var(--viz-axis)", strokeDasharray: "3 3" }}
                        content={({ active, payload }) => active && payload?.[0]
                          ? <TooltipBox title={format(parseISO(String(payload[0].payload.date)), "EEEE d MMM yyyy")}
                              rows={[{ label: "Gross sales", value: rand(Number(payload[0].payload.gross_minor)), color: "var(--viz-series-1)" },
                                { label: "Orders", value: String(payload[0].payload.orders) }]} />
                          : null} />
                      <Area type="monotone" dataKey="gross_minor" stroke="var(--viz-series-1)" strokeWidth={2} fill="url(#sales-fill)"
                        activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Customers: new vs returning, labelled directly */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Customers</CardTitle>
                <CardDescription>People who bought in this period</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.kpis.customers.current === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No customers in this period yet.</p>
                ) : (
                  <>
                    <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded" role="img"
                      aria-label={`${data.kpis.customers.new} new and ${data.kpis.customers.returning} returning customers`}>
                      {data.kpis.customers.new > 0 && (
                        <div className="h-full rounded-l bg-[color:var(--viz-series-1)]" style={{ flexGrow: data.kpis.customers.new }} />
                      )}
                      {data.kpis.customers.returning > 0 && (
                        <div className="h-full rounded-r bg-[color:var(--viz-series-2)]" style={{ flexGrow: data.kpis.customers.returning }} />
                      )}
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-sm bg-[color:var(--viz-series-1)]" />New</dt>
                        <dd className="text-xl font-semibold">{count(data.kpis.customers.new)}</dd>
                      </div>
                      <div>
                        <dt className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-sm bg-[color:var(--viz-series-2)]" />Returning</dt>
                        <dd className="text-xl font-semibold">{count(data.kpis.customers.returning)}</dd>
                      </div>
                    </dl>
                  </>
                )}
                <div className="space-y-1 border-t pt-3 text-sm">
                  <p className="flex justify-between"><span className="text-muted-foreground">Refund / return rate</span>
                    <span className="font-medium">{(data.kpis.refund_rate.current * 100).toFixed(1)}%</span></p>
                  <p className="flex justify-between"><span className="flex items-center gap-1 text-muted-foreground"><Star className="h-3.5 w-3.5" aria-hidden /> Rating</span>
                    <span className="font-medium">{data.stock.rating ? `${data.stock.rating.toFixed(1)} (${count(data.stock.reviews)} reviews)` : "No reviews yet"}</span></p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Orders per day: its own chart, so there is never a second y-axis */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Orders per day</CardTitle>
                <CardDescription>Paid orders, excluding cancelled and refunded</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={days > 30 ? 1 : 4}>
                    <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
                    <XAxis dataKey="label" {...axisProps} minTickGap={24} />
                    <YAxis {...axisProps} axisLine={false} width={32} allowDecimals={false} />
                    <Tooltip cursor={{ fill: "var(--viz-grid)", opacity: 0.4 }}
                      content={({ active, payload }) => active && payload?.[0]
                        ? <TooltipBox title={format(parseISO(String(payload[0].payload.date)), "EEEE d MMM yyyy")}
                            rows={[{ label: "Orders", value: String(payload[0].payload.orders), color: "var(--viz-series-1)" }]} />
                        : null} />
                    <Bar dataKey="orders" fill="var(--viz-series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Weekday pattern */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Sales by weekday</CardTitle>
                <CardDescription>Which days bring in the most</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.by_weekday.map((w) => ({ ...w, day: WEEKDAYS[w.weekday - 1] }))} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
                    <XAxis dataKey="day" {...axisProps} />
                    <YAxis {...axisProps} axisLine={false} width={64} tickFormatter={(v: number) => rand(v, true)} />
                    <Tooltip cursor={{ fill: "var(--viz-grid)", opacity: 0.4 }}
                      content={({ active, payload }) => active && payload?.[0]
                        ? <TooltipBox title={String(payload[0].payload.day)}
                            rows={[{ label: "Gross sales", value: rand(Number(payload[0].payload.gross_minor)), color: "var(--viz-series-1)" },
                              { label: "Orders", value: String(payload[0].payload.orders) }]} />
                        : null} />
                    <Bar dataKey="gross_minor" fill="var(--viz-series-1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top products</CardTitle>
                <CardDescription>By gross sales in this period</CardDescription>
              </CardHeader>
              <CardContent>
                <RankedBars empty="No product sales in this period yet."
                  data={data.top_products.map((p) => ({ name: p.name, value: p.gross_minor, detail: `${count(p.units)} units` }))} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Sales by category</CardTitle>
                <CardDescription>Gross sales per product category</CardDescription>
              </CardHeader>
              <CardContent>
                <RankedBars empty="No category sales in this period yet."
                  data={data.by_category.map((c) => ({ name: c.category, value: c.gross_minor, detail: `${count(c.units)} units` }))} />
              </CardContent>
            </Card>

            {/* Fulfilment pipeline right now */}
            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base">Orders in progress</CardTitle>
                  <CardDescription>Paid orders by fulfilment step, right now</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => onNavigate("orders")}>Open orders</Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.keys(STEP_LABELS).every((s) => !data.fulfilment[s]) ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No orders in progress.</p>
                ) : (() => {
                  const max = Math.max(...Object.keys(STEP_LABELS).map((s) => data.fulfilment[s] ?? 0), 1);
                  return Object.entries(STEP_LABELS).map(([step, label]) => {
                    const n = data.fulfilment[step] ?? 0;
                    return (
                      <div key={step} className="grid grid-cols-[110px_1fr_40px] items-center gap-3 text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <div className="h-3 rounded bg-muted">
                          {n > 0 && <div className="h-3 rounded bg-[color:var(--viz-series-1)]" style={{ width: `${(n / max) * 100}%` }} />}
                        </div>
                        <span className="text-right font-medium">{n}</span>
                      </div>
                    );
                  });
                })()}
              </CardContent>
            </Card>

            {/* Stock health: status colours, always with icon and label */}
            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base">Stock health</CardTitle>
                  <CardDescription>{count(data.stock.listed)} listed products{data.stock.pending_approval ? ` · ${data.stock.pending_approval} awaiting approval` : ""}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => onNavigate("inventory")}>Manage stock</Button>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-3">
                {[
                  { label: "In stock", n: data.stock.in_stock, Icon: CheckCircle2, color: "var(--viz-good)", note: "more than 5" },
                  { label: "Low stock", n: data.stock.low_stock, Icon: AlertTriangle, color: "var(--viz-warning)", note: "5 or fewer" },
                  { label: "Out of stock", n: data.stock.out_of_stock, Icon: PackageX, color: "var(--viz-critical)", note: "can't be bought" },
                ].map(({ label, n, Icon, color, note }) => (
                  <div key={label} className="rounded-lg border p-3">
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Icon className="h-4 w-4" style={{ color }} aria-hidden /> {label}
                    </p>
                    <p className="text-2xl font-semibold">{count(n)}</p>
                    <p className="text-xs text-muted-foreground">{note}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground">
            {data.definition} Updated {format(parseISO(data.as_of), "d MMM yyyy, HH:mm")}.
          </p>
        </>
      )}
    </section>
  );
};

export default MerchantStoreAnalytics;

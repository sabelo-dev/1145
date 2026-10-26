import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";

/** Rows of the growth_funnel_daily view (see migration 20261026130000_growth_events). */
interface FunnelRow { day: string; event: string; events: number; sessions: number }
interface EventRow { event: string; area: string | null; props: Record<string, unknown> | null; session_id: string; created_at: string }

const FUNNEL: { event: string; label: string }[] = [
  { event: "home_impression", label: "Homepage visits" },
  { event: "product_view", label: "Product views" },
  { event: "add_to_cart", label: "Added to cart" },
  { event: "checkout_start", label: "Started checkout" },
  { event: "purchase", label: "Purchases" },
];

const GROWTH: { event: string; label: string }[] = [
  { event: "download_click", label: "App download clicks" },
  { event: "merchant_apply_click", label: "Merchant CTA clicks" },
  { event: "merchant_application", label: "Merchant applications" },
  { event: "campaign_click", label: "Campaign clicks" },
  { event: "referral_click", label: "Referral clicks" },
  { event: "creator_click", label: "Creator clicks" },
];

const RANGES = [7, 30, 90] as const;
const RAW_LIMIT = 5000;

// Tables newer than the generated types, hence the loose client.
const db = supabase as unknown as {
  from: (t: string) => {
    select: (c: string) => {
      gte: (col: string, v: string) => {
        order: (col: string, o: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: unknown[] | null; error: { code?: string; message: string } | null }>;
        };
      };
    };
  };
};

const nf = new Intl.NumberFormat("en-ZA");
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");

/** Counts a string prop across raw events, highest first. */
const breakdown = (rows: EventRow[], event: string, key: (r: EventRow) => string | null | undefined) => {
  const counts = new Map<string, number>();
  rows.filter((r) => r.event === event).forEach((r) => {
    const k = key(r) || "Unknown";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
};

const BreakdownTable: React.FC<{ title: string; rows: [string, number][]; empty: string }> = ({ title, rows, empty }) => (
  <Card>
    <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
    <CardContent>
      {rows.length ? (
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-b border-border last:border-0">
                <td className="py-2 capitalize text-foreground">{k.replace(/_/g, " ")}</td>
                <td className="py-2 text-right font-semibold tabular-nums text-foreground">{nf.format(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="text-sm text-text-secondary">{empty}</p>}
    </CardContent>
  </Card>
);

/**
 * The 1145 Growth Command Centre: homepage-to-purchase funnel, acquisition
 * clicks and where they come from. Reads growth_events (admins only).
 */
const AdminGrowth: React.FC = () => {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [daily, setDaily] = useState<FunnelRow[] | null>(null);
  const [raw, setRaw] = useState<EventRow[]>([]);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    setDaily(null);
    const since = subDays(new Date(), days).toISOString();
    const [view, events] = await Promise.all([
      db.from("growth_funnel_daily").select("day, event, events, sessions").gte("day", since.slice(0, 10)).order("day", { ascending: true }).limit(5000),
      db.from("growth_events").select("event, area, props, session_id, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(RAW_LIMIT),
    ]);
    const err = view.error ?? events.error;
    if (err && /growth_|42P01|PGRST205/.test(`${err.code} ${err.message}`)) { setMissing(true); setDaily([]); return; }
    setMissing(false);
    setDaily(((view.data ?? []) as FunnelRow[]).map((r) => ({ ...r, events: Number(r.events), sessions: Number(r.sessions) })));
    setRaw((events.data ?? []) as EventRow[]);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => {
    const t: Record<string, { events: number; sessions: number }> = {};
    (daily ?? []).forEach((r) => {
      t[r.event] ??= { events: 0, sessions: 0 };
      t[r.event].events += r.events;
      t[r.event].sessions += r.sessions;
    });
    return t;
  }, [daily]);

  const trend = useMemo(() => {
    const byDay = new Map<string, number>();
    (daily ?? []).filter((r) => r.event === "home_impression").forEach((r) => byDay.set(r.day, r.sessions));
    return Array.from({ length: days }, (_, i) => {
      const d = format(subDays(new Date(), days - 1 - i), "yyyy-MM-dd");
      return { day: d, label: format(new Date(d), "d MMM"), visits: byDay.get(d) ?? 0 };
    });
  }, [daily, days]);

  const sessionsOf = (e: string) => totals[e]?.sessions ?? 0;
  const funnelTop = Math.max(1, sessionsOf("home_impression"), ...FUNNEL.map((f) => sessionsOf(f.event)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Growth Command Centre</h2>
          <p className="text-sm text-text-secondary">Website funnel and acquisition, from the homepage to purchase.</p>
        </div>
        <div role="group" aria-label="Date range" className="inline-flex rounded-xl bg-surface-input p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={days === r}
              onClick={() => setDays(r)}
              className={cn("h-9 rounded-lg px-3 text-sm font-medium", days === r ? "bg-card text-foreground shadow-soft" : "text-text-secondary")}
            >
              {r} days
            </button>
          ))}
        </div>
      </div>

      {missing && (
        <Card><CardContent className="p-6 text-sm text-text-secondary">
          No growth data yet: apply the <code>20261026130000_growth_events</code> migration to start recording events.
        </CardContent></Card>
      )}

      {!daily ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : (
        <>
          {/* Headline numbers */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Homepage visits", value: nf.format(sessionsOf("home_impression")), note: "unique sessions" },
              { label: "Visit → purchase", value: pct(sessionsOf("purchase"), sessionsOf("home_impression")), note: `${nf.format(sessionsOf("purchase"))} purchasing sessions` },
              { label: "App download clicks", value: nf.format(totals.download_click?.events ?? 0), note: `${pct(sessionsOf("download_click"), sessionsOf("home_impression"))} of visits` },
              { label: "Merchant applications", value: nf.format(totals.merchant_application?.events ?? 0), note: `${nf.format(totals.merchant_apply_click?.events ?? 0)} CTA clicks` },
            ].map((s) => (
              <Card key={s.label}><CardContent className="p-5">
                <p className="text-sm text-text-secondary">{s.label}</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{s.value}</p>
                <p className="mt-1 text-xs text-text-secondary">{s.note}</p>
              </CardContent></Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Funnel: one hue, bar length = sessions reaching the step */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Shopping funnel (sessions)</CardTitle></CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {FUNNEL.map((f, i) => {
                    const v = sessionsOf(f.event);
                    const prev = i ? sessionsOf(FUNNEL[i - 1].event) : null;
                    return (
                      <li key={f.event} title={`${f.label}: ${nf.format(v)} sessions`}>
                        <div className="mb-1 flex justify-between gap-2 text-sm">
                          <span className="text-foreground">{f.label}</span>
                          <span className="tabular-nums text-text-secondary">
                            <span className="font-semibold text-foreground">{nf.format(v)}</span>
                            {prev != null && <> · {pct(v, prev)} of previous</>}
                          </span>
                        </div>
                        <div className="h-3 rounded-r bg-surface-input">
                          <div className="h-3 rounded-r bg-brand" style={{ width: `${(v / funnelTop) * 100}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>

            {/* Daily homepage visits: single series, so the title names it and no legend is needed */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Homepage visits per day</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--text-secondary))" }} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--text-secondary))" }} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ stroke: "hsl(var(--text-muted))", strokeDasharray: "3 3" }}
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, color: "hsl(var(--foreground))" }}
                      formatter={(v: number) => [nf.format(v), "Visits"]}
                    />
                    <Line type="monotone" dataKey="visits" stroke="hsl(var(--brand))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Acquisition counts */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Acquisition actions</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-text-secondary"><th className="py-2 font-medium">Action</th><th className="py-2 text-right font-medium">Clicks</th><th className="py-2 text-right font-medium">Sessions</th></tr></thead>
                <tbody>
                  {GROWTH.map((g) => (
                    <tr key={g.event} className="border-t border-border">
                      <td className="py-2 text-foreground">{g.label}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{nf.format(totals[g.event]?.events ?? 0)}</td>
                      <td className="py-2 text-right tabular-nums text-text-secondary">{nf.format(sessionsOf(g.event))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <BreakdownTable title="Download clicks by placement" rows={breakdown(raw, "download_click", (r) => r.props?.placement as string)} empty="No download clicks yet." />
            <BreakdownTable title="Category clicks" rows={breakdown(raw, "category_click", (r) => r.props?.category as string)} empty="No category clicks yet." />
            <BreakdownTable title="Visitors by delivery area" rows={breakdown(raw, "area_selected", (r) => r.area)} empty="No areas chosen yet." />
          </div>
          {raw.length >= RAW_LIMIT && <p className="text-xs text-text-secondary">Breakdowns use the latest {nf.format(RAW_LIMIT)} events in the range.</p>}
        </>
      )}
    </div>
  );
};

export default AdminGrowth;

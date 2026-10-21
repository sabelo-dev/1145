import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMinor } from "@/services/serviceMarketplace";
import { fetchPilotMetrics } from "@/services/merchantAi";

const pct = (rate: number | null) => (rate == null ? "–" : `${Math.round(rate * 100)}%`);

const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-md border p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-xl font-semibold">{value}</p>
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

/** Pilot measurement for one cohort over a period (admin_merchant_ai_pilot_metrics). */
const MerchantAIPilotMetrics: React.FC<{ cohort: string }> = ({ cohort }) => {
  const [from, setFrom] = useState(() => format(subDays(new Date(), 27), "yyyy-MM-dd"));
  const [to, setTo] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const metrics = useQuery({
    queryKey: ["admin-merchant-ai-pilot", cohort, from, to],
    queryFn: () => fetchPilotMetrics(cohort.trim() || null, from, to),
  });
  const m = metrics.data;
  const exceptions = m ? Object.values(m.reconciliation_exceptions).reduce((a, b) => a + b, 0) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pilot measurement</CardTitle>
        <CardDescription>
          Cohort "{cohort.trim() || "all"}", South Africa dates. A merchant is active on a day when its stores moved an
          order in the console, created a 1145 Pay request or asked 1145 AI.
        </CardDescription>
        <div className="flex flex-wrap gap-2 pt-2">
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-44" aria-label="From" />
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-44" aria-label="To" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {metrics.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
        {metrics.error && <p className="text-sm text-destructive">{(metrics.error as Error).message}</p>}
        {m && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Active merchants" value={`${m.active_merchants} / ${m.merchants_in_cohort}`}
                hint={`${m.staff_members} staff accounts`} />
              <Stat label="Weekly active (latest week)"
                value={m.weekly_active_merchants[m.weekly_active_merchants.length - 1]?.merchants ?? 0}
                hint={m.weekly_active_merchants.map((w) => w.merchants).join(" · ") || "No activity"} />
              <Stat label="Orders accepted in console" value={m.orders_accepted_in_console}
                hint={`median ${m.median_minutes_to_accept ?? "–"} min to accept · ${m.orders_dispatched_in_console} dispatched`} />
              <Stat label="1145 Pay requests paid" value={`${m.payment_links_paid} / ${m.payment_links_created}`}
                hint={`${pct(m.payment_link_completion_rate)} · ${formatMinor(m.payment_links_paid_minor)}`} />
              <Stat label="Reconciliation exceptions" value={exceptions}
                hint={exceptions ? Object.entries(m.reconciliation_exceptions).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(", ") : "None"} />
              <Stat label="Paid after cancelling (refund due)" value={m.payment_links_refund_due} />
              <Stat label="AI questions" value={m.ai_questions}
                hint={`${m.ai_input_tokens.toLocaleString()} in / ${m.ai_output_tokens.toLocaleString()} out tokens · ${m.ai_tool_errors} tool errors`} />
              <Stat label="AI drafts approved" value={pct(m.ai_drafts.approval_rate)}
                hint={`${m.ai_drafts.approved} approved, ${m.ai_drafts.rejected} rejected, ${m.ai_drafts.created} created`} />
            </div>

            {m.merchants.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Last active</TableHead>
                    <TableHead className="text-right">Active days</TableHead>
                    <TableHead className="text-right">Orders accepted</TableHead>
                    <TableHead className="text-right">Links paid</TableHead>
                    <TableHead className="text-right">AI questions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.merchants.map((row) => (
                    <TableRow key={row.merchant_id} className={row.active_days === 0 ? "text-muted-foreground" : undefined}>
                      <TableCell>{row.business_name}</TableCell>
                      <TableCell>{row.last_active ? format(new Date(row.last_active), "d MMM") : "Not yet"}</TableCell>
                      <TableCell className="text-right">{row.active_days}</TableCell>
                      <TableCell className="text-right">{row.orders_accepted}</TableCell>
                      <TableCell className="text-right">{row.payment_links_paid}</TableCell>
                      <TableCell className="text-right">{row.ai_questions}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MerchantAIPilotMetrics;

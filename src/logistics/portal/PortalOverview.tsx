import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { startOfMonth } from "date-fns";
import { db, isLate, OPEN_SHIPMENT_STATUSES, type Shipment } from "../lib/db";
import { PageHeader, ShipmentStatusBadge, StatCard } from "../components/common";
import { Button } from "@/components/ui/button";
import { usePortal } from "./PortalApp";

const rands = (n: number) => `R ${Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PortalOverview: React.FC = () => {
  const { account, isAdmin } = usePortal();
  const monthStart = useMemo(() => startOfMonth(new Date()).toISOString(), []);

  const { data: shipments = [] } = useQuery({
    queryKey: ["portal", account.id, "overview"],
    queryFn: async () => {
      const [open, month] = await Promise.all([
        db.from("shipments").select("*").eq("account_id", account.id).in("status", OPEN_SHIPMENT_STATUSES).limit(1000),
        db.from("shipments").select("*").eq("account_id", account.id).gte("created_at", monthStart).limit(5000),
      ]);
      const byId = new Map<string, Shipment>();
      [...(open.data ?? []), ...(month.data ?? [])].forEach((s) => byId.set(s.id, s as Shipment));
      return [...byId.values()];
    },
    refetchInterval: 60_000,
  });
  const { data: standing } = useQuery({
    queryKey: ["portal", account.id, "standing"],
    enabled: isAdmin,
    queryFn: async () => (await db.rpc("logistics_account_standing", { p_account_id: account.id })).data as {
      credit_limit: number;
      invoiced_unpaid: number;
      overdue: number;
      unbilled: number;
    } | null,
  });

  const open = shipments.filter((s) => OPEN_SHIPMENT_STATUSES.includes(s.status));
  const month = shipments.filter((s) => s.created_at >= monthStart);
  const delivered = month.filter((s) => s.status === "delivered");
  const onTime = delivered.filter((s) => s.promised_by && !isLate(s));
  const withPromise = delivered.filter((s) => s.promised_by);
  const attention = open.filter((s) => ["failed_attempt", "exception", "returning"].includes(s.status) || isLate(s) || (s.requires_approval && !s.approved_at));

  return (
    <div className="space-y-4">
      <PageHeader
        title={account.name}
        description="Your deliveries at a glance."
        actions={
          <Button asChild>
            <Link to="/portal/book">Book a delivery</Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="In transit" value={open.length} />
        <StatCard label="Booked this month" value={month.length} />
        <StatCard label="Delivered this month" value={delivered.length} tone="good" />
        <StatCard label="On time" value={withPromise.length ? `${Math.round((onTime.length / withPromise.length) * 100)}%` : "—"} />
      </div>
      {isAdmin && standing && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Spend this month (unbilled)" value={rands(standing.unbilled)} />
          <StatCard label="Invoices outstanding" value={rands(standing.invoiced_unpaid)} />
          <StatCard label="Overdue" value={rands(standing.overdue)} tone={Number(standing.overdue) > 0 ? "danger" : "default"} />
          <StatCard
            label="Credit available"
            value={rands(Math.max(0, Number(standing.credit_limit) - Number(standing.invoiced_unpaid) - Number(standing.unbilled)))}
            hint={`of ${rands(standing.credit_limit)}`}
          />
        </div>
      )}
      <section className="rounded-xl border bg-card">
        <div className="px-4 py-3 border-b text-sm font-semibold">Needs your attention</div>
        {attention.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">All good. Nothing stuck or late.</p>
        ) : (
          <ul className="divide-y">
            {attention.slice(0, 10).map((s) => (
              <li key={s.id}>
                <Link to={`/portal/shipments?q=${s.tracking_number}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                  <span className="font-mono text-xs">{s.tracking_number}</span>
                  <span className="text-sm truncate flex-1">
                    {s.recipient_name}
                    {s.reference ? ` · ${s.reference}` : ""}
                    {s.last_failure_reason ? ` · ${s.last_failure_reason}` : ""}
                    {s.requires_approval && !s.approved_at ? " · awaiting high-value review" : ""}
                  </span>
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

export default PortalOverview;

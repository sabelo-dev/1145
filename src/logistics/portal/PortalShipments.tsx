import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, Package, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { db, formatAddress, SERVICE_LEVELS, SHIPMENT_STATUS, type Shipment, type ShipmentEvent } from "../lib/db";
import { printLabels } from "../lib/labels";
import { EmptyState, PageHeader, ShipmentStatusBadge, Spinner } from "../components/common";
import { usePortal } from "./PortalApp";
import PodPanel from "../components/PodPanel";

const PortalShipments: React.FC = () => {
  const { account } = usePortal();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [active, setActive] = useState<Shipment | null>(null);
  const term = (params.get("q") ?? "").trim();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["portal", account.id, "shipments", term],
    queryFn: async () => {
      let query = db.from("shipments").select("*").eq("account_id", account.id).order("created_at", { ascending: false }).limit(300);
      if (term) {
        const like = `%${term.replace(/[%,()]/g, "")}%`;
        query = query.or(`tracking_number.ilike.${like},recipient_name.ilike.${like},reference.ilike.${like}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Shipment[];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["portal", "events", active?.id],
    enabled: !!active,
    queryFn: async () => {
      const { data } = await db.from("shipment_events").select("*").eq("shipment_id", active!.id).neq("event_type", "note").order("created_at", { ascending: false });
      return (data ?? []) as ShipmentEvent[];
    },
  });

  const exportCsv = () => {
    const cols = ["tracking_number", "reference", "status", "service_level", "recipient_name", "created_at", "promised_by", "delivered_at", "shipping_fee"];
    const cell = (v: unknown) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => cell((r as unknown as Record<string, unknown>)[c])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${account.name.replace(/\W+/g, "-")}-shipments.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const act = async (kind: "cancel" | "return") => {
    if (!active) return;
    let error;
    let data: { ok?: boolean; error?: string; tracking_number?: string } | null = null;
    if (kind === "cancel") {
      if (!window.confirm(`Cancel ${active.tracking_number}?`)) return;
      ({ error } = await db.rpc("portal_cancel_shipment", { p_shipment_id: active.id }));
    } else {
      const reason = window.prompt("Reason for the return");
      if (!reason?.trim()) return;
      ({ data, error } = await db.rpc("portal_request_return", { p_shipment_id: active.id, p_reason: reason.trim() }));
    }
    if (error || (data && !data.ok)) {
      toast({ variant: "destructive", title: "Not done", description: (data?.error ?? error?.message ?? "").replace(/_/g, " ") });
      return;
    }
    toast({ title: kind === "cancel" ? "Shipment cancelled" : `Return booked: ${data?.tracking_number}` });
    setActive(null);
    qc.invalidateQueries({ queryKey: ["portal", account.id] });
  };

  return (
    <div>
      <PageHeader
        title="Shipments"
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
            <Download className="h-4 w-4 mr-1.5" /> Export CSV
          </Button>
        }
      />
      <form
        className="relative mb-3 sm:w-96"
        onSubmit={(e) => {
          e.preventDefault();
          setParams(q.trim() ? { q: q.trim() } : {});
        }}
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tracking number, recipient or your reference" className="pl-9" />
      </form>
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Package className="h-8 w-8" />} title="No shipments yet" description="Book one, or connect your store through the API." />
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tracking</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead className="hidden md:table-cell">Service</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell text-right">Fee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => setActive(s)}>
                  <TableCell className="font-mono text-xs">
                    {s.tracking_number}
                    {s.reference && <div className="font-sans text-muted-foreground">{s.reference}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{s.recipient_name}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{SERVICE_LEVELS[s.service_level]}</TableCell>
                  <TableCell>
                    <ShipmentStatusBadge status={s.status} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums text-sm">{s.shipping_fee != null ? `R ${Number(s.shipping_fee).toFixed(2)}` : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono">{active.tracking_number}</SheetTitle>
              </SheetHeader>
              <div className="mt-3 flex items-center gap-2">
                <ShipmentStatusBadge status={active.status} />
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => printLabels([active])}>
                  <Printer className="h-4 w-4 mr-1.5" /> Labels
                </Button>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">To</dt>
                  <dd>
                    {active.recipient_name} · {formatAddress(active.delivery_address)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Promised by</dt>
                  <dd>{active.promised_by ? format(new Date(active.promised_by), "EEE d MMM, HH:mm") : "—"}</dd>
                </div>
                {active.require_otp && active.delivery_otp && (
                  <div>
                    <dt className="text-muted-foreground">Recipient handover code</dt>
                    <dd className="font-mono tracking-widest">{active.delivery_otp}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                {["created", "awaiting_pickup", "at_hub"].includes(active.status) && (
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => act("cancel")}>
                    Cancel shipment
                  </Button>
                )}
                {active.status === "delivered" && !active.return_of_shipment_id && (
                  <Button size="sm" variant="outline" onClick={() => act("return")}>
                    Book a return
                  </Button>
                )}
              </div>
              {active.status === "delivered" && (
                <div className="mt-4">
                  <PodPanel shipmentId={active.id} />
                </div>
              )}
              <ol className="mt-6 space-y-3">
                {events.map((e, i) => (
                  <li key={e.id} className="flex gap-3">
                    <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${i === 0 ? "bg-primary" : "bg-muted-foreground/40"}`} />
                    <div>
                      <p className="text-sm font-medium">{SHIPMENT_STATUS[e.status as Shipment["status"]]?.label ?? e.status}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(e.created_at), "d MMM, HH:mm")}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default PortalShipments;

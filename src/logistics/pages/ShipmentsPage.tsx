import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import { FileUp, Package, Plus, Printer, Route as RouteIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  db,
  isLate,
  OPEN_SHIPMENT_STATUSES,
  ROUTABLE_STATUSES,
  SERVICE_LEVELS,
  SHIPMENT_STATUS,
  type Shipment,
  type ShipmentStatus,
} from "../lib/db";
import { useHubs, useRealtimeInvalidate } from "../lib/queries";
import { useLogisticsAuth } from "../auth/LogisticsAuth";
import { EmptyState, PageHeader, ShipmentStatusBadge, Spinner } from "../components/common";
import CreateShipmentDialog from "../components/CreateShipmentDialog";
import ImportShipmentsDialog from "../components/ImportShipmentsDialog";
import ShipmentDetailSheet from "../components/ShipmentDetailSheet";
import CreateRouteDialog from "../components/CreateRouteDialog";
import { printLabels } from "../lib/labels";

const FILTERS: Array<{ value: string; label: string }> = [
  { value: "open", label: "Open" },
  { value: "attention", label: "Needs attention" },
  { value: "routable", label: "Ready to route" },
  { value: "approval", label: "Awaiting approval" },
  { value: "all", label: "All" },
  ...Object.entries(SHIPMENT_STATUS).map(([value, s]) => ({ value, label: s.label })),
];

const PAGE = 500;

const ShipmentsPage: React.FC = () => {
  const { can } = useLogisticsAuth();
  const [params, setParams] = useSearchParams();
  const filter = params.get("status") ?? "open";
  const hubFilter = params.get("hub") ?? "all";
  const [q, setQ] = useState(params.get("q") ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<Shipment | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showRoute, setShowRoute] = useState(false);
  const { data: hubs = [] } = useHubs();

  useEffect(() => setQ(params.get("q") ?? ""), [params]);

  const setParam = (k: string, v: string) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set(k, v);
      return n;
    });

  const term = (params.get("q") ?? "").trim();

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ["lx", "shipments", "list", filter, hubFilter, term],
    queryFn: async () => {
      let query = db.from("shipments").select("*").order("created_at", { ascending: false }).limit(PAGE);
      if (term) {
        const like = `%${term.replace(/[%,()]/g, "")}%`;
        query = query.or(`tracking_number.ilike.${like},recipient_name.ilike.${like},reference.ilike.${like},recipient_phone.ilike.${like}`);
      } else if (filter === "open" || filter === "attention") {
        query = query.in("status", OPEN_SHIPMENT_STATUSES);
      } else if (filter === "routable") {
        query = query.in("status", ROUTABLE_STATUSES).or("requires_approval.eq.false,approved_at.not.is.null");
      } else if (filter === "approval") {
        query = query.eq("requires_approval", true).is("approved_at", null).not("status", "eq", "cancelled");
      } else if (filter !== "all") {
        query = query.eq("status", filter);
      }
      if (hubFilter !== "all") query = query.or(`current_hub_id.eq.${hubFilter},origin_hub_id.eq.${hubFilter}`);
      const { data, error } = await query;
      if (error) throw error;
      let rows = (data ?? []) as Shipment[];
      if (filter === "attention" && !term) {
        rows = rows.filter((s) => isLate(s) || ["exception", "failed_attempt", "returning"].includes(s.status));
      }
      return rows;
    },
  });

  useRealtimeInvalidate("lx-shipments", ["shipments"], [["lx", "shipments"]]);

  // Keep the open sheet in sync with live updates.
  useEffect(() => {
    if (active) {
      const fresh = shipments.find((s) => s.id === active.id);
      if (fresh && fresh.updated_at !== active.updated_at) setActive(fresh);
    }
  }, [shipments, active]);

  // Auto-open a single exact tracking-number match.
  useEffect(() => {
    if (term && shipments.length === 1 && shipments[0].tracking_number === term.toUpperCase()) setActive(shipments[0]);
  }, [term, shipments]);

  const routableSelected = useMemo(
    () => shipments.filter((s) => selected.has(s.id) && ROUTABLE_STATUSES.includes(s.status)).map((s) => s.id),
    [shipments, selected],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = shipments.length > 0 && shipments.every((s) => selected.has(s.id));
  const hubCode = (id: string | null) => hubs.find((h) => h.id === id)?.code;

  return (
    <div>
      <PageHeader
        title="Shipments"
        description="Every parcel in the network."
        actions={
          can("owner", "dispatcher", "hub_operator") && (
            <>
              {can("owner", "dispatcher") && (
                <Button variant="outline" disabled={routableSelected.length === 0} onClick={() => setShowRoute(true)}>
                  <RouteIcon className="h-4 w-4 mr-1.5" /> Plan route{routableSelected.length ? ` (${routableSelected.length})` : ""}
                </Button>
              )}
              <Button
                variant="outline"
                disabled={selected.size === 0}
                onClick={() => printLabels(shipments.filter((s) => selected.has(s.id)))}
              >
                <Printer className="h-4 w-4 mr-1.5" /> Labels{selected.size ? ` (${selected.size})` : ""}
              </Button>
              <Button variant="outline" onClick={() => setShowImport(true)}>
                <FileUp className="h-4 w-4 mr-1.5" /> Import
              </Button>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> New shipment
              </Button>
            </>
          )
        }
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setParam("q", q.trim());
          }}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tracking number, recipient, phone or reference" className="pl-9" />
        </form>
        <Select value={filter} onValueChange={(v) => setParam("status", v)}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={hubFilter} onValueChange={(v) => setParam("hub", v)}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All hubs</SelectItem>
            {hubs.map((h) => (
              <SelectItem key={h.id} value={h.id}>
                {h.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {term && (
        <div className="mb-3 text-sm text-muted-foreground">
          Results for "{term}" ·{" "}
          <button className="text-primary hover:underline" onClick={() => setParam("q", "")}>
            clear
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : shipments.length === 0 ? (
        <EmptyState icon={<Package className="h-8 w-8" />} title="No shipments here" description="Try another filter, or book a new shipment." />
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) => setSelected(v ? new Set(shipments.map((s) => s.id)) : new Set())}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead className="hidden md:table-cell">Destination</TableHead>
                <TableHead className="hidden lg:table-cell">Service</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Promise</TableHead>
                <TableHead className="hidden lg:table-cell">Hub</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => setActive(s)} data-state={selected.has(s.id) ? "selected" : undefined}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} aria-label={`Select ${s.tracking_number}`} />
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {s.tracking_number}
                    {s.reference && <div className="text-muted-foreground font-sans">{s.reference}</div>}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate">{s.recipient_name}</TableCell>
                  <TableCell className="hidden md:table-cell max-w-[220px] truncate text-muted-foreground">
                    {s.delivery_address?.city ?? s.delivery_address?.street}
                    {s.delivery_address?.lat == null && <span className="ml-1 text-amber-600" title="Not geocoded">⚠</span>}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground whitespace-nowrap">{SERVICE_LEVELS[s.service_level]}</TableCell>
                  <TableCell>
                    <ShipmentStatusBadge status={s.status as ShipmentStatus} />
                    {s.requires_approval && !s.approved_at && s.status !== "cancelled" && (
                      <span className="ml-1 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-400">Hold</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell whitespace-nowrap text-xs">
                    {s.promised_by ? (
                      <span className={isLate(s) ? "text-red-600 font-medium" : "text-muted-foreground"}>
                        {s.status === "delivered" ? format(new Date(s.promised_by), "d MMM HH:mm") : formatDistanceToNowStrict(new Date(s.promised_by), { addSuffix: true })}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{hubCode(s.current_hub_id) ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {shipments.length === PAGE && (
            <p className="p-3 text-xs text-muted-foreground border-t">Showing the latest {PAGE}. Narrow the filter or search to find older shipments.</p>
          )}
        </div>
      )}

      <CreateShipmentDialog open={showCreate} onOpenChange={setShowCreate} />
      <ImportShipmentsDialog open={showImport} onOpenChange={setShowImport} />
      <CreateRouteDialog open={showRoute} onOpenChange={setShowRoute} shipmentIds={routableSelected} onCreated={() => setSelected(new Set())} />
      <ShipmentDetailSheet shipment={active} onClose={() => setActive(null)} />
    </div>
  );
};

export default ShipmentsPage;

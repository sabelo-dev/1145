import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Printer, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { db, DELIVERY_WINDOWS, formatAddress, isLate, SERVICE_LEVELS, SHIPMENT_STATUS, type Shipment, type ShipmentEvent, type ShipmentStatus } from "../lib/db";
import { useDrivers, useHubs } from "../lib/queries";
import { useLogisticsAuth } from "../auth/LogisticsAuth";
import { ShipmentStatusBadge } from "./common";
import { printLabels } from "../lib/labels";
import PodPanel from "./PodPanel";

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="col-span-2 break-words">{children}</dd>
  </div>
);

const ShipmentDetailSheet: React.FC<{ shipment: Shipment | null; onClose: () => void }> = ({ shipment, onClose }) => {
  const { can } = useLogisticsAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: hubs = [] } = useHubs();
  const { data: drivers = [] } = useDrivers();
  const [hubId, setHubId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: events = [] } = useQuery({
    queryKey: ["lx", "shipment-events", shipment?.id],
    enabled: !!shipment,
    queryFn: async () => {
      const { data, error } = await db
        .from("shipment_events")
        .select("*")
        .eq("shipment_id", shipment!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ShipmentEvent[];
    },
  });

  if (!shipment) return null;

  const hubName = (id: string | null) => hubs.find((h) => h.id === id)?.name;
  const driverName = (id: string | null) => drivers.find((d) => d.id === id)?.name;

  const update = async (patch: Partial<Shipment>, successMsg: string) => {
    setBusy(true);
    const { error } = await db.from("shipments").update(patch).eq("id", shipment.id);
    if (!error && note.trim()) {
      await db.from("shipment_events").insert({
        shipment_id: shipment.id,
        status: patch.status ?? shipment.status,
        event_type: "note",
        notes: note.trim(),
        hub_id: patch.current_hub_id ?? shipment.current_hub_id,
      });
    }
    setBusy(false);
    if (error) {
      toast({ variant: "destructive", title: "Update failed", description: error.message });
      return;
    }
    toast({ title: successMsg });
    setNote("");
    qc.invalidateQueries({ queryKey: ["lx", "shipments"] });
    qc.invalidateQueries({ queryKey: ["lx", "shipment-events", shipment.id] });
    onClose();
  };

  const closed: ShipmentStatus[] = ["delivered", "returned", "cancelled"];
  const isClosed = closed.includes(shipment.status);
  const canOperate = can("owner", "dispatcher", "hub_operator");
  const canDispatch = can("owner", "dispatcher");

  return (
    <Sheet open={!!shipment} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono">{shipment.tracking_number}</SheetTitle>
        </SheetHeader>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <ShipmentStatusBadge status={shipment.status} />
          {isLate(shipment) ? (
            <span className="text-xs font-medium text-red-600">Past promise</span>
          ) : (
            shipment.sla_risk_at && <span className="text-xs font-medium text-amber-600">At risk of missing promise</span>
          )}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => printLabels([shipment])}>
            <Printer className="h-4 w-4 mr-1.5" /> Label
          </Button>
        </div>

        <dl className="mt-4 divide-y">
          <Row label="Recipient">
            {shipment.recipient_name}
            {shipment.recipient_phone && <div className="text-muted-foreground">{shipment.recipient_phone}</div>}
          </Row>
          <Row label="Deliver to">{formatAddress(shipment.delivery_address) || "—"}</Row>
          <Row label="Sender">
            {shipment.sender_name}
            {shipment.sender_phone && <div className="text-muted-foreground">{shipment.sender_phone}</div>}
          </Row>
          <Row label="Collect from">{formatAddress(shipment.pickup_address) || "—"}</Row>
          <Row label="Service">
            {SERVICE_LEVELS[shipment.service_level]}
            {shipment.delivery_window && shipment.delivery_window !== "any" && (
              <div className="text-muted-foreground">{DELIVERY_WINDOWS[shipment.delivery_window].label}</div>
            )}
          </Row>
          <Row label="Promised by">{shipment.promised_by ? format(new Date(shipment.promised_by), "EEE d MMM, HH:mm") : "—"}</Row>
          <Row label="Parcels">
            {shipment.parcel_count}
            {shipment.weight_kg ? ` · ${shipment.weight_kg} kg` : ""}
          </Row>
          {shipment.cod_amount ? <Row label="COD">R {Number(shipment.cod_amount).toFixed(2)}</Row> : null}
          {shipment.current_hub_id && <Row label="Current hub">{hubName(shipment.current_hub_id)}</Row>}
          {shipment.destination_hub_id && (
            <Row label="Collect from">
              {hubName(shipment.destination_hub_id) ?? "Pickup point"}
              {shipment.collect_by && shipment.status === "ready_for_collection" && (
                <div className="text-muted-foreground">by {format(new Date(shipment.collect_by), "EEE d MMM")}</div>
              )}
            </Row>
          )}
          {shipment.return_of_shipment_id && <Row label="Return">Reverse shipment{shipment.return_reason ? ` · ${shipment.return_reason}` : ""}</Row>}
          <Row label="Attempts">
            {shipment.attempt_count} / {shipment.max_attempts}
            {shipment.last_failure_reason && <div className="text-muted-foreground">Last: {shipment.last_failure_reason}</div>}
          </Row>
          {shipment.require_otp && <Row label="Delivery OTP">
            <span className="font-mono tracking-widest">{shipment.delivery_otp}</span>
            <div className="text-xs text-muted-foreground">Share only with the recipient.</div>
            {(shipment.otp_failures ?? 0) >= 5 && (
              <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                Locked after 5 wrong codes at the door. Confirm the recipient's identity, then reset.
                {can("owner", "dispatcher") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 h-7"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      const { data: code, error } = await db.rpc("logistics_reset_otp", { p_shipment_id: shipment.id });
                      setBusy(false);
                      if (error) toast({ variant: "destructive", title: "Reset failed", description: error.message });
                      else {
                        toast({ title: "New delivery code issued", description: `Code ${code}. Share it with the recipient only.` });
                        qc.invalidateQueries({ queryKey: ["lx", "shipments"] });
                        onClose();
                      }
                    }}
                  >
                    Reset delivery code
                  </Button>
                )}
              </div>
            )}
          </Row>}
          {shipment.reference && <Row label="Reference">{shipment.reference}</Row>}
          {shipment.notes && <Row label="Notes">{shipment.notes}</Row>}
        </dl>

        {shipment.status === "delivered" && (
          <div className="mt-4">
            <PodPanel shipmentId={shipment.id} />
          </div>
        )}

        {shipment.status === "delivered" && !shipment.return_of_shipment_id && canOperate && !shipment.pii_redacted_at && (
          <Button
            size="sm"
            variant="outline"
            className="mt-4"
            disabled={busy}
            onClick={async () => {
              const reason = window.prompt("Return reason");
              if (!reason?.trim()) return;
              setBusy(true);
              const { data, error } = await db.rpc("logistics_staff_return", { p_shipment_id: shipment.id, p_reason: reason.trim() });
              setBusy(false);
              const res = data as { ok?: boolean; error?: string; tracking_number?: string } | null;
              if (error || !res?.ok) {
                toast({ variant: "destructive", title: "Return not booked", description: (res?.error ?? error?.message ?? "").replace(/_/g, " ") });
                return;
              }
              toast({ title: "Return booked", description: res.tracking_number });
              qc.invalidateQueries({ queryKey: ["lx", "shipments"] });
            }}
          >
            Book a return
          </Button>
        )}

        {shipment.pii_redacted_at && (
          <p className="mt-4 text-xs text-muted-foreground">
            Personal data removed {format(new Date(shipment.pii_redacted_at), "d MMM yyyy")} under the retention policy.
          </p>
        )}

        {shipment.requires_approval && !shipment.approved_at && !isClosed && (
          <section className="mt-6 space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <h3 className="text-sm font-semibold">Held for review</h3>
            <p className="text-xs text-muted-foreground">
              High value or large cash-on-delivery amount. It can't be routed or dispatched until a second person approves it.
            </p>
            {canDispatch && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const { error } = await db.rpc("logistics_review_shipment", { p_shipment_id: shipment.id, p_approve: true, p_note: note.trim() || null });
                    setBusy(false);
                    if (error) {
                      toast({
                        variant: "destructive",
                        title: "Not approved",
                        description: error.message.includes("cannot_approve_own_booking") ? "Someone other than the person who booked it must approve it." : error.message,
                      });
                      return;
                    }
                    toast({ title: "Released for delivery" });
                    qc.invalidateQueries({ queryKey: ["lx"] });
                    onClose();
                  }}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  disabled={busy || !note.trim()}
                  onClick={async () => {
                    setBusy(true);
                    const { error } = await db.rpc("logistics_review_shipment", { p_shipment_id: shipment.id, p_approve: false, p_note: note.trim() });
                    setBusy(false);
                    if (error) toast({ variant: "destructive", title: "Failed", description: error.message });
                    else {
                      toast({ title: "Rejected and cancelled" });
                      qc.invalidateQueries({ queryKey: ["lx"] });
                      onClose();
                    }
                  }}
                >
                  Reject
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">To reject, add a reason in the note box below.</p>
          </section>
        )}

        {canOperate && !isClosed && (
          <section className="mt-6 space-y-3 rounded-lg border p-3">
            <h3 className="text-sm font-semibold">Actions</h3>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for the timeline" />
            <div className="flex gap-2">
              <Select value={hubId} onValueChange={setHubId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Scan in at hub…" />
                </SelectTrigger>
                <SelectContent>
                  {hubs.filter((h) => h.is_active).map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.code} · {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="secondary"
                disabled={!hubId || busy}
                onClick={() => update({ status: "at_hub", current_hub_id: hubId }, "Scanned in at hub")}
              >
                <Warehouse className="h-4 w-4 mr-1.5" /> Scan in
              </Button>
            </div>
            {canDispatch && (
              <div className="flex flex-wrap gap-2">
                {shipment.status === "returning" && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => update({ status: "returned" }, "Marked returned to sender")}>
                    Mark returned
                  </Button>
                )}
                {["failed_attempt", "exception"].includes(shipment.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => update({ status: "returning" }, "Return to sender started")}
                  >
                    Return to sender
                  </Button>
                )}
                {shipment.status !== "exception" && (
                  <Button size="sm" variant="outline" disabled={busy || !note.trim()} onClick={() => update({ status: "exception" }, "Flagged as exception")}>
                    Flag exception
                  </Button>
                )}
                {shipment.status === "exception" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => update({ status: shipment.current_hub_id ? "at_hub" : "awaiting_pickup" }, "Exception cleared")}
                  >
                    Clear exception
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => update({ status: "cancelled" }, "Shipment cancelled")}>
                  Cancel shipment
                </Button>
              </div>
            )}
            {canDispatch && shipment.status !== "exception" && !note.trim() && (
              <p className="text-xs text-muted-foreground">Add a note to flag an exception.</p>
            )}
          </section>
        )}

        <section className="mt-6">
          <h3 className="text-sm font-semibold mb-3">Timeline</h3>
          <ol className="space-y-4">
            {events.map((e, i) => (
              <li key={e.id} className="flex gap-3">
                <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${i === 0 ? "bg-primary" : "bg-muted-foreground/40"}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {e.event_type === "note" ? "Note" : SHIPMENT_STATUS[e.status as ShipmentStatus]?.label ?? e.status}
                  </p>
                  {e.notes && <p className="text-sm text-muted-foreground">{e.notes}</p>}
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(e.created_at), "d MMM, HH:mm")}
                    {e.hub_id && hubName(e.hub_id) ? ` · ${hubName(e.hub_id)}` : ""}
                    {e.driver_id && driverName(e.driver_id) ? ` · ${driverName(e.driver_id)}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </SheetContent>
    </Sheet>
  );
};

export default ShipmentDetailSheet;

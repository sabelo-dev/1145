import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { invokeDispatch } from "../lib/db";
import { useDrivers, useHubs, useVehicles } from "../lib/queries";

const NONE = "none";

const CreateRouteDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipmentIds: string[];
  onCreated?: () => void;
}> = ({ open, onOpenChange, shipmentIds, onCreated }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: hubs = [] } = useHubs();
  const { data: drivers = [] } = useDrivers();
  const { data: vehicles = [] } = useVehicles();
  const today = format(new Date(), "yyyy-MM-dd");
  const [form, setForm] = useState({ name: "", hubId: NONE, driverId: NONE, vehicleId: NONE, routeDate: today, startTime: "08:00" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    try {
      const hub = hubs.find((h) => h.id === form.hubId);
      const res = await invokeDispatch<{ routeId: string; stops: number; totalDistanceKm: number; totalDurationMins: number; skipped: number }>(
        "create_route",
        {
          name: form.name || `${hub?.code ?? "RT"}-${form.routeDate}`,
          hubId: form.hubId === NONE ? null : form.hubId,
          driverId: form.driverId === NONE ? null : form.driverId,
          vehicleId: form.vehicleId === NONE ? null : form.vehicleId,
          routeDate: form.routeDate,
          plannedStart: new Date(`${form.routeDate}T${form.startTime}:00`).toISOString(),
          shipmentIds,
        },
      );
      toast({
        title: "Route planned",
        description: `${res.stops} stops · ${res.totalDistanceKm} km · ~${Math.round(res.totalDurationMins / 60 * 10) / 10} h${
          res.skipped ? ` · ${res.skipped} skipped (already routed or not routable)` : ""
        }`,
      });
      qc.invalidateQueries({ queryKey: ["lx"] });
      onCreated?.();
      onOpenChange(false);
      navigate(`/routes/${res.routeId}`);
    } catch (err) {
      toast({ variant: "destructive", title: "Could not plan route", description: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Plan a route</DialogTitle>
          <DialogDescription>
            {shipmentIds.length} shipment{shipmentIds.length === 1 ? "" : "s"}. Pickup stops are added for parcels not yet collected, and the stop order
            is optimised on the server.
          </DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Route name</Label>
            <Input value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="Auto: HUB-date" />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={form.routeDate} onChange={(e) => set("routeDate")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Start time</Label>
            <Input type="time" value={form.startTime} onChange={(e) => set("startTime")(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Start hub</Label>
            <Select value={form.hubId} onValueChange={set("hubId")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No hub (start at first stop)</SelectItem>
                {hubs.filter((h) => h.is_active).map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.code} · {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Driver</Label>
            <Select value={form.driverId} onValueChange={set("driverId")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Assign later</SelectItem>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} · {d.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Vehicle</Label>
            <Select value={form.vehicleId} onValueChange={set("vehicleId")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Driver's own</SelectItem>
                {vehicles
                  .filter((v: { status: string }) => v.status === "active")
                  .map((v: { id: string; license_plate: string; make: string; model: string }) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.license_plate} · {v.make} {v.model}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || shipmentIds.length === 0}>
            {saving ? "Optimising…" : "Create & optimise"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRouteDialog;

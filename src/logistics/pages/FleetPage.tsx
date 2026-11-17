import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format } from "date-fns";
import { AlertTriangle, Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { db } from "../lib/db";
import { useDrivers, useVehicles } from "../lib/queries";
import { useLogisticsAuth } from "../auth/LogisticsAuth";
import { EmptyState, PageHeader, StatCard } from "../components/common";

interface Vehicle {
  id: string;
  driver_id: string | null;
  fleet_id: string | null;
  make: string;
  model: string;
  year: number;
  color: string;
  license_plate: string;
  insurance_expiry: string | null;
  registration_expiry: string | null;
  inspection_status: string | null;
  status: string;
}

const VEHICLE_STATUSES = ["pending", "active", "inactive", "maintenance", "decommissioned"];

function expiryState(date: string | null): { label: string; tone: "ok" | "warn" | "bad" | "none" } {
  if (!date) return { label: "Not on file", tone: "none" };
  const days = differenceInCalendarDays(new Date(date), new Date());
  if (days < 0) return { label: `Expired ${format(new Date(date), "d MMM yyyy")}`, tone: "bad" };
  if (days <= 30) return { label: `${days}d left`, tone: "warn" };
  return { label: format(new Date(date), "d MMM yyyy"), tone: "ok" };
}

const toneClass = { ok: "text-muted-foreground", warn: "text-amber-600 font-medium", bad: "text-red-600 font-medium", none: "text-muted-foreground italic" };

const FleetPage: React.FC = () => {
  const { can, session } = useLogisticsAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: vehicles = [] } = useVehicles() as { data: Vehicle[] | undefined };
  const { data: drivers = [] } = useDrivers();
  const [adding, setAdding] = useState(false);
  const [fleetFilter, setFleetFilter] = useState("all");

  const { data: fleets = [] } = useQuery({
    queryKey: ["lx", "fleets"],
    queryFn: async () => {
      const { data, error } = await db.from("fleets").select("id, name, status").order("name");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; status: string }>;
    },
  });

  const canManage = can("owner", "fleet_manager");
  const shown = vehicles.filter((v) => fleetFilter === "all" || v.fleet_id === fleetFilter);

  const compliance = useMemo(() => {
    let expired = 0;
    let expiring = 0;
    vehicles.forEach((v) => {
      [v.insurance_expiry, v.registration_expiry].forEach((d) => {
        const s = expiryState(d).tone;
        if (s === "bad") expired++;
        if (s === "warn") expiring++;
      });
    });
    return { expired, expiring };
  }, [vehicles]);

  const update = async (id: string, patch: Partial<Vehicle>) => {
    const { error } = await db.from("vehicles").update(patch).eq("id", id);
    if (error) toast({ variant: "destructive", title: "Update failed", description: error.message });
    qc.invalidateQueries({ queryKey: ["lx", "vehicles"] });
  };

  const addFleet = async () => {
    const name = window.prompt("Fleet name");
    if (!name?.trim() || !session) return;
    const { error } = await db.from("fleets").insert({ name: name.trim(), owner_id: session.user.id });
    if (error) toast({ variant: "destructive", title: "Could not add fleet", description: error.message });
    qc.invalidateQueries({ queryKey: ["lx", "fleets"] });
  };

  return (
    <div>
      <PageHeader
        title="Fleet"
        description="Vehicles, assignments and compliance."
        actions={
          canManage && (
            <>
              <Button variant="outline" onClick={addFleet}>
                New fleet
              </Button>
              <Button onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Add vehicle
              </Button>
            </>
          )
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="Vehicles" value={vehicles.length} icon={<Truck className="h-4 w-4" />} />
        <StatCard label="Active" value={vehicles.filter((v) => v.status === "active").length} tone="good" />
        <StatCard label="In maintenance" value={vehicles.filter((v) => v.status === "maintenance").length} />
        <StatCard
          label="Compliance issues"
          value={compliance.expired + compliance.expiring}
          hint={`${compliance.expired} expired · ${compliance.expiring} due ≤30d`}
          tone={compliance.expired ? "danger" : compliance.expiring ? "warn" : "default"}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <div className="mb-3">
        <Select value={fleetFilter} onValueChange={setFleetFilter}>
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All fleets</SelectItem>
            {fleets.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={<Truck className="h-8 w-8" />} title="No vehicles" description="Add fleet vehicles to assign them to routes." />
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead className="hidden md:table-cell">Insurance</TableHead>
                <TableHead className="hidden md:table-cell">Licence disc</TableHead>
                <TableHead className="hidden lg:table-cell">Inspection</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((v) => {
                const ins = expiryState(v.insurance_expiry);
                const reg = expiryState(v.registration_expiry);
                return (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div className="font-mono text-sm">{v.license_plate}</div>
                      <div className="text-xs text-muted-foreground">
                        {v.year} {v.make} {v.model} · {v.color}
                      </div>
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        <Select value={v.driver_id ?? "none"} onValueChange={(d) => update(v.id, { driver_id: d === "none" ? null : d })}>
                          <SelectTrigger className="h-8 w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Unassigned</SelectItem>
                            {drivers.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        drivers.find((d) => d.id === v.driver_id)?.name ?? "—"
                      )}
                    </TableCell>
                    <TableCell className={`hidden md:table-cell text-xs ${toneClass[ins.tone]}`}>{ins.label}</TableCell>
                    <TableCell className={`hidden md:table-cell text-xs ${toneClass[reg.tone]}`}>{reg.label}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs capitalize text-muted-foreground">{v.inspection_status ?? "—"}</TableCell>
                    <TableCell>
                      {canManage ? (
                        <Select value={v.status} onValueChange={(s) => update(v.id, { status: s })}>
                          <SelectTrigger className="h-8 w-36 capitalize">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VEHICLE_STATUSES.map((s) => (
                              <SelectItem key={s} value={s} className="capitalize">
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="capitalize text-sm">{v.status}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {adding && <AddVehicleDialog fleets={fleets} onClose={() => setAdding(false)} />}
    </div>
  );
};

const AddVehicleDialog: React.FC<{ fleets: Array<{ id: string; name: string }>; onClose: () => void }> = ({ fleets, onClose }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    license_plate: "",
    make: "",
    model: "",
    year: String(new Date().getFullYear()),
    color: "",
    fleet_id: "none",
    insurance_expiry: "",
    registration_expiry: "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await db.from("vehicles").insert({
      license_plate: form.license_plate.trim().toUpperCase(),
      make: form.make,
      model: form.model,
      year: Number(form.year),
      color: form.color,
      fleet_id: form.fleet_id === "none" ? null : form.fleet_id,
      is_fleet_vehicle: form.fleet_id !== "none",
      insurance_expiry: form.insurance_expiry || null,
      registration_expiry: form.registration_expiry || null,
      status: "active",
    });
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Could not add vehicle", description: error.message });
      return;
    }
    toast({ title: "Vehicle added" });
    qc.invalidateQueries({ queryKey: ["lx", "vehicles"] });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add vehicle</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Number plate</Label>
              <Input required value={form.license_plate} onChange={set("license_plate")} className="uppercase" />
            </div>
            <div className="space-y-1.5">
              <Label>Fleet</Label>
              <Select value={form.fleet_id} onValueChange={(v) => setForm((f) => ({ ...f, fleet_id: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No fleet</SelectItem>
                  {fleets.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Make</Label>
              <Input required value={form.make} onChange={set("make")} placeholder="Toyota" />
            </div>
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Input required value={form.model} onChange={set("model")} placeholder="Hiace" />
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input required type="number" min={1980} max={2100} value={form.year} onChange={set("year")} />
            </div>
            <div className="space-y-1.5">
              <Label>Colour</Label>
              <Input required value={form.color} onChange={set("color")} />
            </div>
            <div className="space-y-1.5">
              <Label>Insurance expiry</Label>
              <Input type="date" value={form.insurance_expiry} onChange={set("insurance_expiry")} />
            </div>
            <div className="space-y-1.5">
              <Label>Licence disc expiry</Label>
              <Input type="date" value={form.registration_expiry} onChange={set("registration_expiry")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Add vehicle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default FleetPage;

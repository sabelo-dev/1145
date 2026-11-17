import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { db, formatAddress, type Hub } from "../lib/db";
import { useHubs } from "../lib/queries";
import { resolveAddress, toAddress } from "../lib/address";
import { useLogisticsAuth } from "../auth/LogisticsAuth";
import AddressField, { type AddressValue } from "../components/AddressField";
import { EmptyState, PageHeader } from "../components/common";

const TYPES: Record<Hub["hub_type"], string> = {
  hub: "Sortation hub",
  warehouse: "Warehouse",
  depot: "Depot",
  pickup_point: "Pickup point (counter)",
  locker: "Parcel locker",
};

const HubsPage: React.FC = () => {
  const { can } = useLogisticsAuth();
  const { data: hubs = [] } = useHubs();
  const [editing, setEditing] = useState<Hub | "new" | null>(null);

  const { data: counts = {} } = useQuery({
    queryKey: ["lx", "shipments", "hub-counts"],
    queryFn: async () => {
      const { data, error } = await db.from("shipments").select("current_hub_id").eq("status", "at_hub").not("current_hub_id", "is", null).limit(5000);
      if (error) throw error;
      const out: Record<string, number> = {};
      (data ?? []).forEach((r: { current_hub_id: string }) => (out[r.current_hub_id] = (out[r.current_hub_id] ?? 0) + 1));
      return out;
    },
  });

  const canManage = can("owner", "fleet_manager");

  return (
    <div>
      <PageHeader
        title="Hubs"
        description="Warehouses, depots and pickup points in the network."
        actions={
          canManage && (
            <Button onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4 mr-1.5" /> Add hub
            </Button>
          )
        }
      />
      {hubs.length === 0 ? (
        <EmptyState icon={<Warehouse className="h-8 w-8" />} title="No hubs yet" description="Add your first warehouse or depot so routes have a start point." />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {hubs.map((h) => {
            const n = counts[h.id] ?? 0;
            const util = h.capacity_parcels ? Math.round((n / h.capacity_parcels) * 100) : null;
            return (
              <button
                key={h.id}
                type="button"
                disabled={!canManage}
                onClick={() => setEditing(h)}
                className="text-left rounded-xl border bg-card p-4 hover:border-primary/50 transition-colors disabled:cursor-default"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">{h.code}</span>
                  {!h.is_active && <span className="text-xs text-muted-foreground">Inactive</span>}
                </div>
                <p className="mt-1 font-medium">{h.name}</p>
                <p className="text-xs text-muted-foreground">
                  {TYPES[h.hub_type]}
                  {h.is_public ? " · public collection point" : ""}
                </p>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{formatAddress(h.address)}</p>
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className="font-semibold tabular-nums">{n}</span>
                  <span className="text-muted-foreground">parcels on hand</span>
                  {util != null && (
                    <span className={`ml-auto text-xs tabular-nums ${util > 90 ? "text-red-600" : util > 70 ? "text-amber-600" : "text-muted-foreground"}`}>
                      {util}% capacity
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
      {editing && <HubDialog hub={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
};

const HubDialog: React.FC<{ hub: Hub | null; onClose: () => void }> = ({ hub, onClose }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: hub?.code ?? "",
    name: hub?.name ?? "",
    hub_type: hub?.hub_type ?? ("hub" as Hub["hub_type"]),
    contact_name: hub?.contact_name ?? "",
    contact_phone: hub?.contact_phone ?? "",
    capacity_parcels: hub?.capacity_parcels?.toString() ?? "",
    is_active: hub?.is_active ?? true,
    is_public: hub?.is_public ?? false,
    opening_hours_text: hub?.opening_hours_text ?? "",
  });
  const initialAddress = useMemo<AddressValue>(
    () => ({ text: hub ? formatAddress(hub.address) : "", coords: hub?.lat != null && hub?.lng != null ? { lat: Number(hub.lat), lng: Number(hub.lng) } : null }),
    [hub],
  );
  const [address, setAddress] = useState<AddressValue>(initialAddress);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const addr = address.coords ? toAddress(address.text, address.coords) : address.text ? await resolveAddress(address.text) : {};
      const row = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        hub_type: form.hub_type,
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        capacity_parcels: form.capacity_parcels ? Number(form.capacity_parcels) : null,
        is_active: form.is_active,
        is_public: form.is_public && ["pickup_point", "locker"].includes(form.hub_type),
        opening_hours_text: form.opening_hours_text || null,
        address: addr,
        lat: addr.lat ?? null,
        lng: addr.lng ?? null,
      };
      const { error } = hub ? await db.from("logistics_hubs").update(row).eq("id", hub.id) : await db.from("logistics_hubs").insert(row);
      if (error) throw error;
      toast({ title: hub ? "Hub updated" : "Hub added" });
      qc.invalidateQueries({ queryKey: ["lx", "hubs"] });
      onClose();
    } catch (err) {
      toast({ variant: "destructive", title: "Could not save hub", description: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{hub ? `Edit ${hub.code}` : "Add hub"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input required maxLength={8} value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="JNB1" className="uppercase" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Name</Label>
              <Input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Johannesburg North" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.hub_type} onValueChange={(v) => set("hub_type", v as Hub["hub_type"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Capacity (parcels)</Label>
              <Input type="number" min={0} value={form.capacity_parcels} onChange={(e) => set("capacity_parcels", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <AddressField value={address} onChange={setAddress} placeholder="Search hub address" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contact</Label>
              <Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input type="tel" value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
            </div>
          </div>
          {["pickup_point", "locker"].includes(form.hub_type) && (
            <>
              <div className="space-y-1.5">
                <Label>Opening hours</Label>
                <Input value={form.opening_hours_text} onChange={(e) => set("opening_hours_text", e.target.value)} placeholder="Mon–Fri 08:00–18:00, Sat 08:00–13:00" />
              </div>
              <label className="flex items-center gap-3">
                <Switch checked={form.is_public} onCheckedChange={(v) => set("is_public", v)} />
                <span className="text-sm">Offer to customers as a collection point</span>
              </label>
            </>
          )}
          <label className="flex items-center gap-3">
            <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
            <span className="text-sm">Active</span>
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default HubsPage;

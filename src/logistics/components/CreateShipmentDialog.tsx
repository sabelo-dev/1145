import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addHours } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  db,
  DELIVERY_WINDOWS,
  SERVICE_LEVEL_HOURS,
  SERVICE_LEVELS,
  WINDOWED_SERVICES,
  windowedPromise,
  type Address,
  type DeliveryWindow,
  type ServiceLevel,
  type Shipment,
} from "../lib/db";
import { useAccounts, useHubs } from "../lib/queries";
import { resolveAddress, toAddress } from "../lib/address";
import AddressField, { type AddressValue } from "./AddressField";

const emptyAddress: AddressValue = { text: "", coords: null };

const CreateShipmentDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (s: Shipment) => void;
}> = ({ open, onOpenChange, onCreated }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: hubs = [] } = useHubs();
  const { data: accounts = [] } = useAccounts();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    reference: "",
    sender_name: "",
    sender_phone: "",
    recipient_name: "",
    recipient_phone: "",
    recipient_email: "",
    service_level: "next_day" as ServiceLevel,
    delivery_window: "any" as DeliveryWindow,
    account_id: "none",
    parcel_count: "1",
    weight_kg: "",
    declared_value: "",
    cod_amount: "",
    notes: "",
    origin_hub_id: "",
    at_origin_hub: false,
    require_otp: false,
  });
  const [pickup, setPickup] = useState<AddressValue>(emptyAddress);
  const [dropoff, setDropoff] = useState<AddressValue>(emptyAddress);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const reset = () => {
    setForm((f) => ({ ...f, reference: "", recipient_name: "", recipient_phone: "", recipient_email: "", notes: "", cod_amount: "", declared_value: "", weight_kg: "", parcel_count: "1" }));
    setDropoff(emptyAddress);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hub = hubs.find((h) => h.id === form.origin_hub_id);
    if (form.at_origin_hub && !hub) {
      toast({ variant: "destructive", title: "Choose the origin hub" });
      return;
    }
    if (!form.at_origin_hub && !pickup.text.trim()) {
      toast({ variant: "destructive", title: "Pickup address is required" });
      return;
    }
    if (!dropoff.text.trim()) {
      toast({ variant: "destructive", title: "Delivery address is required" });
      return;
    }

    setSaving(true);
    try {
      const pickupAddress: Address = form.at_origin_hub && hub
        ? { ...hub.address, lat: hub.lat ?? undefined, lng: hub.lng ?? undefined }
        : pickup.coords
          ? toAddress(pickup.text, pickup.coords)
          : await resolveAddress(pickup.text);
      const deliveryAddress = dropoff.coords ? toAddress(dropoff.text, dropoff.coords) : await resolveAddress(dropoff.text);

      const { data, error } = await db
        .from("shipments")
        .insert({
          reference: form.reference || null,
          account_id: form.account_id === "none" ? null : form.account_id,
          sender_name: form.sender_name || hub?.name || "Sender",
          sender_phone: form.sender_phone || null,
          recipient_name: form.recipient_name,
          recipient_phone: form.recipient_phone || null,
          recipient_email: form.recipient_email || null,
          pickup_address: pickupAddress,
          delivery_address: deliveryAddress,
          origin_hub_id: hub?.id ?? null,
          current_hub_id: form.at_origin_hub ? hub?.id : null,
          status: form.at_origin_hub ? "at_hub" : "awaiting_pickup",
          service_level: form.service_level,
          delivery_window: WINDOWED_SERVICES.includes(form.service_level) ? form.delivery_window : "any",
          promised_by: windowedPromise(
            addHours(new Date(), SERVICE_LEVEL_HOURS[form.service_level]),
            WINDOWED_SERVICES.includes(form.service_level) ? form.delivery_window : "any",
          ).toISOString(),
          parcel_count: Math.max(1, Number(form.parcel_count) || 1),
          weight_kg: num(form.weight_kg),
          declared_value: num(form.declared_value),
          cod_amount: num(form.cod_amount),
          require_otp: form.require_otp,
          notes: form.notes || null,
        })
        .select("*")
        .single();
      if (error) throw error;

      toast({
        title: "Shipment booked",
        description: `${data.tracking_number}${!deliveryAddress.lat ? " · address not geocoded, check it before routing" : ""}`,
      });
      qc.invalidateQueries({ queryKey: ["lx", "shipments"] });
      onCreated?.(data as Shipment);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast({ variant: "destructive", title: "Could not book shipment", description: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New shipment</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-6">
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Collection</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Origin hub</Label>
                <Select value={form.origin_hub_id || "none"} onValueChange={(v) => set("origin_hub_id", v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="No hub" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No hub (door-to-door)</SelectItem>
                    {hubs.filter((h) => h.is_active).map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.code} · {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-3 rounded-lg border px-3 py-2 self-end h-10">
                <Switch checked={form.at_origin_hub} onCheckedChange={(v) => set("at_origin_hub", v)} disabled={!form.origin_hub_id} />
                <span className="text-sm">Parcel is already at this hub</span>
              </label>
            </div>
            {!form.at_origin_hub && (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Sender name</Label>
                    <Input required value={form.sender_name} onChange={(e) => set("sender_name", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sender phone</Label>
                    <Input type="tel" value={form.sender_phone} onChange={(e) => set("sender_phone", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Pickup address</Label>
                  <AddressField value={pickup} onChange={setPickup} placeholder="Search pickup address" />
                </div>
              </>
            )}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Delivery</legend>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Recipient name</Label>
                <Input required value={form.recipient_name} onChange={(e) => set("recipient_name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Recipient phone</Label>
                <Input type="tel" value={form.recipient_phone} onChange={(e) => set("recipient_phone", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Recipient email</Label>
                <Input type="email" value={form.recipient_email} onChange={(e) => set("recipient_email", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Delivery address</Label>
              <AddressField value={dropoff} onChange={setDropoff} placeholder="Search delivery address" />
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Parcel & service</legend>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Service</Label>
                <Select value={form.service_level} onValueChange={(v) => set("service_level", v as ServiceLevel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SERVICE_LEVELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {WINDOWED_SERVICES.includes(form.service_level) && (
                <div className="space-y-1.5">
                  <Label>Delivery window</Label>
                  <Select value={form.delivery_window} onValueChange={(v) => set("delivery_window", v as DeliveryWindow)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DELIVERY_WINDOWS).map(([k, w]) => (
                        <SelectItem key={k} value={k}>
                          {w.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Parcels</Label>
                <Input type="number" min={1} value={form.parcel_count} onChange={(e) => set("parcel_count", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Weight (kg)</Label>
                <Input type="number" min={0} step="0.1" value={form.weight_kg} onChange={(e) => set("weight_kg", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Declared value (R)</Label>
                <Input type="number" min={0} step="0.01" value={form.declared_value} onChange={(e) => set("declared_value", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Cash on delivery (R)</Label>
                <Input type="number" min={0} step="0.01" value={form.cod_amount} onChange={(e) => set("cod_amount", e.target.value)} />
              </div>
              {accounts.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Bill to account</Label>
                  <Select value={form.account_id} onValueChange={(v) => set("account_id", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {accounts
                        .filter((a) => a.status === "active")
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Reference</Label>
                <Input value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="Order / invoice no." />
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <Switch checked={form.require_otp} onCheckedChange={(v) => set("require_otp", v)} />
              <span className="text-sm">Require recipient OTP on delivery</span>
            </label>
            <div className="space-y-1.5">
              <Label>Notes for driver</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Gate code, building, landmarks…" />
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Booking…" : "Book shipment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateShipmentDialog;

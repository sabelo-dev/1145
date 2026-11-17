import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { db, DELIVERY_WINDOWS, SERVICE_LEVELS, WINDOWED_SERVICES, type DeliveryWindow, type ServiceLevel } from "../lib/db";
import { toAddress } from "../lib/address";
import AddressField, { type AddressValue } from "../components/AddressField";
import { PageHeader } from "../components/common";
import { usePortal } from "./PortalApp";

const SIZES = { small: "Small · up to 2 kg", medium: "Medium · up to 5 kg", large: "Large · up to 15 kg", xl: "Extra large · up to 30 kg" } as const;
type Size = keyof typeof SIZES;

const ERRORS: Record<string, string> = {
  account_on_hold: "This account is on hold, so new bookings are paused.",
  account_overdue: "There's an overdue invoice on this account. New bookings resume once it's paid.",
  credit_limit_exceeded: "This booking would take the account over its credit limit.",
  address_not_geocoded: "Choose both addresses from the suggestions.",
  invalid_pickup_point: "That pickup point isn't available for this service.",
  missing_recipient: "Recipient name and phone are required.",
};
const friendly = (m?: string) => ERRORS[Object.keys(ERRORS).find((k) => m?.includes(k)) ?? ""] ?? m ?? "Booking failed";

const PortalBook: React.FC = () => {
  const { account } = usePortal();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [pickup, setPickup] = useState<AddressValue>(() => {
    try {
      return JSON.parse(localStorage.getItem(`lx-portal-pickup-${account.id}`) || "null") ?? { text: "", coords: null };
    } catch {
      return { text: "", coords: null };
    }
  });
  const [dropoff, setDropoff] = useState<AddressValue>({ text: "", coords: null });
  const [form, setForm] = useState({
    reference: "",
    recipient_name: "",
    recipient_phone: "",
    recipient_email: "",
    service_level: "next_day" as ServiceLevel,
    delivery_window: "any" as DeliveryWindow,
    size: "small" as Size,
    parcel_count: "1",
    cod_amount: "",
    declared_value: "",
    notes: "",
    require_otp: true,
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const pickupAddr = pickup.coords ? toAddress(pickup.text, pickup.coords) : null;
  const dropoffAddr = dropoff.coords ? toAddress(dropoff.text, dropoff.coords) : null;

  const { data: quote, error: quoteError } = useQuery({
    queryKey: ["portal-quote", pickupAddr?.lat, pickupAddr?.lng, dropoffAddr?.lat, dropoffAddr?.lng, form.size, form.service_level],
    enabled: !!pickupAddr && !!dropoffAddr,
    retry: false,
    queryFn: async () => {
      const { data, error } = await db.rpc("quote_parcel", { p_pickup: pickupAddr, p_delivery: dropoffAddr, p_size: form.size, p_service_level: form.service_level });
      if (error) throw new Error(error.message);
      return data as { fee: number; distance_km: number; promised_by: string };
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupAddr || !dropoffAddr) {
      toast({ variant: "destructive", title: "Choose addresses", description: ERRORS.address_not_geocoded });
      return;
    }
    setSaving(true);
    const { data, error } = await db.rpc("portal_book_shipment", {
      p_account_id: account.id,
      p_payload: {
        ...form,
        delivery_window: WINDOWED_SERVICES.includes(form.service_level) ? form.delivery_window : "any",
        pickup_address: pickupAddr,
        delivery_address: dropoffAddr,
      },
    });
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Not booked", description: friendly(error.message) });
      return;
    }
    try {
      localStorage.setItem(`lx-portal-pickup-${account.id}`, JSON.stringify(pickup));
    } catch {
      /* ignore */
    }
    const res = data as { tracking_number: string; fee: number; requires_approval: boolean };
    toast({
      title: `Booked ${res.tracking_number}`,
      description: `R ${Number(res.fee).toFixed(2)} on your account${res.requires_approval ? " · held for high-value review before collection" : ""}.`,
    });
    qc.invalidateQueries({ queryKey: ["portal", account.id] });
    navigate(`/portal/shipments?q=${res.tracking_number}`);
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Book a delivery" description={`Billed to ${account.name} at your account rate.`} />
      <form onSubmit={submit} className="space-y-6 rounded-xl border bg-card p-5">
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Collect from</legend>
          <AddressField value={pickup} onChange={setPickup} placeholder="Your warehouse or store" />
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Deliver to</legend>
          <div className="grid sm:grid-cols-3 gap-3">
            <Input required placeholder="Recipient name" value={form.recipient_name} onChange={(e) => set("recipient_name", e.target.value)} />
            <Input required type="tel" placeholder="Recipient phone" value={form.recipient_phone} onChange={(e) => set("recipient_phone", e.target.value)} />
            <Input type="email" placeholder="Recipient email (optional)" value={form.recipient_email} onChange={(e) => set("recipient_email", e.target.value)} />
          </div>
          <AddressField value={dropoff} onChange={setDropoff} placeholder="Delivery address" />
        </fieldset>
        <fieldset className="grid sm:grid-cols-3 gap-3">
          <legend className="text-sm font-semibold mb-2 sm:col-span-3">Parcel</legend>
          <div className="space-y-1.5">
            <Label>Service</Label>
            <Select value={form.service_level} onValueChange={(v) => set("service_level", v as ServiceLevel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SERVICE_LEVELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Size</Label>
            <Select value={form.size} onValueChange={(v) => set("size", v as Size)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SIZES).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
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
            <Label>Parcels (boxes)</Label>
            <Input type="number" min={1} max={50} value={form.parcel_count} onChange={(e) => set("parcel_count", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Your reference</Label>
            <Input value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="Order no." />
          </div>
          <div className="space-y-1.5">
            <Label>Cash on delivery (R)</Label>
            <Input type="number" min={0} step="0.01" value={form.cod_amount} onChange={(e) => set("cod_amount", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Declared value (R)</Label>
            <Input type="number" min={0} step="0.01" value={form.declared_value} onChange={(e) => set("declared_value", e.target.value)} />
          </div>
        </fieldset>
        <label className="flex items-center gap-3">
          <Switch checked={form.require_otp} onCheckedChange={(v) => set("require_otp", v)} />
          <span className="text-sm">Recipient must give a one-time code at the door</span>
        </label>
        <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Notes for the driver" />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving || !quote || account.status !== "active"}>
            {saving ? "Booking…" : quote ? `Book · ≈ R ${Number(quote.fee).toFixed(0)} before account discount` : "Book"}
          </Button>
          {quote && (
            <span className="text-xs text-muted-foreground">
              {Number(quote.distance_km).toFixed(1)} km · promised {format(new Date(quote.promised_by), "EEE HH:mm")}
            </span>
          )}
          {quoteError && <span className="text-xs text-destructive">{friendly((quoteError as Error).message)}</span>}
        </div>
      </form>
    </div>
  );
};

export default PortalBook;

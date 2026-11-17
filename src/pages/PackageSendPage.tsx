import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, Copy, MapPin, Package as PackageIcon, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";
import PlacesAutocomplete from "@/components/maps/PlacesAutocomplete";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { db, DELIVERY_WINDOWS, SHIPMENT_STATUS, type DeliveryWindow, type Shipment, type ShipmentStatus } from "@/logistics/lib/db";
import { toAddress } from "@/logistics/lib/address";

type Size = "small" | "medium" | "large" | "xl";
type Service = "express" | "same_day" | "next_day" | "standard";
type Place = { text: string; coords: { lat: number; lng: number } | null };

const SIZES: Record<Size, { label: string; hint: string }> = {
  small: { label: "Small", hint: "Fits in a backpack · up to 2 kg" },
  medium: { label: "Medium", hint: "Shoebox to small box · up to 5 kg" },
  large: { label: "Large", hint: "Large box · up to 15 kg" },
  xl: { label: "Extra large", hint: "Bakkie load · up to 30 kg" },
};

const SERVICES: Record<Service, { label: string; hint: string }> = {
  express: { label: "Express", hint: "Collected now, delivered within ~2 hours" },
  same_day: { label: "Same day", hint: "Delivered by tonight" },
  next_day: { label: "Next day", hint: "Delivered tomorrow" },
  standard: { label: "Economy", hint: "2–3 days, lowest price" },
};

const ERRORS: Record<string, string> = {
  address_not_geocoded: "Pick both addresses from the suggestions so we can price the trip.",
  distance_out_of_range: "That trip is longer than we deliver (400 km).",
  daily_booking_limit: "You've reached today's booking limit. Contact support for business volumes.",
  missing_contact_details: "Add the sender name and the recipient's name and phone.",
  not_authenticated: "Sign in to book.",
};
const friendly = (msg?: string) => ERRORS[Object.keys(ERRORS).find((k) => msg?.includes(k)) ?? ""] ?? msg ?? "Something went wrong";

const DRAFT_KEY = "1145-package-draft";

interface Booked {
  id: string;
  tracking_number: string;
  fee: number;
  promised_by: string;
  delivery_otp: string | null;
}

const PackageSendPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const draft = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
    } catch {
      return null;
    }
  }, []);

  const [pickup, setPickup] = useState<Place>(draft?.pickup ?? { text: "", coords: null });
  const [dropoff, setDropoff] = useState<Place>(draft?.dropoff ?? { text: "", coords: null });
  const [form, setForm] = useState({
    senderName: draft?.form?.senderName ?? "",
    senderPhone: draft?.form?.senderPhone ?? "",
    recipientName: draft?.form?.recipientName ?? "",
    recipientPhone: draft?.form?.recipientPhone ?? "",
    notes: draft?.form?.notes ?? "",
    size: (draft?.form?.size ?? "small") as Size,
    service: (draft?.form?.service ?? "same_day") as Service,
    window: (draft?.form?.window ?? "any") as DeliveryWindow,
  });
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState<Booked | null>(null);
  const [paid, setPaid] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => {
    if (user && !form.senderName) setForm((f) => ({ ...f, senderName: user.name ?? "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Keep the form across the sign-in round trip.
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ pickup, dropoff, form }));
    } catch {
      /* storage unavailable */
    }
  }, [pickup, dropoff, form]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const pickupAddr = pickup.coords ? toAddress(pickup.text, pickup.coords) : null;
  const doorAddr = dropoff.coords ? toAddress(dropoff.text, dropoff.coords) : null;

  // Deliver to the door, or to a pickup point / locker near the recipient (20% cheaper).
  const [mode, setMode] = useState<"door" | "point">("door");
  const [pointId, setPointId] = useState<string | null>(null);
  const near = doorAddr ?? pickupAddr;
  const { data: points = [] } = useQuery({
    queryKey: ["pickup-points", near?.lat, near?.lng],
    enabled: mode === "point",
    queryFn: async () => {
      const { data, error } = await db.rpc("list_pickup_points", { p_lat: near?.lat ?? null, p_lng: near?.lng ?? null, p_limit: 8 });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; code: string; name: string; hub_type: string; address: Record<string, unknown>; lat: number; lng: number; opening_hours_text: string | null; distance_km: number | null }>;
    },
  });
  const point = mode === "point" ? points.find((p) => p.id === pointId) ?? null : null;
  const dropoffAddr = mode === "point" ? (point ? { ...point.address, lat: Number(point.lat), lng: Number(point.lng) } : null) : doorAddr;
  const priceFactor = mode === "point" ? 0.8 : 1;

  // Quotes for every service at once, so the options show their prices.
  const { data: quotes, error: quoteError, isFetching: quoting } = useQuery({
    queryKey: ["parcel-quote", pickupAddr?.lat, pickupAddr?.lng, dropoffAddr?.lat, dropoffAddr?.lng, form.size],
    enabled: !!pickupAddr && !!dropoffAddr,
    queryFn: async () => {
      const entries = await Promise.all(
        (Object.keys(SERVICES) as Service[]).map(async (svc) => {
          const { data, error } = await db.rpc("quote_parcel", {
            p_pickup: pickupAddr,
            p_delivery: dropoffAddr,
            p_size: form.size,
            p_service_level: svc,
          });
          if (error) throw new Error(error.message);
          return [svc, data as { fee: number; distance_km: number; promised_by: string }] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<Service, { fee: number; distance_km: number; promised_by: string }>;
    },
    retry: false,
    staleTime: 60_000,
  });

  const { data: myParcels = [] } = useQuery({
    queryKey: ["my-parcels", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db
        .from("shipments")
        .select("id, tracking_number, status, recipient_name, shipping_fee, created_at, promised_by, source, payment_status")
        .eq("customer_user_id", user!.id)
        .eq("source", "consumer")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as Array<
        Pick<Shipment, "id" | "tracking_number" | "status" | "recipient_name" | "shipping_fee" | "created_at" | "promised_by" | "payment_status">
      >;
    },
  });

  const quote = quotes?.[form.service];

  const book = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupAddr || !dropoffAddr) {
      toast({ variant: "destructive", title: "Choose addresses", description: ERRORS.address_not_geocoded });
      return;
    }
    setBooking(true);
    const { data, error } = await db.rpc("book_parcel", {
      p_pickup: pickupAddr,
      p_delivery: dropoffAddr,
      p_sender_name: form.senderName,
      p_sender_phone: form.senderPhone,
      p_recipient_name: form.recipientName,
      p_recipient_phone: form.recipientPhone,
      p_size: form.size,
      p_service_level: form.service,
      p_notes: form.notes,
      p_require_otp: true,
      p_delivery_window: mode === "door" && (form.service === "next_day" || form.service === "standard") ? form.window : "any",
      p_pickup_point_id: point?.id ?? null,
    });
    setBooking(false);
    if (error) {
      toast({ variant: "destructive", title: "Booking failed", description: friendly(error.message) });
      return;
    }
    setBooked(data as Booked);
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    qc.invalidateQueries({ queryKey: ["my-parcels"] });
  };

  const payFromWallet = async (id: string) => {
    setPaying(id);
    const { error } = await db.rpc("pay_parcel_from_wallet", { p_shipment_id: id });
    setPaying(null);
    if (error) {
      toast({
        variant: "destructive",
        title: "Payment failed",
        description: error.message.includes("insufficient")
          ? "Not enough in your 1145 Wallet. Top up, or pay the driver on collection."
          : error.message.includes("wallet is")
            ? "Your wallet isn't active yet. Pay the driver on collection instead."
            : error.message,
      });
      return false;
    }
    toast({ title: "Paid from 1145 Wallet" });
    qc.invalidateQueries({ queryKey: ["my-parcels"] });
    return true;
  };

  const cancel = async (id: string) => {
    const { error } = await db.rpc("cancel_my_parcel", { p_shipment_id: id });
    if (error) {
      toast({
        variant: "destructive",
        title: "Can't cancel",
        description: error.message.includes("already") ? "The driver has already collected or is on the way." : error.message,
      });
      return;
    }
    toast({ title: "Booking cancelled" });
    qc.invalidateQueries({ queryKey: ["my-parcels"] });
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => toast({ title: "Copied" }));

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SEO title="Send a Package | 1145" description="Send parcels across the city with 1145. Instant quotes, live tracking and secure OTP handover." />
      <Header />
      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-2">
              <PackageIcon className="h-3.5 w-3.5" /> Package & Send
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Send a package</h1>
            <p className="text-muted-foreground mt-2">Instant quote, tracked door to door, handed over with a one-time code.</p>
          </div>

          {booked ? (
            <div className="rounded-2xl border bg-muted/40 p-6 space-y-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                <div>
                  <p className="text-lg font-semibold">Booked. A driver will collect it.</p>
                  <p className="text-sm text-muted-foreground">
                    Expected by {format(new Date(booked.promised_by), "EEE d MMM, HH:mm")} · R {Number(booked.fee).toFixed(2)}{" "}
                    {paid ? "paid from your wallet" : "payable on collection, or pay now"}
                  </p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Tracking number</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-lg">{booked.tracking_number}</p>
                    <Button variant="ghost" size="icon" onClick={() => copy(booked.tracking_number)} aria-label="Copy tracking number">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {booked.delivery_otp && (
                  <div className="rounded-xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">Recipient's handover code</p>
                    <p className="font-mono text-lg tracking-[0.4em]">{booked.delivery_otp}</p>
                    <p className="text-xs text-muted-foreground mt-1">We SMS it to the recipient. The driver needs it to complete delivery.</p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {!paid && (
                  <Button
                    disabled={paying === booked.id}
                    onClick={async () => {
                      if (await payFromWallet(booked.id)) setPaid(true);
                    }}
                  >
                    {paying === booked.id ? "Paying…" : `Pay R ${Number(booked.fee).toFixed(0)} from 1145 Wallet`}
                  </Button>
                )}
                <Button asChild variant={paid ? "default" : "outline"}>
                  <Link to={`/track-order?shipment=${booked.tracking_number}`}>Track parcel</Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setBooked(null);
                    setPaid(false);
                    setDropoff({ text: "", coords: null });
                    setForm((f) => ({ ...f, recipientName: "", recipientPhone: "", notes: "" }));
                  }}
                >
                  Send another
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={book} className="space-y-6 bg-muted/40 border border-border rounded-2xl p-5 sm:p-6">
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold mb-1">Where</legend>
                <PlacesAutocomplete
                  value={pickup.text}
                  onChange={(text) => setPickup({ text, coords: null })}
                  onPlaceSelect={(p) => setPickup({ text: p.address, coords: { lat: p.lat, lng: p.lng } })}
                  placeholder="Pickup address"
                  icon={<MapPin className="h-4 w-4 text-muted-foreground" />}
                />
                <PlacesAutocomplete
                  value={dropoff.text}
                  onChange={(text) => setDropoff({ text, coords: null })}
                  onPlaceSelect={(p) => setDropoff({ text: p.address, coords: { lat: p.lat, lng: p.lng } })}
                  placeholder={mode === "point" ? "Recipient's area (to find nearby points)" : "Drop-off address"}
                  icon={<MapPin className="h-4 w-4 text-muted-foreground" />}
                />
                <div className="flex gap-2" role="radiogroup" aria-label="Delivery to">
                  {(["door", "point"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={mode === m}
                      onClick={() => setMode(m)}
                      className={`rounded-full border px-3 py-1.5 text-xs ${mode === m ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                    >
                      {m === "door" ? "To the door" : "To a pickup point / locker · save 20%"}
                    </button>
                  ))}
                </div>
                {mode === "point" && (
                  <div className="space-y-2">
                    {points.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No public pickup points yet. Choose door delivery.</p>
                    ) : (
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {points.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => setPointId(p.id)}
                              className={`w-full text-left rounded-xl border bg-background px-3 py-2 ${pointId === p.id ? "border-primary ring-1 ring-primary" : "hover:bg-muted"}`}
                            >
                              <span className="text-sm font-medium block">
                                {p.name} <span className="text-xs text-muted-foreground">{p.hub_type === "locker" ? "· locker" : ""}</span>
                              </span>
                              <span className="text-xs text-muted-foreground block truncate">{String(p.address?.street ?? "")}</span>
                              <span className="text-xs text-muted-foreground">
                                {p.distance_km != null ? `${p.distance_km} km away` : ""}
                                {p.opening_hours_text ? ` · ${p.opening_hours_text}` : ""}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {form.service === "express" && <p className="text-xs text-amber-700">Express goes door-to-door. Choose same day or slower for a pickup point.</p>}
                  </div>
                )}
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold mb-1">Size</legend>
                <RadioGroup value={form.size} onValueChange={(v) => setForm((f) => ({ ...f, size: v as Size }))} className="grid sm:grid-cols-2 gap-2">
                  {(Object.keys(SIZES) as Size[]).map((k) => (
                    <label key={k} className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5 cursor-pointer has-[:checked]:border-primary">
                      <RadioGroupItem value={k} />
                      <span>
                        <span className="text-sm font-medium block">{SIZES[k].label}</span>
                        <span className="text-xs text-muted-foreground">{SIZES[k].hint}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold mb-1">Speed</legend>
                <RadioGroup value={form.service} onValueChange={(v) => setForm((f) => ({ ...f, service: v as Service }))} className="grid gap-2">
                  {(Object.keys(SERVICES) as Service[]).map((k) => (
                    <label key={k} className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5 cursor-pointer has-[:checked]:border-primary">
                      <RadioGroupItem value={k} />
                      <span className="flex-1">
                        <span className="text-sm font-medium block">{SERVICES[k].label}</span>
                        <span className="text-xs text-muted-foreground">{SERVICES[k].hint}</span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {mode === "point" && k === "express" ? "n/a" : quotes?.[k] ? `R ${Math.round(Number(quotes[k].fee) * priceFactor)}` : quoting ? "…" : ""}
                      </span>
                    </label>
                  ))}
                </RadioGroup>
                {mode === "door" && (form.service === "next_day" || form.service === "standard") && (
                  <div className="pt-2">
                    <span className="text-xs font-medium text-muted-foreground block mb-1.5">Delivery window</span>
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(DELIVERY_WINDOWS) as DeliveryWindow[]).map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, window: w }))}
                          className={`rounded-full border px-3 py-1.5 text-xs ${form.window === w ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                          aria-pressed={form.window === w}
                        >
                          {DELIVERY_WINDOWS[w].label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!pickupAddr || !dropoffAddr ? (
                  <p className="text-xs text-muted-foreground">Choose both addresses from the suggestions to see prices.</p>
                ) : quoteError ? (
                  <p className="text-xs text-destructive">{friendly((quoteError as Error).message)}</p>
                ) : quote ? (
                  <p className="text-xs text-muted-foreground">
                    {Number(quote.distance_km).toFixed(1)} km by road · arrives by {format(new Date(quote.promised_by), "EEE HH:mm")}
                  </p>
                ) : null}
              </fieldset>

              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="text-sm font-semibold mb-1 sm:col-span-2">Who</legend>
                <div className="space-y-1.5">
                  <Label htmlFor="sender-name">Your name</Label>
                  <Input id="sender-name" required value={form.senderName} onChange={set("senderName")} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sender-phone">Your phone</Label>
                  <Input id="sender-phone" type="tel" value={form.senderPhone} onChange={set("senderPhone")} className="h-11" />
                </div>
                <div className="relative space-y-1.5">
                  <Label htmlFor="rec-name">Recipient name</Label>
                  <User className="absolute left-3 bottom-3.5 h-4 w-4 text-muted-foreground" />
                  <Input id="rec-name" required value={form.recipientName} onChange={set("recipientName")} className="h-11 pl-9" />
                </div>
                <div className="relative space-y-1.5">
                  <Label htmlFor="rec-phone">Recipient phone</Label>
                  <Phone className="absolute left-3 bottom-3.5 h-4 w-4 text-muted-foreground" />
                  <Input id="rec-phone" required type="tel" value={form.recipientPhone} onChange={set("recipientPhone")} className="h-11 pl-9" />
                </div>
                <div className="sm:col-span-2">
                  <Textarea value={form.notes} onChange={set("notes")} placeholder="Instructions for the driver (gate code, unit number…)" rows={2} />
                </div>
              </fieldset>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                {user ? (
                  <Button type="submit" className="h-11 px-6 font-medium" disabled={booking || !quote || (mode === "point" && (!point || form.service === "express"))}>
                    {booking ? "Booking…" : quote ? `Book for R ${Math.round(Number(quote.fee) * priceFactor)}` : "Book"}
                  </Button>
                ) : (
                  <Button asChild className="h-11 px-6 font-medium">
                    <Link to="/login">Sign in to book</Link>
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">Pay from your 1145 Wallet or the driver on collection. Free cancellation until it's collected (wallet payments are refunded).</span>
              </div>
            </form>
          )}

          {user && myParcels.length > 0 && (
            <section className="mt-10">
              <h2 className="text-lg font-semibold mb-3">My parcels</h2>
              <ul className="divide-y rounded-2xl border">
                {myParcels.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <Link to={`/track-order?shipment=${p.tracking_number}`} className="font-mono text-sm hover:underline">
                        {p.tracking_number}
                      </Link>
                      <p className="text-xs text-muted-foreground truncate">
                        To {p.recipient_name} · {format(new Date(p.created_at), "d MMM")}
                        {p.shipping_fee ? ` · R ${Number(p.shipping_fee).toFixed(0)}` : ""}
                      </p>
                    </div>
                    <span className="text-xs font-medium">{SHIPMENT_STATUS[p.status as ShipmentStatus]?.label ?? p.status}</span>
                    {p.payment_status === "paid" && <span className="text-xs text-emerald-700 dark:text-emerald-400">Paid</span>}
                    {p.payment_status === "refunded" && <span className="text-xs text-muted-foreground">Refunded</span>}
                    {p.payment_status === "unpaid" && p.status !== "cancelled" && (
                      <Button variant="outline" size="sm" disabled={paying === p.id} onClick={() => payFromWallet(p.id)}>
                        Pay
                      </Button>
                    )}
                    {(p.status === "awaiting_pickup" || p.status === "created") && (
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => cancel(p.id)}>
                        Cancel
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default PackageSendPage;

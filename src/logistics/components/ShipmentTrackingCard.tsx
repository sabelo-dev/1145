import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, formatDistanceToNowStrict } from "date-fns";
import { CalendarClock, CheckCircle2, Circle, MessageSquareText, PackageSearch, RotateCcw, Star, Store, Truck } from "lucide-react";
import GoogleMap from "@/components/maps/GoogleMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatAddress } from "@/lib/navigation";
import { db, DELIVERY_WINDOWS, SERVICE_LEVELS, SHIPMENT_STATUS, type DeliveryWindow, type ServiceLevel, type ShipmentStatus } from "../lib/db";
import { ShipmentStatusBadge, Spinner } from "./common";

interface LiveInfo {
  stops_before: number;
  eta: string | null;
  arrived: boolean;
  driver_lat: number | null;
  driver_lng: number | null;
  driver_seen_at: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
}

interface PublicTracking {
  tracking_number: string;
  status: ShipmentStatus;
  service_level: ServiceLevel;
  parcel_count: number;
  recipient: string;
  destination_city: string | null;
  promised_by: string | null;
  preferred_date: string | null;
  delivery_window?: DeliveryWindow;
  delivered_at: string | null;
  attempt_count: number;
  created_at: string;
  rated: boolean;
  can_self_serve: boolean;
  live: LiveInfo | null;
  pickup_point?: { name: string; type: string; address: Record<string, unknown>; lat: number; lng: number; opening_hours: string | null } | null;
  collect_by?: string | null;
  is_return?: boolean;
  can_return?: boolean;
  brand?: { name: string; logo_url?: string; color?: string; support_phone?: string; support_email?: string; message?: string } | null;
  events: Array<{ status: ShipmentStatus; at: string; location: string | null }>;
}

const MILESTONES: Array<{ key: string; label: string; reached: ShipmentStatus[] }> = [
  { key: "created", label: "Booked", reached: ["created", "awaiting_pickup", "picked_up", "at_hub", "out_for_delivery", "delivered", "failed_attempt"] },
  { key: "collected", label: "Collected", reached: ["picked_up", "at_hub", "out_for_delivery", "delivered", "failed_attempt", "ready_for_collection"] },
  { key: "out", label: "Out for delivery", reached: ["out_for_delivery", "delivered", "failed_attempt", "ready_for_collection"] },
  { key: "delivered", label: "Delivered", reached: ["delivered"] },
];

const SELF_SERVICE_ERRORS: Record<string, string> = {
  verification_failed: "Those digits don't match the recipient's phone number.",
  locked: "Too many wrong attempts. Contact support to change this delivery.",
  too_late: "The driver already has this parcel on today's run, so it can't be changed now.",
  invalid_date: "Choose a day between tomorrow and 7 days from now.",
  closed: "This delivery is already closed.",
  not_delivered: "You can rate once the parcel has been delivered.",
};

/** Public, PII-light tracking result for a shipment tracking number. */
const ShipmentTrackingCard: React.FC<{ trackingNumber: string }> = ({ trackingNumber }) => {
  const { data, isLoading, isFetched } = useQuery({
    queryKey: ["lx", "track", trackingNumber],
    enabled: !!trackingNumber,
    queryFn: async () => {
      const { data, error } = await db.rpc("track_shipment", { p_tracking_number: trackingNumber });
      if (error) throw error;
      return data as PublicTracking | null;
    },
    // Poll faster while the parcel is on the road.
    refetchInterval: (q) => ((q.state.data as PublicTracking | null)?.status === "out_for_delivery" ? 30_000 : 120_000),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (isFetched && !data) {
    return (
      <div className="rounded-xl border bg-background p-8 text-center">
        <PackageSearch className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="mt-3 font-medium">We couldn't find that tracking number</p>
        <p className="text-sm text-muted-foreground mt-1">Check it for typos. New bookings can take a few minutes to appear.</p>
      </div>
    );
  }

  if (!data) return null;
  const live = data.live;

  const brand = data.brand;
  const brandColor = brand?.color && /^#[0-9a-fA-F]{6}$/.test(brand.color) ? brand.color : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-background overflow-hidden">
        {brand && (
          <div className="flex items-center gap-3 px-5 py-3 text-white" style={{ background: brandColor ?? "#1e3a5f" }}>
            {brand.logo_url && /^https:\/\//.test(brand.logo_url) && (
              <img src={brand.logo_url} alt="" className="h-7 w-auto max-w-[120px] rounded bg-white/90 p-0.5 object-contain" referrerPolicy="no-referrer" />
            )}
            <span className="font-semibold">{brand.name}</span>
            <span className="ml-auto text-xs opacity-80">delivered by 1145 Logistics</span>
          </div>
        )}
        {brand?.message && <p className="px-5 py-2 border-b text-sm">{brand.message}</p>}
        <div className="p-5 border-b space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-sm">{data.tracking_number}</span>
            <ShipmentStatusBadge status={data.status} />
          </div>
          <p className="text-lg font-semibold">
            {data.status === "ready_for_collection"
              ? "Ready to collect"
              : data.status === "delivered" && data.delivered_at
              ? `${data.pickup_point ? "Collected" : "Delivered"} ${format(new Date(data.delivered_at), "EEE d MMM, HH:mm")}`
              : live?.arrived
                ? "Your driver has arrived"
                : live?.eta
                  ? `Arriving around ${format(new Date(live.eta), "HH:mm")}`
                  : data.preferred_date
                    ? `Scheduled for ${format(new Date(data.preferred_date), "EEE d MMM")}`
                    : data.promised_by
                      ? `Expected by ${format(new Date(data.promised_by), "EEE d MMM, HH:mm")}`
                      : SHIPMENT_STATUS[data.status].label}
          </p>
          <p className="text-sm text-muted-foreground">
            For {data.recipient}
            {data.destination_city ? ` in ${data.destination_city}` : ""} · {SERVICE_LEVELS[data.service_level]} · {data.parcel_count} parcel
            {data.parcel_count > 1 ? "s" : ""}
            {data.delivery_window && data.delivery_window !== "any" && !live && data.status !== "delivered" && (
              <span className="block">Delivery window: {DELIVERY_WINDOWS[data.delivery_window].label}</span>
            )}
          </p>
          {data.status === "failed_attempt" && (
            <p className="text-sm text-orange-700 dark:text-orange-300">We tried to deliver but couldn't. We'll try again on the next run, or you can choose a day below.</p>
          )}
        </div>

        {data.is_return && <p className="px-5 py-2 border-b text-sm bg-muted/50">This is a return to the sender.</p>}

        {data.pickup_point && !["delivered", "returning", "returned", "cancelled"].includes(data.status) && (
          <div className="border-b px-5 py-4 space-y-1.5">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Store className="h-4 w-4" /> Collect from {data.pickup_point.name}
            </p>
            <p className="text-sm text-muted-foreground">{formatAddress(data.pickup_point.address)}</p>
            {data.pickup_point.opening_hours && <p className="text-sm text-muted-foreground">{data.pickup_point.opening_hours}</p>}
            {data.status === "ready_for_collection" ? (
              <p className="text-sm">
                Bring the collection code from your SMS and your ID.
                {data.collect_by && <span className="font-medium"> Collect by {format(new Date(data.collect_by), "EEE d MMM")}.</span>}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">We'll SMS you a collection code when it arrives.</p>
            )}
            <a
              className="text-sm text-primary hover:underline"
              href={`https://www.google.com/maps/dir/?api=1&destination=${data.pickup_point.lat},${data.pickup_point.lng}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Directions
            </a>
          </div>
        )}

        {live && (
          <div className="border-b">
            <div className="flex items-center gap-3 px-5 py-3 bg-primary/5">
              <Truck className="h-5 w-5 text-primary shrink-0" />
              <p className="text-sm">
                {live.arrived
                  ? "Your driver is at the door."
                  : live.stops_before === 0
                    ? "You're the next stop."
                    : `${live.stops_before} stop${live.stops_before === 1 ? "" : "s"} before yours.`}
                {live.driver_seen_at && (
                  <span className="text-muted-foreground"> Location updated {formatDistanceToNowStrict(new Date(live.driver_seen_at))} ago.</span>
                )}
              </p>
            </div>
            {live.driver_lat != null && live.destination_lat != null && (
              <GoogleMap
                className="w-full h-56"
                zoom={13}
                center={{ lat: Number(live.driver_lat), lng: Number(live.driver_lng) }}
                driverLocation={{ lat: Number(live.driver_lat), lng: Number(live.driver_lng) }}
                markers={[{ position: { lat: Number(live.destination_lat), lng: Number(live.destination_lng) }, title: "Delivery area" }]}
              />
            )}
          </div>
        )}

        <ol className="grid grid-cols-4 gap-2 p-5 border-b">
          {MILESTONES.map((m) => {
            const done = m.reached.includes(data.status);
            return (
              <li key={m.key} className="flex flex-col items-center text-center gap-1.5">
                {done ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5 text-muted-foreground/40" />}
                <span className={done ? "text-xs font-medium" : "text-xs text-muted-foreground"}>{m.label}</span>
              </li>
            );
          })}
        </ol>

        <ul className="p-5 space-y-4">
          {data.events.map((e, i) => (
            <li key={i} className="flex gap-3">
              <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${i === 0 ? "bg-primary" : "bg-muted-foreground/40"}`} />
              <div>
                <p className="text-sm font-medium">{SHIPMENT_STATUS[e.status]?.label ?? e.status}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(e.at), "EEE d MMM, HH:mm")}
                  {e.location ? ` · ${e.location}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {data.can_self_serve && !["returned", "cancelled", "returning", "ready_for_collection"].includes(data.status) && (
        <SelfService tracking={data} />
      )}
      {data.can_return && <ReturnRequest trackingNumber={data.tracking_number} />}
      {brand && (brand.support_phone || brand.support_email) && (
        <p className="text-center text-sm text-muted-foreground">
          Questions about your order? Contact {brand.name}
          {brand.support_phone && (
            <>
              {" "}
              on{" "}
              <a className="text-primary hover:underline" href={`tel:${brand.support_phone}`}>
                {brand.support_phone}
              </a>
            </>
          )}
          {brand.support_email && (
            <>
              {brand.support_phone ? " or " : " at "}
              <a className="text-primary hover:underline" href={`mailto:${brand.support_email}`}>
                {brand.support_email}
              </a>
            </>
          )}
          .
        </p>
      )}
    </div>
  );
};

/** Recipient actions, unlocked with the last 4 digits of their phone number. */
const SelfService: React.FC<{ tracking: PublicTracking }> = ({ tracking }) => {
  const qc = useQueryClient();
  const [digits, setDigits] = useState("");
  const [verified, setVerified] = useState(false);
  const [panel, setPanel] = useState<"instructions" | "reschedule" | "rate" | null>(null);
  const [safePlace, setSafePlace] = useState("");
  const [instructions, setInstructions] = useState("");
  const [date, setDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [windowChoice, setWindowChoice] = useState<DeliveryWindow>(tracking.delivery_window ?? "any");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async (action: string, payload: Record<string, unknown> = {}) => {
    setBusy(true);
    setMessage(null);
    const { data, error } = await db.rpc("recipient_update_delivery", {
      p_tracking_number: tracking.tracking_number,
      p_phone_last4: digits,
      p_action: action,
      p_payload: payload,
    });
    setBusy(false);
    const res = (data ?? {}) as { ok?: boolean; error?: string; preferences?: { safe_place?: string; instructions?: string }; attempts_left?: number };
    if (error || !res.ok) {
      const code = res.error ?? Object.keys(SELF_SERVICE_ERRORS).find((k) => error?.message.includes(k)) ?? "";
      setMessage({
        ok: false,
        text: (SELF_SERVICE_ERRORS[code] ?? error?.message ?? "Something went wrong") + (res.attempts_left != null ? ` ${res.attempts_left} attempts left.` : ""),
      });
      return null;
    }
    return res;
  };

  const delivered = tracking.status === "delivered";
  if (delivered && tracking.rated) {
    return <p className="text-center text-sm text-muted-foreground">Thanks for rating this delivery.</p>;
  }

  return (
    <div className="rounded-xl border bg-background p-5 space-y-4">
      <div>
        <p className="font-semibold">{delivered ? "How did we do?" : "Manage this delivery"}</p>
        <p className="text-sm text-muted-foreground">
          {delivered ? "Rate your delivery." : "Leave instructions, name a safe place, or pick another day."} Confirm with the last 4 digits of the
          recipient's phone number.
        </p>
      </div>

      {!verified ? (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await call("verify");
            if (res) {
              setVerified(true);
              setSafePlace(res.preferences?.safe_place ?? "");
              setInstructions(res.preferences?.instructions ?? "");
              setPanel(delivered ? "rate" : null);
            }
          }}
        >
          <Input
            inputMode="numeric"
            maxLength={4}
            value={digits}
            onChange={(e) => setDigits(e.target.value.replace(/\D/g, ""))}
            placeholder="Last 4 digits"
            className="w-36 tracking-widest"
            aria-label="Last 4 digits of recipient phone"
          />
          <Button type="submit" disabled={digits.length !== 4 || busy}>
            Continue
          </Button>
        </form>
      ) : (
        <>
          {!delivered && (
            <div className="flex flex-wrap gap-2">
              <Button variant={panel === "instructions" ? "default" : "outline"} size="sm" onClick={() => setPanel("instructions")}>
                <MessageSquareText className="h-4 w-4 mr-1.5" /> Instructions
              </Button>
              <Button variant={panel === "reschedule" ? "default" : "outline"} size="sm" onClick={() => setPanel("reschedule")}>
                <CalendarClock className="h-4 w-4 mr-1.5" /> Change day
              </Button>
            </div>
          )}

          {panel === "instructions" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="safe-place">Safe place (if nobody's home)</Label>
                <Input id="safe-place" maxLength={60} value={safePlace} onChange={(e) => setSafePlace(e.target.value)} placeholder="e.g. With security at the gate" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="instr">Instructions for the driver</Label>
                <Textarea id="instr" maxLength={300} rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Gate code, unit number, landmarks…" />
              </div>
              <Button
                disabled={busy}
                onClick={async () => {
                  if (await call("instructions", { safe_place: safePlace, instructions })) setMessage({ ok: true, text: "Saved. Your driver will see this." });
                }}
              >
                Save instructions
              </Button>
            </div>
          )}

          {panel === "reschedule" && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="resched">Deliver on</Label>
                <Input
                  id="resched"
                  type="date"
                  value={date}
                  min={format(addDays(new Date(), 1), "yyyy-MM-dd")}
                  max={format(addDays(new Date(), 7), "yyyy-MM-dd")}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="resched-window">Time</Label>
                <select
                  id="resched-window"
                  value={windowChoice}
                  onChange={(e) => setWindowChoice(e.target.value as DeliveryWindow)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {(Object.keys(DELIVERY_WINDOWS) as DeliveryWindow[]).map((w) => (
                    <option key={w} value={w}>
                      {DELIVERY_WINDOWS[w].label}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                disabled={busy}
                onClick={async () => {
                  if (await call("reschedule", { date, window: windowChoice })) {
                    setMessage({ ok: true, text: `Done. We'll deliver on ${format(new Date(date), "EEEE d MMMM")}.` });
                    qc.invalidateQueries({ queryKey: ["lx", "track", tracking.tracking_number] });
                  }
                }}
              >
                Reschedule
              </Button>
            </div>
          )}

          {panel === "rate" && (
            <div className="space-y-3">
              <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)}>
                    <Star className={cn("h-8 w-8", n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
                  </button>
                ))}
              </div>
              <Textarea rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Anything we should know? (optional)" />
              <Button
                disabled={busy || !rating}
                onClick={async () => {
                  if (await call("rate", { rating, comment })) {
                    setMessage({ ok: true, text: "Thank you for the feedback!" });
                    qc.invalidateQueries({ queryKey: ["lx", "track", tracking.tracking_number] });
                  }
                }}
              >
                Submit rating
              </Button>
            </div>
          )}
        </>
      )}

      {message && <p className={cn("text-sm", message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>{message.text}</p>}
    </div>
  );
};

const RETURN_REASONS = ["Wrong item", "Damaged on arrival", "Changed my mind", "Doesn't fit", "Not as described"];

/** Recipient starts a return: a collection from their address back to the sender. */
const ReturnRequest: React.FC<{ trackingNumber: string }> = ({ trackingNumber }) => {
  const [open, setOpen] = useState(false);
  const [digits, setDigits] = useState("");
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await db.rpc("recipient_request_return", { p_tracking_number: trackingNumber, p_phone_last4: digits, p_reason: reason });
    setBusy(false);
    const res = (data ?? {}) as { ok?: boolean; error?: string; tracking_number?: string; attempts_left?: number };
    if (error || !res.ok) {
      const map: Record<string, string> = {
        verification_failed: `Those digits don't match.${res.attempts_left != null ? ` ${res.attempts_left} attempts left.` : ""}`,
        return_window_closed: "The return window for this parcel has closed.",
        return_exists: "A return has already been booked for this parcel.",
        rate_limited: "Too many attempts. Please wait a minute.",
        locked: "Too many wrong attempts. Contact support.",
      };
      setResult({ ok: false, text: map[res.error ?? ""] ?? error?.message ?? "Couldn't book the return." });
      return;
    }
    setResult({ ok: true, text: `Return booked: ${res.tracking_number}. A driver will collect it from where it was delivered. We'll SMS you.` });
  };

  if (result?.ok) return <p className="rounded-xl border bg-background p-4 text-sm text-emerald-700 dark:text-emerald-400">{result.text}</p>;

  return (
    <div className="rounded-xl border bg-background p-5 space-y-3">
      {!open ? (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <RotateCcw className="h-4 w-4 mr-1.5" /> Return this parcel
        </Button>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="font-semibold">Return this parcel</p>
          <div className="space-y-1.5">
            <Label htmlFor="ret-reason">Reason</Label>
            <select
              id="ret-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {RETURN_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Input
              inputMode="numeric"
              maxLength={4}
              value={digits}
              onChange={(e) => setDigits(e.target.value.replace(/\D/g, ""))}
              placeholder="Last 4 digits of your phone"
              className="w-56"
              aria-label="Last 4 digits of recipient phone"
            />
            <Button type="submit" disabled={busy || digits.length !== 4}>
              Book return
            </Button>
          </div>
          {result && <p className="text-sm text-destructive">{result.text}</p>}
        </form>
      )}
    </div>
  );
};

export default ShipmentTrackingCard;

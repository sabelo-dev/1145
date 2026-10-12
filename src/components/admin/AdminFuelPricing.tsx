import React, { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Fuel, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

// These tables and functions arrive with 20261012170000_ride_fuel_index.sql and
// are not in the generated database types yet.
const db = supabase as any;

const PROVINCES: [string, string][] = [
  ["GP", "Gauteng"], ["WC", "Western Cape"], ["KZN", "KwaZulu-Natal"], ["EC", "Eastern Cape"], ["FS", "Free State"],
  ["MP", "Mpumalanga"], ["LP", "Limpopo"], ["NW", "North West"], ["NC", "Northern Cape"],
];
const provinceName = (code: string) => PROVINCES.find(([c]) => c === code)?.[1] ?? code;
const today = () => format(new Date(), "yyyy-MM-dd");
const day = (value: string) => format(new Date(value), "d MMM yyyy");
const rand = (value: number) => `R${Number(value).toFixed(2)}`;

interface Settings {
  fuel_index_enabled: boolean;
  fuel_reference_price: number | null;
  fuel_surcharge_cap_pct: number;
  max_fare_multiplier: number;
  platform_commission_pct: number;
  fuel_review_threshold_pct: number;
  pickup_wait_minutes: number;
  free_flow_speed_kmh: number;
  idle_fuel_l_per_hour: number;
}

interface VehicleType {
  id: string;
  display_name: string;
  base_fare: number;
  per_km_rate: number;
  per_minute_rate: number;
  minimum_fare: number;
  fuel_l_per_100km: number;
}

interface Review {
  id: string;
  province: string;
  applied_price: number | null;
  new_price: number;
  change_pct: number | null;
  status: "open" | "applied" | "dismissed";
  opened_at: string;
  decided_at: string | null;
  notes: string | null;
}

const NUMBER_SETTINGS: { key: keyof Settings; label: string; hint: string; step: string }[] = [
  { key: "fuel_surcharge_cap_pct", label: "Fuel adjustment limit (%)", hint: "The most fuel can move a fare, up or down, as a share of the normal fare.", step: "1" },
  { key: "max_fare_multiplier", label: "Fare ceiling (× normal fare)", hint: "Surge and fuel together never take a fare above this.", step: "0.1" },
  { key: "fuel_review_threshold_pct", label: "Review when fuel moves by (%)", hint: "Smaller moves leave fares alone.", step: "0.5" },
  { key: "platform_commission_pct", label: "Commission (%)", hint: "Taken from the fare. The fuel adjustment goes to the driver in full.", step: "1" },
  { key: "pickup_wait_minutes", label: "Wait at pickup (min)", hint: "Idling assumed while waiting for the rider.", step: "1" },
  { key: "free_flow_speed_kmh", label: "Free-flow speed (km/h)", hint: "Trip time slower than this counts as idling.", step: "5" },
  { key: "idle_fuel_l_per_hour", label: "Idling fuel use (L/hour)", hint: "Used for the driver's fuel cost.", step: "0.1" },
];

const AdminFuelPricing: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [current, setCurrent] = useState<Record<string, { price: number; from: string }>>({});
  const [applied, setApplied] = useState<Record<string, number>>({});
  const [reviews, setReviews] = useState<Review[]>([]);
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [entry, setEntry] = useState<{ province: string; price: string; from: string; source: string } | null>(null);
  const [dismissing, setDismissing] = useState<Review | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const fail = useCallback(
    (message: string) => toast({ variant: "destructive", title: "Error", description: message }),
    [toast],
  );

  const load = useCallback(async () => {
    const [s, prices, index, rev, vt] = await Promise.all([
      db.from("ride_pricing_settings").select("*").maybeSingle(),
      db.from("fuel_prices").select("province, price_per_litre, effective_from").lte("effective_from", today()).order("effective_from", { ascending: false }),
      db.from("ride_fuel_index").select("province, applied_price"),
      db.from("ride_price_reviews").select("*").order("opened_at", { ascending: false }).limit(30),
      db.from("vehicle_types").select("*").eq("is_active", true).order("base_fare"),
    ]);
    const error = [s, prices, index, rev, vt].find((r) => r.error)?.error;
    if (error) fail("Fuel pricing could not be loaded. " + error.message);

    const latest: Record<string, { price: number; from: string }> = {};
    for (const p of prices.data ?? []) latest[p.province] ??= { price: Number(p.price_per_litre), from: p.effective_from };
    setCurrent(latest);
    setApplied(Object.fromEntries((index.data ?? []).map((i: any) => [i.province, Number(i.applied_price)])));
    setSettings(s.data ?? null);
    setReviews(rev.data ?? []);
    setTypes(vt.data ?? []);
    setLoading(false);
  }, [fail]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: PromiseLike<{ error: { message: string } | null }>, done: string) => {
    setBusy(true);
    const { error } = await action;
    setBusy(false);
    if (error) {
      fail(error.message);
      return false;
    }
    toast({ title: done });
    await load();
    return true;
  };

  const saveSetting = (patch: Partial<Settings>) =>
    act(db.from("ride_pricing_settings").update(patch).eq("id", true), "Pricing settings saved");

  if (loading || !settings) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          {loading ? "Loading fuel pricing..." : "Fuel pricing is not set up in the database yet."}
        </CardContent>
      </Card>
    );
  }

  // What the fuel adjustment comes to on a 10 km, 20 minute trip in the cheapest vehicle type.
  const example = types[0];
  const adjustment = (price: number | null | undefined) => {
    if (!example || !settings.fuel_reference_price || price == null) return null;
    const normal = Math.max(Number(example.base_fare) + 10 * Number(example.per_km_rate) + 20 * Number(example.per_minute_rate), Number(example.minimum_fare));
    const raw = 10 * (Number(example.fuel_l_per_100km) / 100) * (price - Number(settings.fuel_reference_price));
    const cap = normal * (Number(settings.fuel_surcharge_cap_pct) / 100);
    const value = Math.max(Math.min(raw, cap), -cap);
    return { value, capped: Math.abs(raw) > cap, normal };
  };
  const adjustmentText = (price: number | null | undefined) => {
    const a = adjustment(price);
    if (!a) return "no adjustment";
    return `${a.value >= 0 ? "+" : "−"}${rand(Math.abs(a.value))}${a.capped ? " (at the limit)" : ""}`;
  };
  const openReviews = reviews.filter((r) => r.status === "open");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="header-row">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Fuel className="h-5 w-5 text-primary" /> Fuel-cost index
              </CardTitle>
              <CardDescription>
                Adds the extra fuel a trip burns to its fare when fuel costs more than your rates allow for, and takes it
                off when fuel costs less. The whole adjustment goes to the driver.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="fuel-enabled">{settings.fuel_index_enabled ? "On" : "Off"}</Label>
              <Switch
                id="fuel-enabled"
                checked={settings.fuel_index_enabled}
                disabled={busy || (!settings.fuel_index_enabled && !settings.fuel_reference_price)}
                onCheckedChange={(v) => saveSetting({ fuel_index_enabled: v })}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="fuel-reference">Reference fuel price (R/litre)</Label>
              <Input
                id="fuel-reference"
                type="number"
                step="0.01"
                min={0}
                defaultValue={settings.fuel_reference_price ?? ""}
                onBlur={(e) => {
                  const value = parseFloat(e.target.value);
                  if (value > 0 && value !== Number(settings.fuel_reference_price)) void saveSetting({ fuel_reference_price: value });
                }}
              />
              <p className="text-xs text-muted-foreground">
                The fuel price your per-km rates already cover. Needed before the index can be switched on.
              </p>
            </div>
            {NUMBER_SETTINGS.map(({ key, label, hint, step }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`fuel-${key}`}>{label}</Label>
                <Input
                  id={`fuel-${key}`}
                  type="number"
                  step={step}
                  min={0}
                  defaultValue={Number(settings[key])}
                  onBlur={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!Number.isNaN(value) && value !== Number(settings[key])) void saveSetting({ [key]: value });
                  }}
                />
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
            ))}
          </div>

          {types.length > 0 && (
            <div className="space-y-2">
              <Label>Fuel use by vehicle type (litres per 100 km)</Label>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {types.map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm">{t.display_name}</span>
                    <Input
                      aria-label={`${t.display_name} litres per 100 km`}
                      type="number"
                      step="0.1"
                      min={1}
                      className="w-24"
                      defaultValue={Number(t.fuel_l_per_100km)}
                      onBlur={(e) => {
                        const value = parseFloat(e.target.value);
                        if (value > 0 && value !== Number(t.fuel_l_per_100km)) {
                          void act(db.from("vehicle_types").update({ fuel_l_per_100km: value }).eq("id", t.id), "Fuel use saved");
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {openReviews.length > 0 && (
        <Card className="border-gold">
          <CardHeader>
            <CardTitle className="text-base">Price reviews waiting for a decision</CardTitle>
            <CardDescription>
              Fuel has moved enough to look at fares again. Fares keep using the old fuel price until you decide. If fuel
              has moved for good, consider raising your per-km rates and the reference price together instead of carrying
              a permanent adjustment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {openReviews.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                <div className="text-sm">
                  <p className="font-medium">
                    {provinceName(r.province)}: {r.applied_price == null ? "first price" : `${rand(r.applied_price)} → `}
                    {r.applied_price == null ? ` ${rand(r.new_price)}` : rand(r.new_price)} per litre
                    {r.change_pct != null && ` (${Number(r.change_pct) > 0 ? "+" : ""}${Number(r.change_pct)}%)`}
                  </p>
                  <p className="text-muted-foreground">
                    {example && settings.fuel_reference_price
                      ? `On a 10 km ${example.display_name} trip (${rand(adjustment(r.new_price)!.normal)} normally): fuel adjustment ${adjustmentText(r.applied_price)} now, ${adjustmentText(r.new_price)} if applied.`
                      : "Set the reference fuel price to see what this does to a fare."}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={busy} onClick={() => { setNotes(""); setDismissing(r); }}>Leave fares as they are</Button>
                  <Button disabled={busy} onClick={() => act(db.rpc("decide_fuel_price_review", { p_review_id: r.id, p_apply: true }), "Fares now use the new fuel price")}>
                    Use this price in fares
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fuel price by province</CardTitle>
          <CardDescription>
            Record the price of 95 unleaded when it changes. Drivers' fuel costs use today's price straight away; fares
            only change after a review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Province</TableHead>
                <TableHead>Today's price</TableHead>
                <TableHead>Price fares use</TableHead>
                <TableHead>10 km trip</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PROVINCES.map(([code, name]) => {
                const now = current[code];
                const used = applied[code];
                const gap = now && used ? ((now.price - used) / used) * 100 : null;
                return (
                  <TableRow key={code}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell>
                      {now ? (
                        <>
                          {rand(now.price)} <span className="text-sm text-muted-foreground">since {day(now.from)}</span>
                        </>
                      ) : <span className="text-muted-foreground">Not recorded</span>}
                    </TableCell>
                    <TableCell>
                      {used ? rand(used) : <span className="text-muted-foreground">None</span>}
                      {gap !== null && Math.abs(gap) >= 0.05 && (
                        <Badge variant="outline" className="ml-2">today is {gap > 0 ? "+" : ""}{gap.toFixed(1)}%</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {settings.fuel_index_enabled ? adjustmentText(used) : "index is off"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setEntry({ province: code, price: "", from: today(), source: "" })}>
                        Record price
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {reviews.some((r) => r.status !== "open") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Past reviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {reviews.filter((r) => r.status !== "open").map((r) => (
              <p key={r.id}>
                <span className="font-medium">{r.decided_at ? day(r.decided_at) : day(r.opened_at)} · {provinceName(r.province)}</span>{" "}
                {r.applied_price == null ? "" : `${rand(r.applied_price)} → `}{rand(r.new_price)}:{" "}
                {r.status === "applied" ? "used in fares" : "fares left as they were"}
                {r.notes ? <span className="text-muted-foreground"> ({r.notes})</span> : null}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!entry} onOpenChange={(open) => !open && setEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record the fuel price for {entry ? provinceName(entry.province) : ""}</DialogTitle>
            <DialogDescription>95 unleaded, in rand per litre. A price dated in the future takes effect on that day.</DialogDescription>
          </DialogHeader>
          {entry && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fuel-price">Price per litre (R)</Label>
                <Input id="fuel-price" type="number" step="0.01" min={0} value={entry.price} onChange={(e) => setEntry({ ...entry, price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fuel-from">Takes effect on</Label>
                <Input id="fuel-from" type="date" value={entry.from} onChange={(e) => setEntry({ ...entry, from: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="fuel-source">Source (optional)</Label>
                <Input id="fuel-source" value={entry.source} onChange={(e) => setEntry({ ...entry, source: e.target.value })} placeholder="For example the monthly fuel price notice" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntry(null)} disabled={busy}>Cancel</Button>
            <Button
              disabled={busy || !entry || !(parseFloat(entry.price) > 0) || !entry.from}
              onClick={async () => {
                if (!entry) return;
                const ok = await act(
                  db.rpc("record_fuel_price", { p_province: entry.province, p_price: parseFloat(entry.price), p_effective_from: entry.from, p_source: entry.source }),
                  "Fuel price recorded",
                );
                if (ok) setEntry(null);
              }}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record price
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dismissing} onOpenChange={(open) => !open && setDismissing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave fares as they are?</DialogTitle>
            <DialogDescription>
              Fares keep using the old fuel price, so drivers absorb the difference. Say why, for the record.
            </DialogDescription>
          </DialogHeader>
          <Textarea aria-label="Reason" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDismissing(null)} disabled={busy}>Cancel</Button>
            <Button
              disabled={busy || !notes.trim()}
              onClick={async () => {
                if (!dismissing) return;
                const ok = await act(
                  db.rpc("decide_fuel_price_review", { p_review_id: dismissing.id, p_apply: false, p_notes: notes.trim() }),
                  "Fares left as they are",
                );
                if (ok) setDismissing(null);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFuelPricing;

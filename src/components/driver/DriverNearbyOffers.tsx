import { Link } from "react-router-dom";
import { DRIVER_SERVICE_LABELS, fetchDriverServices } from "@/services/driverServices";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { usePushNotifications } from "@/lib/push";
import { supabase } from "@/integrations/supabase/client";
import { fetchNearbyOffers, respondToOffer } from "@/services/nearbyDispatch";

export default function DriverNearbyOffers({ driver, userId, onAccepted }: {
  driver: { id: string; status: string } | null; userId: string; onAccepted: (kind: string) => void;
}) {
  const location = useDriverLocation(driver?.id, driver?.status);
  usePushNotifications(userId);
  const { toast } = useToast();
  const cache = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const seen = useRef(new Set<string>());
  const key = ["nearby-driver-offers", driver?.id];
  const services = useQuery({ queryKey: ["driver-services", userId], queryFn: fetchDriverServices, enabled: !!driver, refetchInterval: 30_000 });
  const offers = useQuery({ queryKey: key, queryFn: fetchNearbyOffers, enabled: driver?.status === "available", refetchInterval: 5000 });
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!driver?.id) return;
    const channel = supabase.channel(`nearby-offers-${driver.id}`).on("postgres_changes", { event: "*", schema: "public", table: "dispatch_assignments", filter: `driver_id=eq.${driver.id}` }, () => { void cache.invalidateQueries({ queryKey: ["nearby-driver-offers", driver.id] }); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [driver?.id, cache]);
  useEffect(() => {
    for (const offer of offers.data ?? []) {
      if (seen.current.has(offer.id)) continue;
      seen.current.add(offer.id);
      toast({ title: DRIVER_SERVICE_LABELS[offer.service_kind] || "Nearby request", description: `${offer.pickup_address} ? ${Number(offer.distance_km).toFixed(1)} km away` });
    }
  }, [offers.data, toast]);
  const live = driver?.status === "available" ? (offers.data ?? []).filter(o => Date.parse(o.expires_at) > now) : [];
  return <section className="space-y-3" aria-label="Nearby work">
    <div className="rounded-xl border bg-card p-3 text-sm" role="status">
      <strong>1145 Driver</strong> ? {location.online ? location.updated && now-location.updated<90_000 ? "Location sharing active" : "Finding your location..." : "Go online to receive nearby work"}
      <p className="text-sm">Accepting: {services.data ? (Object.keys(DRIVER_SERVICE_LABELS) as (keyof typeof DRIVER_SERVICE_LABELS)[]).filter(kind => services.data[kind]).map(kind => DRIVER_SERVICE_LABELS[kind]).join(", ") || "No services enabled" : "Loading services..."} <Link className="font-medium text-primary underline" to="/driver/dashboard?tab=services">Change services</Link></p>
      <p className="text-xs text-muted-foreground">Requests start within 5 km of pickup, expanding to 10 km and then 15 km when needed.</p>
      {location.error && <p className="mt-2 text-destructive">{location.error} <Button size="sm" variant="outline" onClick={location.retry}>Retry location</Button></p>}
    </div>
    {offers.isError && <p role="alert" className="text-sm text-destructive">Could not load nearby offers. Reconnecting...</p>}
    {live.map(offer => <article key={offer.id} className="space-y-3 rounded-xl border-2 border-primary bg-card p-4">
      <div className="flex justify-between gap-2"><strong>{DRIVER_SERVICE_LABELS[offer.service_kind] || "Nearby request"}</strong><span>{Math.max(0, Math.ceil((Date.parse(offer.expires_at)-now)/1000))}s to respond</span></div>
      <p>Pickup: {offer.pickup_address}</p><p>Drop-off: {offer.dropoff_address}</p>
      <p className="text-sm text-muted-foreground">{Number(offer.distance_km).toFixed(1)} km to pickup ? {offer.radius_km} km search</p>
      <p className="font-semibold">{offer.amount != null ? `${offer.entity_type === "ride" ? "Trip fare" : "Delivery earnings"}: R${Number(offer.amount).toFixed(2)}` : "Payment amount not provided"}</p>
      <div className="flex gap-3">{[true,false].map(accept => <Button key={String(accept)} variant={accept ? "default" : "outline"} disabled={!!busy} onClick={async () => {
        setBusy(offer.id);
        try { await respondToOffer(offer.id, accept); if (accept) onAccepted(offer.entity_type); }
        catch (e) { toast({ variant: "destructive", title: "Could not respond", description: e instanceof Error ? e.message : "Try again" }); }
        finally { setBusy(null); void cache.invalidateQueries({ queryKey: key }); }
      }}>{busy === offer.id ? "Sending..." : accept ? "Accept" : "Decline"}</Button>)}</div>
    </article>)}
  </section>;
}

import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, Car, Clock, LocateFixed, MapPin, Package, Search, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import LiveRideMap from "@/components/home/LiveRideMap";
import { DEFAULT_CENTER, etaFromKm, useNearbySupply, useUserLocation, type LatLng } from "@/hooks/useNearbySupply";
import { haversineDistance } from "@/services/dispatch/geoUtils";

type Mode = "ride" | "send" | "shop" | "stay";
const modes: { id: Mode; label: string; icon: typeof Car }[] = [
  { id: "ride", label: "Ride", icon: Car },
  { id: "send", label: "Send", icon: Package },
  { id: "shop", label: "Shop", icon: ShoppingBag },
  { id: "stay", label: "Stay", icon: Building2 },
];

const fieldClass =
  "h-12 w-full rounded-xl border border-transparent bg-surface-input pl-11 pr-4 text-[15px] text-foreground placeholder:text-text-secondary transition-colors hover:bg-surface-hover focus:border-foreground focus:bg-background focus:outline-none";

/** The map is desktop-only, so phones never download Google Maps for it. */
const DESKTOP_QUERY = "(min-width: 1024px)";
const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
};

/** Route illustration: streets, a cyan route, pickup/drop-off pins and a car. */
const RouteMap = () => (
  <svg viewBox="0 0 480 360" className="h-full w-full" role="img" aria-label="Illustration of a route on a map">
    <defs>
      <linearGradient id="route" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="hsl(var(--cyan))" />
        <stop offset="0.8" stopColor="hsl(var(--cyan))" />
        <stop offset="1" stopColor="hsl(var(--gold))" />
      </linearGradient>
      <radialGradient id="glow" cx="0.3" cy="0.35" r="0.8">
        <stop offset="0" stopColor="hsl(var(--cyan) / 0.25)" />
        <stop offset="1" stopColor="transparent" />
      </radialGradient>
    </defs>
    <rect width="480" height="360" fill="url(#glow)" />
    <g stroke="rgba(255,255,255,0.07)" strokeWidth="14" strokeLinecap="round">
      <path d="M-10 90 H500" /><path d="M-10 250 H500" /><path d="M120 -10 V370" /><path d="M330 -10 V370" />
    </g>
    <g stroke="rgba(255,255,255,0.045)" strokeWidth="6">
      <path d="M-10 170 H500" /><path d="M220 -10 V370" /><path d="M420 -10 V370" /><path d="M40 -10 V370" />
    </g>
    <path d="M80 212 C 130 200, 150 170, 200 160 S 300 140, 330 110 S 380 70, 400 58" fill="none" stroke="url(#route)" strokeWidth="5" strokeLinecap="round" />
    <circle cx="80" cy="212" r="10" fill="#ffffff" stroke="hsl(var(--cyan))" strokeWidth="4" />
    <rect x="390" y="48" width="20" height="20" rx="4" fill="hsl(var(--gold))" />
    <g transform="translate(252 148) rotate(-20)">
      <rect x="-15" y="-9" width="30" height="18" rx="6" fill="hsl(0 0% 100%)" />
      <rect x="-7" y="-6" width="12" height="12" rx="2" fill="hsl(var(--navy-800))" />
    </g>
  </svg>
);

const LiveDot = ({ className }: { className?: string }) => (
  <span className={cn("relative flex shrink-0", className)} aria-hidden>
    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-60" />
    <span className="relative inline-flex h-full w-full rounded-full bg-cyan" />
  </span>
);

/**
 * "Go anywhere. Get anything." — the ride / parcel / shop planner with live
 * driver availability. Loaded lazily from the home page.
 */
const MoveSection: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const [mode, setMode] = useState<Mode>("ride");
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [shopSearch, setShopSearch] = useState("");
  const [stayLocation, setStayLocation] = useState("");
  const [when, setWhen] = useState("now");
  const [activeRide, setActiveRide] = useState<{
    id: string; pickup_address: string; dropoff_address: string; status: string; driver_id: string | null;
    pickup_latitude: number | null; pickup_longitude: number | null; dropoff_latitude: number | null; dropoff_longitude: number | null;
  } | null>(null);
  const [driverLocation, setDriverLocation] = useState<LatLng | null>(null);
  const { location: userLocation, locating, denied: locationDenied, locate } = useUserLocation();
  const supplyCenter = userLocation ?? DEFAULT_CENTER;
  const { data: supply, error: supplyError, loading: supplyLoading } = useNearbySupply(supplyCenter);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const secondFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      setActiveRide(null);
      return;
    }

    // Every in-progress spelling used by the rides table and the app.
    const activeStatuses = ["requested", "searching", "accepted", "driver_assigned", "driver_arriving", "arriving", "arrived", "started", "in_progress"];
    const loadActiveRide = async () => {
      const { data } = await supabase
        .from("rides")
        .select("id, pickup_address, dropoff_address, status, driver_id, pickup_latitude, pickup_longitude, dropoff_latitude, dropoff_longitude")
        .eq("passenger_id", user.id)
        .in("status", activeStatuses)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setActiveRide(data as typeof activeRide);
    };

    void loadActiveRide();
    const channel = supabase
      .channel(`home-active-ride-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides", filter: `passenger_id=eq.${user.id}` }, () => {
        void loadActiveRide();
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [user]);

  // Stream the assigned driver's position during an active trip.
  const tripDriverId = activeRide?.driver_id ?? null;
  useEffect(() => {
    setDriverLocation(null);
    if (!tripDriverId) return;
    const apply = (row: { latitude: number; longitude: number } | null) =>
      row && setDriverLocation({ lat: Number(row.latitude), lng: Number(row.longitude) });
    void supabase.from("driver_locations").select("latitude, longitude").eq("driver_id", tripDriverId).maybeSingle()
      .then(({ data }) => apply(data));
    const channel = supabase
      .channel(`home-trip-driver-${tripDriverId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations", filter: `driver_id=eq.${tripDriverId}` },
        (payload) => apply(payload.new as { latitude: number; longitude: number }))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [tripDriverId]);

  const toPoint = (lat: number | null | undefined, lng: number | null | undefined): LatLng | null =>
    lat != null && lng != null ? { lat: Number(lat), lng: Number(lng) } : null;
  const trip = activeRide
    ? { pickup: toPoint(activeRide.pickup_latitude, activeRide.pickup_longitude), dropoff: toPoint(activeRide.dropoff_latitude, activeRide.dropoff_longitude), driver: driverLocation }
    : null;
  const tripEta = trip?.driver && trip.pickup ? etaFromKm(haversineDistance(trip.driver, trip.pickup)) : null;
  const areaLabel = userLocation ? "near you" : "in Johannesburg";
  const asOf = supply?.asOf?.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  /** One live summary, used by the desktop map card and the mobile strip. */
  const live = (() => {
    if (activeRide) {
      return {
        title: tripEta ? `Your driver is ~${tripEta} min away` : `Ride ${activeRide.status.replace(/_/g, " ")}`,
        detail: `${activeRide.pickup_address} → ${activeRide.dropoff_address}`,
        badge: tripEta ? `${tripEta} min` : null,
      };
    }
    if (supplyLoading && !supply) return { title: `Checking drivers ${areaLabel}…`, detail: "Live availability", badge: null };
    if (supplyError || !supply) return { title: "Live availability unavailable", detail: "Request a ride to be matched with the next driver.", badge: null };
    if (supply.available === 0) {
      return { title: `No drivers online ${areaLabel} right now`, detail: `Try again shortly or schedule a ride · updated ${asOf}`, badge: null };
    }
    return {
      title: `${supply.available} driver${supply.available === 1 ? "" : "s"} available ${areaLabel}`,
      detail: `Nearest about ${supply.etaMin} min away · updated ${asOf}`,
      badge: `${supply.etaMin} min`,
    };
  })();

  /** Never a dead button: if a field is missing, take the user straight to it. */
  const requireFields = (first: string, second: string) => {
    if (!first.trim()) { firstFieldRef.current?.focus(); return false; }
    if (!second.trim()) { secondFieldRef.current?.focus(); return false; }
    return true;
  };

  const handleRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireFields(pickup, destination)) return;
    const params = new URLSearchParams({ pickup, destination });
    if (when !== "now") params.set("when", when);
    navigate(`/rides/request?${params.toString()}`);
  };

  const handlePackageQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireFields(senderAddress, recipientAddress)) return;
    const params = new URLSearchParams({ mode: "package", pickup: senderAddress.trim(), destination: recipientAddress.trim() });
    navigate(`/rides/request?${params.toString()}`);
  };

  const handleShopSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = shopSearch.trim();
    navigate(query ? `/shop?search=${encodeURIComponent(query)}` : "/shop");
  };

  const handleStaySearch = (e: React.FormEvent) => {
    e.preventDefault();
    const where = stayLocation.trim();
    navigate(where ? `/stays?location=${encodeURIComponent(where)}` : "/stays");
  };

  /** Two stacked inputs joined by a route line, like a trip planner.
   *  Called as a function (not rendered as <Component/>) so the inputs keep
   *  their identity across renders and never lose focus while typing. */
  const routeFields = (a: string, setA: (v: string) => void, aLabel: string, b: string, setB: (v: string) => void, bLabel: string) => (
    <div className="relative space-y-2">
      <span aria-hidden className="absolute left-[21px] top-[26px] h-[calc(100%-52px)] w-px bg-foreground/25" />
      <div className="relative">
        <span aria-hidden className="absolute left-4 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-foreground bg-background" />
        <input ref={firstFieldRef} value={a} onChange={(e) => setA(e.target.value)} placeholder={aLabel} aria-label={aLabel} className={fieldClass} />
      </div>
      <div className="relative">
        <span aria-hidden className="absolute left-4 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-[3px] bg-foreground" />
        <input ref={secondFieldRef} value={b} onChange={(e) => setB(e.target.value)} placeholder={bLabel} aria-label={bLabel} className={fieldClass} />
      </div>
    </div>
  );

  return (
    <section aria-labelledby="move-title" className="section bg-navy-900 text-white">
      <div className="page-container grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="min-w-0">
          <p className="eyebrow text-white/70">Rides · Delivery · Shopping · Stays</p>
          <h2 id="move-title" className="type-headline mt-3 text-white">Go anywhere. Get anything.</h2>

          {/* Planner */}
          <div className="mt-8 rounded-2xl bg-card p-4 text-foreground shadow-float sm:p-5">
            <div role="group" aria-label="What do you need?" className="mb-4 grid grid-cols-4 gap-1 rounded-full bg-surface-input p-1">
              {modes.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={mode === id}
                  onClick={() => setMode(id)}
                  className={cn(
                    "flex h-10 items-center justify-center gap-1.5 rounded-full px-1 text-sm font-semibold transition-colors",
                    mode === id ? "bg-background text-foreground shadow-soft" : "text-text-secondary hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden /> {label}
                </button>
              ))}
            </div>

            {mode === "ride" && (
              <form onSubmit={handleRequest} className="space-y-3">
                {routeFields(pickup, setPickup, "Pickup location", destination, setDestination, "Where to?")}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative sm:w-44">
                    <Clock aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                    <select value={when} onChange={(e) => setWhen(e.target.value)} aria-label="When" className={cn(fieldClass, "appearance-none")}>
                      <option value="now">Pickup now</option>
                      <option value="15m">In 15 min</option>
                      <option value="1h">In 1 hour</option>
                      <option value="later">Schedule</option>
                    </select>
                  </div>
                  <Button type="submit" variant="cta" className="h-12 flex-1 rounded-xl text-base font-semibold">
                    See prices <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </form>
            )}

            {mode === "send" && (
              <form onSubmit={handlePackageQuote} className="space-y-3">
                {routeFields(senderAddress, setSenderAddress, "Collect from", recipientAddress, setRecipientAddress, "Deliver to")}
                <Button type="submit" variant="cta" className="h-12 w-full rounded-xl text-base font-semibold">
                  Get a quote <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </form>
            )}

            {mode === "shop" && (
              <form onSubmit={handleShopSearch} className="space-y-3">
                <div className="relative">
                  <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                  <input value={shopSearch} onChange={(e) => setShopSearch(e.target.value)} placeholder="Search products, brands, stores" aria-label="Search products" className={fieldClass} />
                </div>
                <Button type="submit" variant="cta" className="h-12 w-full rounded-xl text-base font-semibold">
                  {shopSearch.trim() ? "Search" : "Browse the marketplace"} <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </form>
            )}

            {mode === "stay" && (
              <form onSubmit={handleStaySearch} className="space-y-3">
                <div className="relative">
                  <MapPin aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                  <input value={stayLocation} onChange={(e) => setStayLocation(e.target.value)} placeholder="City, area or property name" aria-label="Where do you want to stay?" className={fieldClass} />
                </div>
                <Button type="submit" variant="cta" className="h-12 w-full rounded-xl text-base font-semibold">
                  {stayLocation.trim() ? "Search stays" : "Browse all stays"} <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </form>
            )}

            {activeRide ? (
              <button
                type="button"
                onClick={() => navigate(`/rides/track/${activeRide.id}`)}
                className="mt-4 flex w-full items-center gap-3 rounded-xl bg-surface-selected p-3 text-left transition hover:bg-surface-pressed"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground"><Car className="h-4 w-4" aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold capitalize">Ride {activeRide.status.replace(/_/g, " ")}</span>
                  <span className="block truncate text-xs text-text-secondary">{activeRide.pickup_address} → {activeRide.dropoff_address}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
              </button>
            ) : !user ? (
              <p className="mt-4 text-sm text-text-secondary">
                <Link to="/login" className="font-semibold text-foreground underline underline-offset-4">Log in</Link> to see your recent trips and orders.
              </p>
            ) : null}
          </div>

          {/* Live availability (phones/tablets — the map is desktop only) */}
          {!activeRide && !isDesktop && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <LiveDot className="h-2.5 w-2.5" />
              <div className="min-w-0 flex-1">
                {/* Only the headline is announced; the timestamp below changes on every poll. */}
                <p aria-live="polite" className="truncate text-sm font-semibold text-white">{live.title}</p>
                <p className="truncate text-xs text-white/70">{live.detail}</p>
              </div>
              {!userLocation && (
                <button type="button" onClick={locate} disabled={locating} aria-label="Use my location"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-60">
                  <LocateFixed className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Live map (desktop) */}
        {isDesktop && (
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/10 bg-navy-800 shadow-float">
            <LiveRideMap center={supplyCenter} cars={supply?.cars ?? []} userLocation={userLocation} trip={trip} fallback={<RouteMap />} />

            <div className="absolute left-5 top-5 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-900/85 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                <LiveDot className="h-2 w-2" />
                Live
              </span>
              {!activeRide && !userLocation && (
                <button type="button" onClick={locate} disabled={locating}
                  className="inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1 text-xs font-semibold text-foreground shadow-soft transition hover:bg-background disabled:opacity-70">
                  <LocateFixed className="h-3.5 w-3.5" aria-hidden /> {locating ? "Locating…" : locationDenied ? "Location blocked" : "Use my location"}
                </button>
              )}
            </div>

            <div className="absolute bottom-5 left-5 right-5 flex items-center gap-3 rounded-2xl bg-background/95 p-4 text-foreground shadow-elevated backdrop-blur">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-900 text-cyan"><Car className="h-5 w-5" aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <p aria-live="polite" className="truncate text-sm font-semibold">{live.title}</p>
                <p className="truncate text-xs text-text-secondary">{live.detail}</p>
              </div>
              {live.badge && <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">{live.badge}</span>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default MoveSection;

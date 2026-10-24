/// <reference types="google.maps" />
import { ridePricing, type RideQuote } from "@/services/ridePricingService";
import React, { useState, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, MapPin, Navigation, Car, Crown, Users, Clock, Wallet,
  Locate, Loader2, ChevronRight, Shield, Zap, Route, Star, Sparkles,
  CircleDot, Play, CreditCard, TrendingUp, AlertTriangle, Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import GoogleMap from "@/components/maps/GoogleMap";
import PlacesAutocomplete from "@/components/maps/PlacesAutocomplete";
import { loadGoogleMaps } from "@/components/maps/GoogleMap";
import { rideDispatchService } from "@/services/rideDispatchService";
import { useFrequentDestinations } from "@/hooks/useFrequentDestinations";
import { isNative } from "@/lib/native";
import { type LatLng, LOCAL_RADIUS_KM, searchAddresses } from "@/lib/addressSearch";

/**
 * The rider's position for the pickup field. A quick network fix first, then
 * GPS, because network location is often off or unavailable indoors. In the
 * native apps this goes through the Capacitor plugin, which asks for the
 * permission itself. Errors carry a message the rider can act on.
 */
async function currentPickupPosition(): Promise<{ lat: number; lng: number }> {
  const attempts = [
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
  ];
  if (isNative()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    let permission = await Geolocation.checkPermissions().catch(() => null);
    if (permission?.location !== "granted" && permission?.coarseLocation !== "granted") {
      permission = await Geolocation.requestPermissions().catch(() => null);
    }
    if (permission?.location === "denied" && permission?.coarseLocation !== "granted") {
      throw new Error("Location access is off for 1145. Turn it on in your phone's Settings, or type your pickup address.");
    }
    let lastError: unknown;
    for (const options of attempts) {
      try {
        const p = await Geolocation.getCurrentPosition(options);
        return { lat: p.coords.latitude, lng: p.coords.longitude };
      } catch (e) {
        lastError = e;
      }
    }
    const message = lastError instanceof Error ? lastError.message : "";
    throw new Error(/disabled|services/i.test(message)
      ? "Your phone's location is switched off. Turn on Location, then try again."
      : "We couldn't get a fix on your location. Move near a window or type your pickup address.");
  }

  if (!("geolocation" in navigator)) throw new Error("This browser can't share your location. Type your pickup address.");
  let lastError: GeolocationPositionError | undefined;
  for (const options of attempts) {
    try {
      const p = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, options));
      return { lat: p.coords.latitude, lng: p.coords.longitude };
    } catch (e) {
      lastError = e as GeolocationPositionError;
      if (lastError?.code === 1) break; // Denied: asking again won't help.
    }
  }
  if (lastError?.code === 1) {
    throw new Error("Location access is blocked for this site. Allow it from the lock icon in the address bar, or type your pickup address.");
  }
  throw new Error("We couldn't find your location. Check that location is switched on, or type your pickup address.");
}


interface VehicleOption {
  id: string;
  name: string;
  display_name: string;
  base_fare: number;
  per_km_rate: number;
  per_minute_rate: number;
  minimum_fare: number;
  max_passengers: number;
  icon: string;
}

const vehicleIcons: Record<string, React.ElementType> = {
  car: Car,
  crown: Crown,
  users: Users,
};

const PAYMENT_METHODS = [
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "cash", label: "Cash", icon: Banknote },
] as const;

const RideRequestPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const requestedPickup = searchParams.get("pickup")?.trim() || "";
  const requestedDropoff = searchParams.get("destination")?.trim() || "";

  const [pickup, setPickup] = useState(() => requestedPickup);
  const [dropoff, setDropoff] = useState(() => requestedDropoff);
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  // Where the phone was last found; centres address searches even after the pickup field is edited.
  const [deviceCoords, setDeviceCoords] = useState<LatLng | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleOption[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [step, setStep] = useState<"location" | "vehicle" | "confirm">("location");
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "card" | "cash">("wallet");
  const [surgeMultiplier, setSurgeMultiplier] = useState(1.0);
  // Fares from the database, by vehicle type. Empty until they load, or if pricing is unavailable.
  const [quotes, setQuotes] = useState<Record<string, RideQuote>>({});
  const [demandLevel, setDemandLevel] = useState<string>("low");
  const { destinations: frequentDestinations } = useFrequentDestinations(6);


  const handlePickupChange = useCallback((value: string) => {
    setPickup(value);
    setPickupCoords(null);
  }, []);

  const handleDropoffChange = useCallback((value: string) => {
    setDropoff(value);
    setDropoffCoords(null);
  }, []);

  const detectAndSetPickup = useCallback(async () => {
    setIsLocating(true);
    try {
      const coords = await currentPickupPosition();
      setDeviceCoords(coords);
      setPickupCoords(coords);
      // Show a street address, not coordinates. Google first, then the same
      // OpenStreetMap geocoder the address fields use; coordinates only if both fail.
      let address = "";
      try {
        await loadGoogleMaps();
        const geocoder = new google.maps.Geocoder();
        const result = await geocoder.geocode({ location: coords });
        address = result.results?.[0]?.formatted_address || "";
      } catch {}
      if (!address) {
        try {
          const params = new URLSearchParams({ lat: String(coords.lat), lon: String(coords.lng), format: "jsonv2", zoom: "18" });
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, { headers: { Accept: "application/json" } });
          if (response.ok) address = (await response.json())?.display_name || "";
        } catch {}
      }
      setPickup(address || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
    } catch (e) {
      toast({
        title: "Location unavailable",
        description: e instanceof Error ? e.message : "Please enter your pickup location manually.",
        variant: "destructive",
      });
    } finally {
      setIsLocating(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!requestedPickup && (isNative() || "geolocation" in navigator) && !pickupCoords) detectAndSetPickup();
  }, []);

  useEffect(() => {
    if (pickupCoords && dropoffCoords && step === "location") handleSearchRides();
  }, [pickupCoords, dropoffCoords]);

  // Check surge when pickup changes
  useEffect(() => {
    if (!pickupCoords) return;
    rideDispatchService.estimateFare(pickupCoords, "", 100).then((result) => {
      setSurgeMultiplier(result.surge);
      setDemandLevel(result.demandLevel);
    }).catch(() => {});
  }, [pickupCoords]);

  // The database works out the fare, including the fuel adjustment and its limits.
  useEffect(() => {
    if (!pickupCoords || !estimatedDistance || !estimatedDuration) return;
    let cancelled = false;
    ridePricing.quotes(pickupCoords, estimatedDistance, estimatedDuration, surgeMultiplier).then((result) => {
      if (cancelled) return;
      setQuotes(result);
      if (selectedType && result[selectedType]) setEstimatedFare(result[selectedType].total);
    });
    return () => { cancelled = true; };
  }, [pickupCoords, estimatedDistance, estimatedDuration, surgeMultiplier]);

  const fetchVehicleTypes = async () => {
    const { data } = await supabase.from("vehicle_types").select("*").eq("is_active", true).order("base_fare", { ascending: true });
    if (data) setVehicleTypes(data);
  };

  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    // Google Maps lets users copy a dropped pin as "latitude, longitude".
    // Accept that manual fallback directly, without another geocoding request.
    const coordinateMatch = address.match(/(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
    if (coordinateMatch) {
      const lat = Number(coordinateMatch[1]);
      const lng = Number(coordinateMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { lat, lng };
      }
    }

    const near = pickupCoords ?? deviceCoords;
    try {
      await loadGoogleMaps();
      const geocoder = new google.maps.Geocoder();
      const bounds = near
        ? new google.maps.Circle({ center: near, radius: LOCAL_RADIUS_KM * 1000 }).getBounds() ?? undefined
        : undefined;
      const result = await geocoder.geocode({ address, componentRestrictions: { country: "ZA" }, bounds });
      const loc = result.results?.[0]?.geometry?.location;
      if (loc) return { lat: loc.lat(), lng: loc.lng() };
    } catch {}

    // Google geocoding is unavailable when the optional Maps key is not
    // configured. Use the same search as the address fields so a destination
    // that was typed (rather than tapped) still resolves near the rider.
    try {
      const [match] = await searchAddresses(address, near, { limit: 1 });
      if (match) return { lat: match.lat, lng: match.lng };
    } catch {}

    return null;
  };

  // The home-page “See prices” form forwards its locations in the URL. Resolve
  // them here so the vehicle prices are calculated for that exact route.
  useEffect(() => {
    if (!requestedPickup || !requestedDropoff) return;
    let cancelled = false;

    const resolveRequestedRoute = async () => {
      const [resolvedPickup, resolvedDropoff] = await Promise.all([
        geocodeAddress(requestedPickup),
        geocodeAddress(requestedDropoff),
      ]);

      if (cancelled) return;
      if (resolvedPickup) setPickupCoords(resolvedPickup);
      if (resolvedDropoff) setDropoffCoords(resolvedDropoff);
      if (!resolvedPickup || !resolvedDropoff) {
        toast({
          variant: "destructive",
          title: "We couldn't locate both addresses",
          description: "Update the pickup or drop-off location to see route-based prices.",
        });
      }
    };

    void resolveRequestedRoute();
    return () => { cancelled = true; };
  }, [requestedPickup, requestedDropoff]);

  const handleSearchRides = async () => {
    let pCoords = pickupCoords;
    let dCoords = dropoffCoords;
    if (!pCoords && pickup) { pCoords = await geocodeAddress(pickup); if (pCoords) setPickupCoords(pCoords); }
    if (!dCoords && dropoff) { dCoords = await geocodeAddress(dropoff); if (dCoords) setDropoffCoords(dCoords); }
    if (!pCoords || !dCoords) {
      toast({
        variant: "destructive",
        title: "We couldn't find one of those locations",
        description: "Choose an address suggestion or enter a more specific location.",
      });
      return;
    }
    setIsSearching(true);
    await fetchVehicleTypes();
    try {
      const service = new google.maps.DistanceMatrixService();
      const result = await service.getDistanceMatrix({
        origins: [pCoords], destinations: [dCoords], travelMode: google.maps.TravelMode.DRIVING,
      });
      const element = result.rows[0]?.elements[0];
      if (element?.status === "OK") {
        setEstimatedDistance(Math.round((element.distance!.value / 1000) * 10) / 10);
        setEstimatedDuration(Math.round(element.duration!.value / 60));
      } else {
        fallbackDistance(pCoords, dCoords);
      }
    } catch {
      fallbackDistance(pCoords, dCoords);
    }
    setIsSearching(false);
    setStep("vehicle");
  };

  const fallbackDistance = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const d = haversineKm(a, b);
    setEstimatedDistance(Math.round(d * 10) / 10);
    setEstimatedDuration(Math.round(d * 2.5 + 5));
  };

  const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  const calculateFare = (type: VehicleOption) => {
    if (!estimatedDistance || !estimatedDuration) return type.minimum_fare;
    if (quotes[type.id]) return quotes[type.id].total;
    // Shown only until the quote arrives.
    const baseFare = type.base_fare + estimatedDistance * type.per_km_rate + estimatedDuration * type.per_minute_rate;
    const surgedFare = baseFare * surgeMultiplier;
    return Math.max(surgedFare, type.minimum_fare);
  };

  const handleSelectVehicle = (typeId: string) => {
    setSelectedType(typeId);
    const type = vehicleTypes.find((t) => t.id === typeId);
    if (type) setEstimatedFare(Math.round(calculateFare(type) * 100) / 100);
    setStep("confirm");
  };

  const handleRequestRide = async () => {
    if (!user) { toast({ variant: "destructive", title: "Please log in to request a ride" }); navigate("/login"); return; }
    if (!selectedType || !estimatedFare || !pickupCoords || !dropoffCoords || !estimatedDistance || !estimatedDuration) return;
    setIsRequesting(true);
    try {
      const result = await rideDispatchService.requestRide({
        passengerId: user.id,
        vehicleTypeId: selectedType,
        pickup: { address: pickup, lat: pickupCoords.lat, lng: pickupCoords.lng },
        dropoff: { address: dropoff, lat: dropoffCoords.lat, lng: dropoffCoords.lng },
        estimatedDistance,
        estimatedDuration,
        estimatedFare,
        paymentMethod,
      });

      if (result.success && result.rideId) {
        toast({
          title: result.surgeApplied ? "⚡ Ride Requested (Surge Active)" : "🚗 Ride Requested!",
          description: `${result.driversNotified} driver${result.driversNotified > 1 ? "s" : ""} notified. ETA: ~${result.estimatedWaitMins || "3-5"} min`,
        });
        navigate(`/rides/track/${result.rideId}`);
      } else {
        toast({ title: "Ride Requested!", description: "Searching for nearby drivers..." });
        if (result.rideId) navigate(`/rides/track/${result.rideId}`);
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to request ride", description: err.message });
    } finally {
      setIsRequesting(false);
    }
  };

  const mapMarkers = [
    ...(pickupCoords ? [{ position: pickupCoords, title: "Pickup", label: "A" }] : []),
    ...(dropoffCoords ? [{ position: dropoffCoords, title: "Drop-off", label: "B" }] : []),
  ];
  const mapRoute = pickupCoords && dropoffCoords && step !== "location" ? { origin: pickupCoords, destination: dropoffCoords } : undefined;
  const selectedVehicle = vehicleTypes.find((t) => t.id === selectedType);

  const surgeColor = surgeMultiplier >= 2.0 ? "text-destructive" : surgeMultiplier >= 1.5 ? "text-orange-500" : surgeMultiplier > 1.0 ? "text-gold" : "text-emerald-600";

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Mobile: Top bar */}
      <div className="lg:hidden flex items-center justify-between px-4 pt-4 pb-2 bg-background z-20">
        <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-base font-bold text-foreground">Request a Ride</h1>
        <div className="flex items-center gap-1.5">
          {surgeMultiplier > 1.0 && (
            <div className="px-2 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
              <span className="text-[11px] font-bold text-orange-600">⚡ {surgeMultiplier}x</span>
            </div>
          )}
          <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">● Live</span>
          </div>
        </div>
      </div>

      {/* ─── COLUMN 1: Request Form (1/3) ─── */}
      <div className="lg:w-1/3 lg:min-h-screen lg:border-r border-border bg-card flex flex-col">
        <div className="hidden lg:flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center hover:bg-accent transition-colors">
              <ArrowLeft className="h-4 w-4 text-foreground" />
            </button>
            <h1 className="text-lg font-bold text-foreground">Request a Ride</h1>
          </div>
          <div className="flex items-center gap-2">
            {surgeMultiplier > 1.0 && (
              <div className="px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-orange-500" />
                <span className="text-[11px] font-bold text-orange-600">{surgeMultiplier}x Surge</span>
              </div>
            )}
            <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">● Live</span>
            </div>
          </div>
        </div>

        <div className="flex-1 p-5 space-y-5 overflow-y-auto">
          {/* Surge Banner */}
          {surgeMultiplier > 1.0 && step === "location" && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Zap className="h-4 w-4 text-orange-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-foreground">High demand in your area</p>
                <p className="text-[11px] text-muted-foreground">
                  Prices are {surgeMultiplier}x higher than normal. {demandLevel === "extreme" ? "Very busy!" : "Moderate demand."}
                </p>
              </div>
            </div>
          )}

          {/* Location inputs */}
          <div className="space-y-0">
            <div className="flex items-stretch gap-3">
              <div className="flex flex-col items-center py-4 gap-0.5">
                <div className="relative">
                  <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.5)]" />
                  <div className="absolute inset-0 w-3 h-3 rounded-full bg-primary animate-ping opacity-30" />
                </div>
                <div className="flex-1 w-0.5 bg-gradient-to-b from-primary via-muted-foreground/20 to-destructive my-1 rounded-full" />
                <div className="w-3 h-3 rounded-sm bg-destructive shadow-[0_0_12px_hsl(var(--destructive)/0.4)] rotate-45" />
              </div>

              <div className="flex-1 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <PlacesAutocomplete
                      value={pickup}
                      onChange={handlePickupChange}
                      near={deviceCoords}
                      onPlaceSelect={(p) => { setPickup(p.address); setPickupCoords({ lat: p.lat, lng: p.lng }); }}
                      placeholder={isLocating ? "Detecting location..." : "Pickup location"}
                    />
                  </div>
                  <button
                    onClick={detectAndSetPickup}
                    disabled={isLocating}
                    className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-all disabled:opacity-50"
                    title="Use current location"
                  >
                    {isLocating ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Locate className="h-4 w-4 text-primary" />}
                  </button>
                </div>

                <PlacesAutocomplete
                  value={dropoff}
                  onChange={handleDropoffChange}
                  near={pickupCoords ?? deviceCoords}
                  onPlaceSelect={(p) => { setDropoff(p.address); setDropoffCoords({ lat: p.lat, lng: p.lng }); }}
                  placeholder="Where to?"
                />

                {step === "location" && frequentDestinations.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Your usual destinations
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {frequentDestinations.map((destination) => (
                        <button
                          key={destination.address}
                          type="button"
                          onClick={() => {
                            setDropoff(destination.address);
                            setDropoffCoords(
                              destination.lat != null && destination.lng != null
                                ? { lat: destination.lat, lng: destination.lng }
                                : null,
                            );
                          }}
                          className="flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                        >
                          <Star className="h-3 w-3 shrink-0 text-gold" />
                          <span className="truncate">{destination.address}</span>
                          {destination.count > 1 && (
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              ×{destination.count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground">
                  No suggestion? Type the address, a place name, or paste “latitude, longitude” — we’ll locate it.
                </p>
              </div>
            </div>


            {step === "location" && (
              <div className="pt-4">
                <button
                  className={`w-full h-13 rounded-2xl text-sm font-bold shadow-lg transition-all duration-300 flex items-center justify-center gap-2.5
                    ${(!pickup || !dropoff || isSearching)
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-primary text-primary-foreground shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] active:scale-[0.98]"
                    }`}
                  onClick={handleSearchRides}
                  disabled={isSearching || !pickup || !dropoff}
                >
                  {isSearching ? (<><Loader2 className="h-5 w-5 animate-spin" />Scanning nearby drivers...</>) : (<><Play className="h-5 w-5 fill-current" />Find Rides</>)}
                </button>
              </div>
            )}
          </div>

          {/* Trip stats bar */}
          {estimatedDistance && estimatedDuration && step !== "location" && (
            <div className="flex items-center gap-2 p-1 rounded-xl bg-muted/50 border border-border">
              <div className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-primary/10">
                <Route className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground">{estimatedDistance} km</span>
              </div>
              <div className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-secondary/10">
                <Clock className="h-4 w-4 text-secondary-foreground" />
                <span className="text-sm font-bold text-foreground">~{estimatedDuration} min</span>
              </div>
              {surgeMultiplier > 1.0 && (
                <div className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-orange-500/10">
                  <Zap className="h-4 w-4 text-orange-500" />
                  <span className={`text-sm font-bold ${surgeColor}`}>{surgeMultiplier}x</span>
                </div>
              )}
            </div>
          )}

          {/* Payment Method Selector */}
          {step === "confirm" && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Payment</p>
              <div className="flex gap-2">
                {PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.id}
                    onClick={() => setPaymentMethod(pm.id as typeof paymentMethod)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all
                      ${paymentMethod === pm.id
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/30"
                      }`}
                  >
                    <pm.icon className="h-4 w-4" />
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Confirmation Panel */}
          {step === "confirm" && estimatedFare && selectedVehicle && (
            <div className="space-y-4 animate-fade-in">
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="bg-primary/5 px-4 py-3 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-2">
                    <CircleDot className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-bold text-foreground">Trip Summary</h2>
                  </div>
                  <button onClick={() => setStep("vehicle")} className="text-xs font-semibold text-primary hover:underline">Change</button>
                </div>

                <div className="p-4 space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">Pickup</p>
                        <p className="text-xs font-medium text-foreground truncate">{pickup}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                        <Navigation className="h-3.5 w-3.5 text-destructive" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">Drop-off</p>
                        <p className="text-xs font-medium text-foreground truncate">{dropoff}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: "Vehicle", value: selectedVehicle.display_name, icon: Car },
                      { label: "Distance", value: `${estimatedDistance} km`, icon: Route },
                      { label: "ETA", value: `~${estimatedDuration} min`, icon: Clock },
                    ].map((stat) => (
                      <div key={stat.label} className="text-center p-2 rounded-lg bg-muted/50 border border-border/50">
                        <stat.icon className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                        <p className="text-[11px] font-bold text-foreground">{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                        {PAYMENT_METHODS.find(p => p.id === paymentMethod)
                          ? React.createElement(PAYMENT_METHODS.find(p => p.id === paymentMethod)!.icon, { className: "h-4 w-4 text-muted-foreground" })
                          : <CreditCard className="h-4 w-4 text-muted-foreground" />
                        }
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground capitalize">{paymentMethod}</p>
                        <p className="text-[11px] text-muted-foreground">Payment method</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black tracking-tighter text-foreground">R{estimatedFare.toFixed(2)}</p>
                      {surgeMultiplier > 1.0 && (
                        <p className="text-[11px] text-orange-500 font-semibold">⚡ {surgeMultiplier}x surge applied</p>
                      )}
                      {surgeMultiplier <= 1.0 && (
                        <p className="text-[11px] text-muted-foreground">estimated</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <button
                className={`w-full h-13 rounded-2xl text-sm font-bold shadow-lg transition-all duration-300 flex items-center justify-center gap-2.5
                  ${isRequesting ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-emerald-600 text-white shadow-emerald-600/30 hover:shadow-emerald-600/50 hover:scale-[1.02] active:scale-[0.98]"}`}
                onClick={handleRequestRide}
                disabled={isRequesting}
              >
                {isRequesting ? (<><Loader2 className="h-5 w-5 animate-spin" />Dispatching...</>) : (<><Shield className="h-5 w-5" />Confirm & Request Ride</>)}
              </button>
              <p className="text-center text-[11px] text-muted-foreground">By requesting, you agree to our terms. Fare may vary with traffic.</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── COLUMN 2: Pricing Options (1/3) ─── */}
      <div className="lg:w-1/3 lg:min-h-screen lg:border-r border-border bg-background flex flex-col">
        <div className="hidden lg:flex items-center gap-2 px-6 py-4 border-b border-border">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Ride Options</h2>
          {surgeMultiplier > 1.0 && (
            <Badge variant="outline" className="ml-auto text-orange-500 border-orange-500/30 bg-orange-500/5">
              <Zap className="h-3 w-3 mr-1" />{surgeMultiplier}x Surge
            </Badge>
          )}
        </div>

        <div className="flex-1 p-5 overflow-y-auto">
          {step === "location" && !isSearching && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 lg:py-0">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Car className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-1">Choose Your Ride</h3>
              <p className="text-sm text-muted-foreground max-w-xs">Enter pickup & destination to see available vehicles and pricing</p>
            </div>
          )}

          {isSearching && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 lg:py-0">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-sm font-medium text-foreground">Finding rides near you...</p>
            </div>
          )}

          {(step === "vehicle" || step === "confirm") && vehicleTypes.length > 0 && (
            <div className="space-y-3">
              <div className="lg:hidden flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-bold text-foreground">Select Ride</h2>
                </div>
                <button onClick={() => { setStep("location"); setSelectedType(null); }} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                  Edit route
                </button>
              </div>

              {vehicleTypes.map((type, index) => {
                const Icon = vehicleIcons[type.icon] || Car;
                const fare = Math.round(calculateFare(type) * 100) / 100;
                const isSelected = selectedType === type.id;
                const isCheapest = index === 0;
                const isPremium = type.icon === "crown";

                return (
                  <button
                    key={type.id}
                    onClick={() => handleSelectVehicle(type.id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 text-left group relative
                      ${isSelected
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border hover:border-primary/40 bg-card hover:bg-accent/30"
                      }`}
                  >
                    <div className={`p-3 rounded-xl transition-colors ${
                      isSelected ? "bg-primary text-primary-foreground" : isPremium ? "bg-secondary/15 text-secondary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-foreground">{type.display_name}</span>
                        {isCheapest && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase">Popular</span>}
                        {isPremium && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-secondary/15 text-secondary-foreground uppercase">Premium</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />{type.max_passengers}</span>
                        {estimatedDuration && <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />~{estimatedDuration} min</span>}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-lg font-black text-foreground">R{fare.toFixed(0)}</p>
                      {surgeMultiplier > 1.0 && (
                        <p className="text-[11px] text-orange-500 font-semibold">⚡ surge</p>
                      )}
                      {surgeMultiplier <= 1.0 && (
                        <p className="text-[11px] text-muted-foreground">est. fare</p>
                      )}
                    </div>

                    <ChevronRight className={`h-4 w-4 shrink-0 transition-colors ${isSelected ? "text-primary" : "text-muted-foreground/30"}`} />
                  </button>
                );
              })}

              {/* Fare breakdown */}
              {selectedVehicle && estimatedDistance && (
                <div className="mt-4 p-4 rounded-xl bg-muted/30 border border-border space-y-2">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Fare Breakdown</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Base fare</span><span className="font-medium text-foreground">R{selectedVehicle.base_fare.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Distance ({estimatedDistance} km × R{selectedVehicle.per_km_rate})</span><span className="font-medium text-foreground">R{(estimatedDistance * selectedVehicle.per_km_rate).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Time ({estimatedDuration} min × R{selectedVehicle.per_minute_rate})</span><span className="font-medium text-foreground">R{((estimatedDuration || 0) * selectedVehicle.per_minute_rate).toFixed(2)}</span></div>
                    {surgeMultiplier > 1.0 && (
                      <div className="flex justify-between text-orange-500">
                        <span>⚡ Surge ({quotes[selectedVehicle.id]?.surge_multiplier ?? surgeMultiplier}x)</span>
                        <span className="font-medium">+R{(quotes[selectedVehicle.id]?.surge_amount ?? (estimatedFare || 0) - (estimatedFare || 0) / surgeMultiplier).toFixed(2)}</span>
                      </div>
                    )}
                    {!!quotes[selectedVehicle.id]?.fuel_surcharge && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fuel adjustment</span>
                        <span className="font-medium text-foreground">
                          {quotes[selectedVehicle.id].fuel_surcharge > 0 ? "+" : "−"}R{Math.abs(quotes[selectedVehicle.id].fuel_surcharge).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold"><span className="text-foreground">Estimated Total</span><span className="text-foreground">R{estimatedFare?.toFixed(2) || calculateFare(selectedVehicle).toFixed(2)}</span></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── COLUMN 3: Live Map (1/3) ─── */}
      <div className="lg:w-1/3 lg:min-h-screen bg-muted/30 flex flex-col">
        <div className="hidden lg:flex items-center gap-2 px-6 py-4 border-b border-border bg-background">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Live Map</h2>
        </div>

        <div className="flex-1 relative">
          <GoogleMap
            className="w-full h-[35vh] lg:h-full"
            markers={mapMarkers}
            route={mapRoute}
            center={pickupCoords || { lat: -26.2041, lng: 28.0473 }}
            zoom={pickupCoords ? 14 : 12}
          />
        </div>
      </div>
    </div>
  );
};

export default RideRequestPage;

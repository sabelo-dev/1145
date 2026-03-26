import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, MapPin, Navigation, Car, Crown, Users, Clock, Wallet,
  Locate, Loader2, ChevronRight, Shield, Zap, Route, Star, Sparkles,
  CircleDot, Play, CreditCard,
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

const RideRequestPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
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
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false, timeout: 15000, maximumAge: 300000,
        });
      }).catch(() => {
        return new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false, timeout: 20000, maximumAge: 600000,
          });
        });
      });

      const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      const fallbackAddress = `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
      setPickupCoords(coords);
      setPickup(fallbackAddress);

      try {
        await loadGoogleMaps();
        const geocoder = new google.maps.Geocoder();
        const result = await geocoder.geocode({ location: coords });
        if (result.results?.[0]) setPickup(result.results[0].formatted_address);
      } catch {}
    } catch {
      toast({ title: "Location unavailable", description: "Please enter your pickup location manually.", variant: "destructive" });
    } finally {
      setIsLocating(false);
    }
  }, [toast]);

  useEffect(() => {
    if ("geolocation" in navigator && !pickupCoords) detectAndSetPickup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pickupCoords && dropoffCoords && step === "location") handleSearchRides();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupCoords, dropoffCoords]);

  const fetchVehicleTypes = async () => {
    const { data } = await supabase.from("vehicle_types").select("*").eq("is_active", true).order("base_fare", { ascending: true });
    if (data) setVehicleTypes(data);
  };

  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      await loadGoogleMaps();
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ address });
      const loc = result.results?.[0]?.geometry?.location;
      if (loc) return { lat: loc.lat(), lng: loc.lng() };
    } catch {}
    return null;
  };

  const handleSearchRides = async () => {
    let pCoords = pickupCoords;
    let dCoords = dropoffCoords;
    if (!pCoords && pickup) { pCoords = await geocodeAddress(pickup); if (pCoords) setPickupCoords(pCoords); }
    if (!dCoords && dropoff) { dCoords = await geocodeAddress(dropoff); if (dCoords) setDropoffCoords(dCoords); }
    if (!pCoords || !dCoords) {
      toast({ variant: "destructive", title: "Please select both locations from the suggestions" });
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
        const d = haversineKm(pCoords, dCoords);
        setEstimatedDistance(Math.round(d * 10) / 10);
        setEstimatedDuration(Math.round(d * 2.5 + 5));
      }
    } catch {
      const d = haversineKm(pCoords, dCoords);
      setEstimatedDistance(Math.round(d * 10) / 10);
      setEstimatedDuration(Math.round(d * 2.5 + 5));
    }
    setIsSearching(false);
    setStep("vehicle");
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
    const fare = type.base_fare + estimatedDistance * type.per_km_rate + estimatedDuration * type.per_minute_rate;
    return Math.max(fare, type.minimum_fare);
  };

  const handleSelectVehicle = (typeId: string) => {
    setSelectedType(typeId);
    const type = vehicleTypes.find((t) => t.id === typeId);
    if (type) setEstimatedFare(Math.round(calculateFare(type) * 100) / 100);
    setStep("confirm");
  };

  const handleRequestRide = async () => {
    if (!user) { toast({ variant: "destructive", title: "Please log in to request a ride" }); navigate("/login"); return; }
    if (!selectedType || !estimatedFare || !pickupCoords || !dropoffCoords) return;
    setIsRequesting(true);
    try {
      const { data, error } = await supabase.from("rides").insert({
        passenger_id: user.id, vehicle_type_id: selectedType,
        pickup_address: pickup, dropoff_address: dropoff,
        pickup_lat: pickupCoords.lat, pickup_lng: pickupCoords.lng,
        dropoff_lat: dropoffCoords.lat, dropoff_lng: dropoffCoords.lng,
        estimated_distance_km: estimatedDistance, estimated_duration_minutes: estimatedDuration,
        estimated_fare: estimatedFare, status: "requested", payment_method: "wallet",
      }).select().single();
      if (error) throw error;
      toast({ title: "Ride Requested!", description: "Looking for nearby drivers..." });
      navigate(`/rides/track/${data.id}`);
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

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Mobile: Top bar */}
      <div className="lg:hidden flex items-center justify-between px-4 pt-4 pb-2 bg-background z-20">
        <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-base font-bold text-foreground">Request a Ride</h1>
        <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">● Live</span>
        </div>
      </div>

      {/* ─── COLUMN 1: Request Form (1/3) ─── */}
      <div className="lg:w-1/3 lg:min-h-screen lg:border-r border-border bg-card flex flex-col">
        {/* Desktop header */}
        <div className="hidden lg:flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center hover:bg-accent transition-colors">
              <ArrowLeft className="h-4 w-4 text-foreground" />
            </button>
            <h1 className="text-lg font-bold text-foreground">Request a Ride</h1>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">● Live</span>
          </div>
        </div>

        <div className="flex-1 p-5 space-y-5 overflow-y-auto">
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
                  onPlaceSelect={(p) => { setDropoff(p.address); setDropoffCoords({ lat: p.lat, lng: p.lng }); }}
                  placeholder="Where to?"
                />
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
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Pickup</p>
                        <p className="text-xs font-medium text-foreground truncate">{pickup}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                        <Navigation className="h-3.5 w-3.5 text-destructive" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Drop-off</p>
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
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                        <p className="text-[11px] font-bold text-foreground">{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">Wallet</p>
                        <p className="text-[10px] text-muted-foreground">Payment method</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black tracking-tighter text-foreground">R{estimatedFare.toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">estimated</p>
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
                {isRequesting ? (<><Loader2 className="h-5 w-5 animate-spin" />Finding your driver...</>) : (<><Shield className="h-5 w-5" />Confirm & Request Ride</>)}
              </button>
              <p className="text-center text-[10px] text-muted-foreground">By requesting, you agree to our terms. Fare may vary.</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── COLUMN 2: Pricing Options (1/3) ─── */}
      <div className="lg:w-1/3 lg:min-h-screen lg:border-r border-border bg-background flex flex-col">
        <div className="hidden lg:flex items-center gap-2 px-6 py-4 border-b border-border">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Ride Options</h2>
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
              {/* Mobile header */}
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
                        {isCheapest && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase">Popular</span>}
                        {isPremium && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-secondary/15 text-secondary-foreground uppercase">Premium</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />{type.max_passengers}</span>
                        {estimatedDuration && <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />~{estimatedDuration} min</span>}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-lg font-black text-foreground">R{fare.toFixed(0)}</p>
                      <p className="text-[10px] text-muted-foreground">est. fare</p>
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

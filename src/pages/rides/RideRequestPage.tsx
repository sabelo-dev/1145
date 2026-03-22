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

  const detectAndSetPickup = useCallback(async () => {
    setIsLocating(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 300000,
        });
      }).catch(() => {
        return new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 20000,
            maximumAge: 600000,
          });
        });
      });

      const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      setPickupCoords(coords);

      try {
        await loadGoogleMaps();
        const geocoder = new google.maps.Geocoder();
        const result = await geocoder.geocode({ location: coords });
        if (result.results?.[0]) {
          setPickup(result.results[0].formatted_address);
        } else {
          setPickup(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
        }
      } catch {
        setPickup(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
      }
    } catch (err: any) {
      console.warn("Location detection failed:", err.message);
      toast({
        title: "Location unavailable",
        description: "Please enter your pickup location manually.",
        variant: "destructive",
      });
    } finally {
      setIsLocating(false);
    }
  }, [toast]);

  useEffect(() => {
    if ("geolocation" in navigator && !pickupCoords) {
      detectAndSetPickup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pickupCoords && dropoffCoords && step === "location") {
      handleSearchRides();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupCoords, dropoffCoords]);

  const fetchVehicleTypes = async () => {
    const { data } = await supabase
      .from("vehicle_types")
      .select("*")
      .eq("is_active", true)
      .order("base_fare", { ascending: true });
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

    if (!pCoords && pickup) {
      pCoords = await geocodeAddress(pickup);
      if (pCoords) setPickupCoords(pCoords);
    }
    if (!dCoords && dropoff) {
      dCoords = await geocodeAddress(dropoff);
      if (dCoords) setDropoffCoords(dCoords);
    }

    if (!pCoords || !dCoords) {
      toast({ variant: "destructive", title: "Please select both locations from the suggestions" });
      return;
    }
    setIsSearching(true);
    await fetchVehicleTypes();

    try {
      const service = new google.maps.DistanceMatrixService();
      const result = await service.getDistanceMatrix({
        origins: [pCoords],
        destinations: [dCoords],
        travelMode: google.maps.TravelMode.DRIVING,
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
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
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
    if (!user) {
      toast({ variant: "destructive", title: "Please log in to request a ride" });
      navigate("/login");
      return;
    }
    if (!selectedType || !estimatedFare || !pickupCoords || !dropoffCoords) return;

    setIsRequesting(true);
    try {
      const { data, error } = await supabase
        .from("rides")
        .insert({
          passenger_id: user.id,
          vehicle_type_id: selectedType,
          pickup_address: pickup,
          dropoff_address: dropoff,
          pickup_lat: pickupCoords.lat,
          pickup_lng: pickupCoords.lng,
          dropoff_lat: dropoffCoords.lat,
          dropoff_lng: dropoffCoords.lng,
          estimated_distance_km: estimatedDistance,
          estimated_duration_minutes: estimatedDuration,
          estimated_fare: estimatedFare,
          status: "requested",
          payment_method: "wallet",
        })
        .select()
        .single();

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

  const mapRoute =
    pickupCoords && dropoffCoords && step !== "location"
      ? { origin: pickupCoords, destination: dropoffCoords }
      : undefined;

  const selectedVehicle = vehicleTypes.find((t) => t.id === selectedType);

  return (
    <div className="min-h-screen bg-[hsl(222,30%,6%)] text-white relative overflow-hidden">
      {/* Cinematic Map Hero */}
      <div className="relative">
        <GoogleMap
          className="w-full h-[44vh] md:h-[48vh]"
          markers={mapMarkers}
          route={mapRoute}
          center={pickupCoords || { lat: -26.2041, lng: 28.0473 }}
          zoom={pickupCoords ? 14 : 12}
        />
        {/* Cinematic gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(222,30%,6%)]/70 via-transparent to-[hsl(222,30%,6%)] pointer-events-none" />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-4">
          <button
            onClick={() => navigate(-1)}
            className="h-11 w-11 rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <div className="px-4 py-2 rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 shadow-lg">
              <span className="text-xs font-bold tracking-widest uppercase text-primary">Live</span>
            </div>
          </div>
        </div>

        {/* Floating trip stats */}
        {estimatedDistance && estimatedDuration && step !== "location" && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 animate-fade-in">
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-card/90 backdrop-blur-xl shadow-2xl border border-border/30">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10">
                <Route className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground">{estimatedDistance} km</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary/10">
                <Clock className="h-4 w-4 text-secondary" />
                <span className="text-sm font-bold text-foreground">~{estimatedDuration} min</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sheet — cinematic card */}
      <div className="relative -mt-8 rounded-t-[2rem] bg-card border-t border-border/50 shadow-[0_-16px_48px_-12px_hsl(var(--foreground)/0.15)] min-h-[52vh]">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/15" />
        </div>

        <div className="px-5 pb-10 max-w-lg mx-auto space-y-5">
          {/* Location Inputs — cinematic style */}
          <div className="space-y-0">
            <div className="flex items-stretch gap-3">
              {/* Animated route line */}
              <div className="flex flex-col items-center py-4 gap-0.5">
                <div className="relative">
                  <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.5)]" />
                  <div className="absolute inset-0 w-3 h-3 rounded-full bg-primary animate-ping opacity-30" />
                </div>
                <div className="flex-1 w-0.5 bg-gradient-to-b from-primary via-muted-foreground/20 to-destructive my-1 rounded-full" />
                <div className="w-3 h-3 rounded-sm bg-destructive shadow-[0_0_12px_hsl(var(--destructive)/0.4)] rotate-45" />
              </div>

              <div className="flex-1 space-y-2.5">
                {/* Pickup */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <PlacesAutocomplete
                      value={pickup}
                      onChange={setPickup}
                      onPlaceSelect={(p) => {
                        setPickup(p.address);
                        setPickupCoords({ lat: p.lat, lng: p.lng });
                      }}
                      placeholder={isLocating ? "Detecting location..." : "Pickup location"}
                    />
                  </div>
                  <button
                    onClick={detectAndSetPickup}
                    disabled={isLocating}
                    className="h-11 w-11 shrink-0 flex items-center justify-center rounded-2xl bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-all duration-200 disabled:opacity-50 hover:scale-105 active:scale-95"
                    title="Use current location"
                  >
                    {isLocating ? (
                      <Loader2 className="h-4.5 w-4.5 animate-spin text-primary" />
                    ) : (
                      <Locate className="h-4.5 w-4.5 text-primary" />
                    )}
                  </button>
                </div>

                {/* Dropoff */}
                <PlacesAutocomplete
                  value={dropoff}
                  onChange={setDropoff}
                  onPlaceSelect={(p) => {
                    setDropoff(p.address);
                    setDropoffCoords({ lat: p.lat, lng: p.lng });
                  }}
                  placeholder="Where to?"
                />
              </div>
            </div>

            {/* Find Rides CTA */}
            {step === "location" && (
              <div className="pt-4">
                <Button
                  className="w-full h-14 rounded-2xl text-base font-bold shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:shadow-2xl"
                  onClick={handleSearchRides}
                  disabled={isSearching || !pickup || !dropoff}
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2.5" />
                      <span>Scanning nearby drivers...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5 mr-2.5 fill-current" />
                      <span>Find Rides</span>
                    </>
                  )}
                </Button>
                {!pickupCoords && !dropoffCoords && (
                  <p className="text-center text-xs text-muted-foreground mt-3">
                    Enter pickup & destination to get started
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Vehicle Selection — Netflix-style horizontal cards */}
          {step === "vehicle" && vehicleTypes.length > 0 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-secondary" />
                  <h2 className="text-lg font-bold tracking-tight text-foreground">Select Ride</h2>
                </div>
                <button
                  onClick={() => { setStep("location"); setSelectedType(null); }}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Edit route
                </button>
              </div>

              <div className="space-y-2.5">
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
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 text-left group relative overflow-hidden
                        ${isSelected
                          ? "border-primary bg-primary/5 shadow-lg shadow-primary/10 scale-[1.01]"
                          : "border-border/50 hover:border-primary/40 hover:bg-accent/30 hover:shadow-md hover:scale-[1.01]"
                        }`}
                    >
                      {/* Subtle shine effect */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent" />
                      )}

                      <div className={`relative p-3.5 rounded-2xl transition-all duration-300 ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                          : isPremium
                            ? "bg-secondary/15 text-secondary group-hover:bg-secondary/25"
                            : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                      }`}>
                        <Icon className="h-6 w-6" />
                      </div>

                      <div className="flex-1 min-w-0 relative">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{type.display_name}</span>
                          {isCheapest && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wider">
                              Popular
                            </span>
                          )}
                          {isPremium && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/15 text-secondary uppercase tracking-wider">
                              Premium
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" /> {type.max_passengers}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> ~{estimatedDuration} min
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0 relative">
                        <p className="text-xl font-black tracking-tight text-foreground">
                          R{fare.toFixed(0)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">est. fare</p>
                      </div>

                      <ChevronRight className={`h-5 w-5 shrink-0 transition-all duration-300 ${
                        isSelected ? "text-primary translate-x-0.5" : "text-muted-foreground/30 group-hover:text-muted-foreground"
                      }`} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Confirmation — cinematic summary */}
          {step === "confirm" && estimatedFare && selectedVehicle && (
            <div className="space-y-4 animate-fade-in">
              <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-lg">
                {/* Header with gradient */}
                <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CircleDot className="h-4 w-4 text-primary" />
                    <h2 className="text-base font-bold tracking-tight text-foreground">Trip Summary</h2>
                  </div>
                  <button
                    onClick={() => setStep("vehicle")}
                    className="text-xs font-semibold text-primary hover:underline transition-colors"
                  >
                    Change
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  {/* Route */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Pickup</p>
                        <p className="text-sm font-medium text-foreground truncate mt-0.5">{pickup}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                        <Navigation className="h-4 w-4 text-destructive" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Drop-off</p>
                        <p className="text-sm font-medium text-foreground truncate mt-0.5">{dropoff}</p>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-border/50" />

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Vehicle", value: selectedVehicle.display_name, icon: Car },
                      { label: "Distance", value: `${estimatedDistance} km`, icon: Route },
                      { label: "ETA", value: `~${estimatedDuration} min`, icon: Clock },
                    ].map((stat) => (
                      <div key={stat.label} className="text-center p-3 rounded-xl bg-muted/50 border border-border/30">
                        <stat.icon className="h-4 w-4 mx-auto text-muted-foreground mb-1.5" />
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{stat.label}</p>
                        <p className="text-xs font-bold text-foreground mt-0.5">{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  <Separator className="bg-border/50" />

                  {/* Payment & Fare */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Wallet</p>
                        <p className="text-[10px] text-muted-foreground">Payment method</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black tracking-tighter text-foreground">
                        R{estimatedFare.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-medium">estimated</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <Button
                className="w-full h-[3.5rem] rounded-2xl text-base font-bold shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:shadow-2xl"
                onClick={handleRequestRide}
                disabled={isRequesting}
              >
                {isRequesting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2.5" />
                    Finding your driver...
                  </>
                ) : (
                  <>
                    <Shield className="h-5 w-5 mr-2.5" />
                    Confirm & Request Ride
                  </>
                )}
              </Button>

              <p className="text-center text-[11px] text-muted-foreground/70">
                By requesting, you agree to our terms. Fare may vary based on traffic.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RideRequestPage;

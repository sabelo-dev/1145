import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, MapPin, Navigation, Car, Crown, Users, Clock, Wallet,
  Locate, Loader2, ChevronRight, Shield, Zap, Route,
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

  const handleSearchRides = async () => {
    if (!pickupCoords || !dropoffCoords) {
      toast({ variant: "destructive", title: "Please select both locations from the suggestions" });
      return;
    }
    setIsSearching(true);
    await fetchVehicleTypes();

    try {
      const service = new google.maps.DistanceMatrixService();
      const result = await service.getDistanceMatrix({
        origins: [pickupCoords],
        destinations: [dropoffCoords],
        travelMode: google.maps.TravelMode.DRIVING,
      });

      const element = result.rows[0]?.elements[0];
      if (element?.status === "OK") {
        setEstimatedDistance(Math.round((element.distance!.value / 1000) * 10) / 10);
        setEstimatedDuration(Math.round(element.duration!.value / 60));
      } else {
        const d = haversineKm(pickupCoords, dropoffCoords);
        setEstimatedDistance(Math.round(d * 10) / 10);
        setEstimatedDuration(Math.round(d * 2.5 + 5));
      }
    } catch {
      const d = haversineKm(pickupCoords, dropoffCoords);
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
    <div className="min-h-screen bg-background relative">
      {/* Full-bleed Map */}
      <div className="relative">
        <GoogleMap
          className="w-full h-[38vh] md:h-[42vh]"
          markers={mapMarkers}
          route={mapRoute}
          center={pickupCoords || { lat: -26.2041, lng: 28.0473 }}
          zoom={pickupCoords ? 14 : 12}
        />

        {/* Floating back button */}
        <div className="absolute top-4 left-4 z-10">
          <Button
            size="icon"
            variant="secondary"
            className="h-10 w-10 rounded-full shadow-lg bg-background/90 backdrop-blur-sm border border-border"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>

        {/* Trip info pill overlay */}
        {estimatedDistance && estimatedDuration && step !== "location" && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 animate-fade-in">
            <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-background/95 backdrop-blur-md shadow-lg border border-border">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Route className="h-3.5 w-3.5 text-primary" />
                <span>{estimatedDistance} km</span>
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>~{estimatedDuration} min</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sheet */}
      <div className="relative -mt-6 rounded-t-3xl bg-background border-t border-border shadow-[0_-8px_30px_-12px_hsl(var(--foreground)/0.1)] min-h-[56vh]">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        <div className="px-5 pb-8 max-w-lg mx-auto space-y-5">
          {/* Location Inputs */}
          <div className="space-y-0">
            <div className="flex items-stretch gap-3">
              {/* Route line indicator */}
              <div className="flex flex-col items-center py-4 gap-0.5">
                <div className="w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-primary/20" />
                <div className="flex-1 w-px bg-gradient-to-b from-primary/40 to-destructive/40 my-1" />
                <div className="w-2.5 h-2.5 rounded-full bg-destructive ring-2 ring-destructive/20" />
              </div>

              <div className="flex-1 space-y-2">
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
                    className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-primary/5 hover:bg-primary/10 border border-primary/10 transition-colors disabled:opacity-50"
                    title="Use current location"
                  >
                    {isLocating ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <Locate className="h-4 w-4 text-primary" />
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

            {/* Search button — only when in location step and not auto-searching */}
            {step === "location" && (
              <div className="pt-3">
                <Button
                  className="w-full h-12 rounded-2xl text-base font-semibold shadow-md"
                  onClick={handleSearchRides}
                  disabled={isSearching || !pickupCoords || !dropoffCoords}
                >
                  {isSearching ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Zap className="h-5 w-5 mr-2" />
                  )}
                  {isSearching ? "Finding rides..." : "Find Rides"}
                </Button>
              </div>
            )}
          </div>

          {/* Vehicle Selection */}
          {step === "vehicle" && vehicleTypes.length > 0 && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold tracking-tight">Choose your ride</h2>
                <Badge variant="secondary" className="rounded-full text-xs font-medium">
                  {vehicleTypes.length} available
                </Badge>
              </div>

              <div className="space-y-2">
                {vehicleTypes.map((type, index) => {
                  const Icon = vehicleIcons[type.icon] || Car;
                  const fare = Math.round(calculateFare(type) * 100) / 100;
                  const isSelected = selectedType === type.id;
                  const isCheapest = index === 0;

                  return (
                    <button
                      key={type.id}
                      onClick={() => handleSelectVehicle(type.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 text-left group
                        ${isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-sm"
                          : "border-border hover:border-primary/30 hover:bg-accent/50 hover:shadow-sm"
                        }`}
                    >
                      <div className={`p-3 rounded-xl transition-colors ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted group-hover:bg-primary/10"}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{type.display_name}</span>
                          {isCheapest && (
                            <Badge className="text-[10px] h-4 px-1.5 rounded-full bg-primary/10 text-primary border-0 font-semibold">
                              Best value
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {type.max_passengers} seats • ~{estimatedDuration} min
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold tracking-tight">R{fare.toFixed(2)}</p>
                      </div>
                      <ChevronRight className={`h-4 w-4 shrink-0 transition-colors ${isSelected ? "text-primary" : "text-muted-foreground/40"}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Confirmation */}
          {step === "confirm" && estimatedFare && selectedVehicle && (
            <div className="space-y-4 animate-fade-in">
              {/* Summary card */}
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold tracking-tight">Trip Summary</h2>
                  <button
                    onClick={() => setStep("vehicle")}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Change ride
                  </button>
                </div>

                {/* Route summary */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 rounded-lg bg-primary/10">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Pickup</p>
                      <p className="text-sm font-medium truncate">{pickup}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 rounded-lg bg-destructive/10">
                      <Navigation className="h-3.5 w-3.5 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Drop-off</p>
                      <p className="text-sm font-medium truncate">{dropoff}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Details grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-2.5 rounded-xl bg-muted/50">
                    <p className="text-xs text-muted-foreground">Vehicle</p>
                    <p className="text-sm font-semibold mt-0.5">{selectedVehicle.display_name}</p>
                  </div>
                  <div className="text-center p-2.5 rounded-xl bg-muted/50">
                    <p className="text-xs text-muted-foreground">Distance</p>
                    <p className="text-sm font-semibold mt-0.5">{estimatedDistance} km</p>
                  </div>
                  <div className="text-center p-2.5 rounded-xl bg-muted/50">
                    <p className="text-xs text-muted-foreground">ETA</p>
                    <p className="text-sm font-semibold mt-0.5">~{estimatedDuration} min</p>
                  </div>
                </div>

                <Separator />

                {/* Fare + Payment */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-muted">
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Wallet</p>
                      <p className="text-[10px] text-muted-foreground">Payment method</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black tracking-tight">R{estimatedFare.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">estimated fare</p>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <Button
                className="w-full h-14 rounded-2xl text-base font-bold shadow-lg"
                onClick={handleRequestRide}
                disabled={isRequesting}
              >
                {isRequesting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Finding your driver...
                  </>
                ) : (
                  <>
                    <Shield className="h-5 w-5 mr-2" />
                    Confirm & Request Ride
                  </>
                )}
              </Button>

              <p className="text-center text-[11px] text-muted-foreground">
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

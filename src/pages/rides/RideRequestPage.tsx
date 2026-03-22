import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Navigation, Car, Crown, Users, Clock, Wallet, Locate, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });

      const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      setPickupCoords(coords);

      // Reverse geocode to get address
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

  // Auto-detect location on mount
  useEffect(() => {
    if ("geolocation" in navigator && !pickupCoords) {
      detectAndSetPickup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    // Use Google Maps Distance Matrix for real distance/duration
    try {
      const service = new google.maps.DistanceMatrixService();
      const result = await service.getDistanceMatrix({
        origins: [pickupCoords],
        destinations: [dropoffCoords],
        travelMode: google.maps.TravelMode.DRIVING,
      });

      const element = result.rows[0]?.elements[0];
      if (element?.status === "OK") {
        const distKm = Math.round((element.distance!.value / 1000) * 10) / 10;
        const durMin = Math.round(element.duration!.value / 60);
        setEstimatedDistance(distKm);
        setEstimatedDuration(durMin);
      } else {
        // Fallback: haversine
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#3A0CA3] to-[#4361EE] text-white p-4">
        <div className="container mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Request a Ride</h1>
            <p className="text-white/70 text-sm">Get where you need to go</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-lg">
        {/* Map */}
        <GoogleMap
          className="w-full h-56 rounded-xl overflow-hidden mb-4 border border-border"
          markers={mapMarkers}
          route={mapRoute}
          center={pickupCoords || { lat: -26.2041, lng: 28.0473 }}
          zoom={pickupCoords ? 14 : 12}
        />

        {/* Location Input */}
        <Card className="mb-6">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center mt-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <div className="w-0.5 h-8 bg-border" />
                <div className="w-3 h-3 rounded-full bg-destructive" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">PICKUP</label>
                  <PlacesAutocomplete
                    value={pickup}
                    onChange={setPickup}
                    onPlaceSelect={(p) => {
                      setPickup(p.address);
                      setPickupCoords({ lat: p.lat, lng: p.lng });
                    }}
                    placeholder="Enter pickup location"
                    icon={<MapPin className="h-4 w-4 text-emerald-500" />}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">DROP-OFF</label>
                  <PlacesAutocomplete
                    value={dropoff}
                    onChange={setDropoff}
                    onPlaceSelect={(p) => {
                      setDropoff(p.address);
                      setDropoffCoords({ lat: p.lat, lng: p.lng });
                    }}
                    placeholder="Enter destination"
                    icon={<Navigation className="h-4 w-4 text-destructive" />}
                  />
                </div>
              </div>
            </div>
            {step === "location" && (
              <Button className="w-full" size="lg" onClick={handleSearchRides} disabled={isSearching || !pickupCoords || !dropoffCoords}>
                {isSearching ? "Finding rides..." : "Search Rides"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Trip estimate */}
        {estimatedDistance && estimatedDuration && step !== "location" && (
          <div className="flex items-center justify-center gap-6 mb-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              <span>{estimatedDistance} km</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>~{estimatedDuration} min</span>
            </div>
          </div>
        )}

        {/* Vehicle Selection */}
        {step === "vehicle" && vehicleTypes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Choose your ride</h2>
            {vehicleTypes.map((type) => {
              const Icon = vehicleIcons[type.icon] || Car;
              const fare = Math.round(calculateFare(type) * 100) / 100;
              return (
                <Card
                  key={type.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${selectedType === type.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => handleSelectVehicle(type.id)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-primary/10 rounded-xl">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{type.display_name}</h3>
                        <p className="text-xs text-muted-foreground">Up to {type.max_passengers} passengers</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">R{fare.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">est. fare</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Confirmation */}
        {step === "confirm" && estimatedFare && (
          <Card className="mt-4">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-semibold">Confirm your ride</h2>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">From</span>
                  <span className="font-medium text-right max-w-[60%] truncate">{pickup}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">To</span>
                  <span className="font-medium text-right max-w-[60%] truncate">{dropoff}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vehicle</span>
                  <span className="font-medium">{vehicleTypes.find((t) => t.id === selectedType)?.display_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Distance</span>
                  <span className="font-medium">{estimatedDistance} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. time</span>
                  <span className="font-medium">~{estimatedDuration} min</span>
                </div>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Wallet Payment</span>
                </div>
                <span className="text-2xl font-bold">R{estimatedFare.toFixed(2)}</span>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep("vehicle")}>
                  Back
                </Button>
                <Button className="flex-1" size="lg" onClick={handleRequestRide} disabled={isRequesting}>
                  {isRequesting ? "Requesting..." : "Request Ride"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default RideRequestPage;

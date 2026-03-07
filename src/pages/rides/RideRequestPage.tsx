import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Navigation, Car, Crown, Users, Clock, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
  const [vehicleTypes, setVehicleTypes] = useState<VehicleOption[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [step, setStep] = useState<'location' | 'vehicle' | 'confirm'>('location');

  const fetchVehicleTypes = async () => {
    const { data } = await supabase
      .from("vehicle_types")
      .select("*")
      .eq("is_active", true)
      .order("base_fare", { ascending: true });
    if (data) setVehicleTypes(data);
  };

  const handleSearchRides = async () => {
    if (!pickup.trim() || !dropoff.trim()) {
      toast({ variant: "destructive", title: "Please enter both pickup and drop-off locations" });
      return;
    }
    setIsSearching(true);
    await fetchVehicleTypes();
    // Simulated distance/duration - in production this would use Google Maps Distance Matrix API
    const mockDistance = Math.round((5 + Math.random() * 25) * 10) / 10;
    const mockDuration = Math.round(mockDistance * 2.5 + Math.random() * 10);
    setEstimatedDistance(mockDistance);
    setEstimatedDuration(mockDuration);
    setIsSearching(false);
    setStep('vehicle');
  };

  const calculateFare = (type: VehicleOption) => {
    if (!estimatedDistance || !estimatedDuration) return type.minimum_fare;
    const fare = type.base_fare + (estimatedDistance * type.per_km_rate) + (estimatedDuration * type.per_minute_rate);
    return Math.max(fare, type.minimum_fare);
  };

  const handleSelectVehicle = (typeId: string) => {
    setSelectedType(typeId);
    const type = vehicleTypes.find(t => t.id === typeId);
    if (type) {
      setEstimatedFare(Math.round(calculateFare(type) * 100) / 100);
    }
    setStep('confirm');
  };

  const handleRequestRide = async () => {
    if (!user) {
      toast({ variant: "destructive", title: "Please log in to request a ride" });
      navigate("/login");
      return;
    }
    if (!selectedType || !estimatedFare) return;

    setIsRequesting(true);
    try {
      const { data, error } = await supabase.from("rides").insert({
        passenger_id: user.id,
        vehicle_type_id: selectedType,
        pickup_address: pickup,
        dropoff_address: dropoff,
        estimated_distance_km: estimatedDistance,
        estimated_duration_minutes: estimatedDuration,
        estimated_fare: estimatedFare,
        status: "requested",
        payment_method: "wallet",
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
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                    <Input
                      placeholder="Enter pickup location"
                      value={pickup}
                      onChange={e => setPickup(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">DROP-OFF</label>
                  <div className="relative">
                    <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                    <Input
                      placeholder="Enter destination"
                      value={dropoff}
                      onChange={e => setDropoff(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </div>
            {step === 'location' && (
              <Button className="w-full" size="lg" onClick={handleSearchRides} disabled={isSearching}>
                {isSearching ? "Finding rides..." : "Search Rides"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Trip estimate */}
        {estimatedDistance && estimatedDuration && step !== 'location' && (
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
        {step === 'vehicle' && vehicleTypes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Choose your ride</h2>
            {vehicleTypes.map(type => {
              const Icon = vehicleIcons[type.icon] || Car;
              const fare = Math.round(calculateFare(type) * 100) / 100;
              return (
                <Card
                  key={type.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${selectedType === type.id ? 'ring-2 ring-primary' : ''}`}
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
        {step === 'confirm' && estimatedFare && (
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
                  <span className="font-medium">{vehicleTypes.find(t => t.id === selectedType)?.display_name}</span>
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
                <Button variant="outline" className="flex-1" onClick={() => setStep('vehicle')}>
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

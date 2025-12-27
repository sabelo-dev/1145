import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  MapPin,
  DollarSign,
  Clock,
  Navigation,
  RefreshCw,
  Zap,
  TrendingUp,
  Target,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { matchingEngine, type MatchResult } from "@/services/matchingEngine";
import { pricingEngine } from "@/services/pricingEngine";
import { trackingService } from "@/services/trackingService";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { GeoLocation } from "@/services/driverService";

interface DriverJobMatchingProps {
  driver: {
    id: string;
    name: string;
    status: string;
  } | null;
  onJobClaimed: () => void;
}

const DriverJobMatching: React.FC<DriverJobMatchingProps> = ({ driver, onJobClaimed }) => {
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [maxDistance, setMaxDistance] = useState(15);
  const [surgeInfo, setSurgeInfo] = useState<{ multiplier: number; status: string; color: string } | null>(null);
  const [loadBalanceInfo, setLoadBalanceInfo] = useState<{ availableDrivers: number; pendingJobs: number } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<GeoLocation | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchSurgeInfo();
    fetchLoadBalanceInfo();
    getLocation();
  }, []);

  const getLocation = async () => {
    const location = await trackingService.getCurrentPosition();
    if (location) {
      setCurrentLocation(location);
      findMatches(location);
    }
  };

  const fetchSurgeInfo = async () => {
    const info = await pricingEngine.getSurgeInfo();
    setSurgeInfo(info);
  };

  const fetchLoadBalanceInfo = async () => {
    const info = await matchingEngine.getLoadBalanceInfo();
    setLoadBalanceInfo(info);
  };

  const findMatches = async (location: GeoLocation) => {
    setLoading(true);
    try {
      const results = await matchingEngine.findNearbyJobs(location, maxDistance);
      setMatches(results);
    } catch (error) {
      console.error("Error finding matches:", error);
    }
    setLoading(false);
  };

  const refreshMatches = async () => {
    await fetchSurgeInfo();
    await fetchLoadBalanceInfo();
    if (currentLocation) {
      await findMatches(currentLocation);
    } else {
      await getLocation();
    }
  };

  const claimJob = async (jobId: string) => {
    if (!driver) return;

    if (driver.status === "pending") {
      toast({
        variant: "destructive",
        title: "Cannot Claim Job",
        description: "Your driver account is still pending approval.",
      });
      return;
    }

    if (driver.status === "offline") {
      toast({
        variant: "destructive",
        title: "Cannot Claim Job",
        description: "Please go online to claim jobs.",
      });
      return;
    }

    setClaiming(jobId);

    const { error } = await supabase
      .from("delivery_jobs")
      .update({
        driver_id: driver.id,
        status: "accepted",
      })
      .eq("id", jobId)
      .eq("status", "pending")
      .is("driver_id", null);

    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to Claim",
        description: "This job may have been claimed by another driver.",
      });
    } else {
      toast({
        title: "Job Claimed!",
        description: "You have successfully claimed this delivery.",
      });
      onJobClaimed();
      refreshMatches();
    }

    setClaiming(null);
  };

  const getSurgeColor = (color: string) => {
    switch (color) {
      case "red": return "bg-red-500";
      case "orange": return "bg-orange-500";
      case "yellow": return "bg-amber-500";
      default: return "bg-green-500";
    }
  };

  const formatAddress = (address: any) => {
    if (!address) return "Address not available";
    if (typeof address === "string") return address;
    return `${address.street || ""}, ${address.city || ""}`.trim();
  };

  const openGoogleMaps = (address: any) => {
    let addressString = "";
    if (typeof address === "string") {
      addressString = address;
    } else if (address) {
      addressString = [
        address.street,
        address.city,
        address.province,
        address.postal_code,
      ].filter(Boolean).join(", ");
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressString)}`;
    window.open(url, "_blank");
  };

  if (!driver) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Smart Job Matching</h2>
        <Button variant="outline" onClick={refreshMatches} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Surge & Load Balance Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {surgeInfo && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${getSurgeColor(surgeInfo.color)}`}>
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">{surgeInfo.status}</p>
                    <p className="text-sm text-muted-foreground">Surge Pricing Active</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-lg font-bold">
                  {surgeInfo.multiplier}x
                </Badge>
              </div>
              {surgeInfo.multiplier > 1 && (
                <p className="text-sm text-green-600 mt-3">
                  +{Math.round((surgeInfo.multiplier - 1) * 100)}% extra earnings on deliveries!
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {loadBalanceInfo && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Market Status</p>
                  <p className="text-sm text-muted-foreground">
                    {loadBalanceInfo.pendingJobs} jobs available • {loadBalanceInfo.availableDrivers} drivers online
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Distance Filter */}
      <Card>
        <CardContent className="pt-6">
          <Label>Maximum Pickup Distance: {maxDistance} km</Label>
          <Slider
            value={[maxDistance]}
            onValueChange={(value) => setMaxDistance(value[0])}
            min={1}
            max={30}
            step={1}
            className="mt-3"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>1 km</span>
            <span>30 km</span>
          </div>
        </CardContent>
      </Card>

      {/* Location Warning */}
      {!currentLocation && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Location Required
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Enable location services to find nearby jobs optimized for your position.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={getLocation}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Get My Location
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Matched Jobs */}
      {matches.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Nearby Jobs</h3>
              <p className="text-sm text-muted-foreground">
                No deliveries found within {maxDistance}km of your location.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {matches.map((match, index) => (
            <Card
              key={match.job.id}
              className={`hover:shadow-md transition-shadow ${index === 0 ? "border-2 border-primary" : ""}`}
            >
              {index === 0 && (
                <div className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Best Match for You
                </div>
              )}
              <CardContent className={index === 0 ? "pt-4" : "pt-6"}>
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Pickup */}
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                        <MapPin className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">Pickup</p>
                          <Badge variant="outline" className="text-xs">
                            {match.distance_to_pickup.toFixed(1)} km away
                          </Badge>
                        </div>
                        <p className="font-medium">{formatAddress(match.job.pickup_address)}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-green-600"
                          onClick={() => openGoogleMaps(match.job.pickup_address)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Map
                        </Button>
                      </div>
                    </div>

                    {/* Delivery */}
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                        <Navigation className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Deliver to</p>
                        <p className="font-medium">{formatAddress(match.job.delivery_address)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Stats & Actions */}
                  <div className="flex flex-col items-end gap-3 min-w-[140px]">
                    <div className="flex flex-wrap gap-2 justify-end">
                      {match.job.distance_km && (
                        <Badge variant="outline">
                          {match.job.distance_km.toFixed(1)} km total
                        </Badge>
                      )}
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        ~{match.estimated_time_mins} min
                      </Badge>
                    </div>

                    {match.job.earnings && (
                      <div className="text-right">
                        <Badge className="bg-green-500 text-lg px-3 py-1">
                          <DollarSign className="h-4 w-4 mr-1" />
                          R{match.job.earnings.toFixed(2)}
                        </Badge>
                        {match.surge_multiplier > 1 && (
                          <p className="text-xs text-green-600 mt-1">
                            Includes {Math.round((match.surge_multiplier - 1) * 100)}% surge
                          </p>
                        )}
                      </div>
                    )}

                    <Button
                      onClick={() => claimJob(match.job.id)}
                      disabled={claiming === match.job.id || driver.status === "pending" || driver.status === "offline"}
                      className="w-full"
                    >
                      {claiming === match.job.id ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Claiming...
                        </>
                      ) : (
                        "Claim Job"
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DriverJobMatching;

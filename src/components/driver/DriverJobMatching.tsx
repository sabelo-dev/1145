import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  MapPin, DollarSign, Clock, Navigation, RefreshCw, Zap, TrendingUp, Target, AlertTriangle, ExternalLink, Route, Loader2, Crown,
} from "lucide-react";
import { matchingEngine, type MatchResult } from "@/services/matchingEngine";
import { pricingEngine } from "@/services/pricingEngine";
import { trackingService } from "@/services/trackingService";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { GeoLocation } from "@/services/driverService";

interface DriverJobMatchingProps {
  driver: { id: string; name: string; status: string } | null;
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

  const fetchSurgeInfo = useCallback(async () => {
    const info = await pricingEngine.getSurgeInfo();
    setSurgeInfo(info);
  }, []);

  const fetchLoadBalanceInfo = useCallback(async () => {
    const info = await matchingEngine.getLoadBalanceInfo();
    setLoadBalanceInfo(info);
  }, []);

  const findMatches = useCallback(async (location: GeoLocation) => {
    setLoading(true);
    try {
      const results = await matchingEngine.findNearbyJobs(location, maxDistance);
      setMatches(results);
    } catch (error) {
      console.error("Error finding matches:", error);
    }
    setLoading(false);
  }, [maxDistance]);

  const getLocation = useCallback(async () => {
    const location = await trackingService.getCurrentPosition();
    if (location) {
      setCurrentLocation(location);
      findMatches(location);
    }
  }, [findMatches]);

  useEffect(() => {
    fetchSurgeInfo();
    fetchLoadBalanceInfo();
    getLocation();
  }, []);

  const refreshMatches = async () => {
    await fetchSurgeInfo();
    await fetchLoadBalanceInfo();
    if (currentLocation) await findMatches(currentLocation);
    else await getLocation();
  };

  const claimJob = async (jobId: string) => {
    if (!driver) return;
    if (driver.status === "pending") { toast({ variant: "destructive", title: "Cannot Claim", description: "Account still pending approval." }); return; }
    if (driver.status === "offline") { toast({ variant: "destructive", title: "Cannot Claim", description: "Go online to claim jobs." }); return; }

    setClaiming(jobId);
    const { error } = await supabase
      .from("delivery_jobs")
      .update({ driver_id: driver.id, status: "accepted" })
      .eq("id", jobId).eq("status", "pending").is("driver_id", null);

    if (error) {
      toast({ variant: "destructive", title: "Failed to Claim", description: "Job may have been claimed by another driver." });
    } else {
      toast({ title: "Job Claimed!", description: "Successfully claimed this delivery." });
      onJobClaimed();
      refreshMatches();
    }
    setClaiming(null);
  };

  const getSurgeColor = (color: string) => {
    switch (color) {
      case "red": return "from-red-500 to-red-600";
      case "orange": return "from-orange-500 to-orange-600";
      case "yellow": return "from-amber-400 to-amber-500";
      default: return "from-emerald-500 to-emerald-600";
    }
  };

  const formatAddress = (address: any) => {
    if (!address) return "Address not available";
    if (typeof address === "string") return address;
    return `${address.street || ""}, ${address.city || ""}`.trim();
  };

  const openGoogleMaps = (address: any) => {
    const str = typeof address === "string" ? address : [address?.street, address?.city, address?.province, address?.postal_code].filter(Boolean).join(", ");
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(str)}`, "_blank");
  };

  if (!driver) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Smart Matching</h2>
        <Button variant="ghost" size="sm" onClick={refreshMatches} disabled={loading} className="rounded-xl">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      {/* Surge & Market */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {surgeInfo && (
          <Card className="overflow-hidden border-0 ring-1 ring-border">
            <div className={`h-1 bg-gradient-to-r ${getSurgeColor(surgeInfo.color)}`} />
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${getSurgeColor(surgeInfo.color)} shadow-sm`}>
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{surgeInfo.status}</p>
                    <p className="text-xs text-muted-foreground">Surge Pricing</p>
                  </div>
                </div>
                <span className="text-2xl font-black tracking-tight">{surgeInfo.multiplier}x</span>
              </div>
              {surgeInfo.multiplier > 1 && (
                <p className="text-xs text-emerald-600 font-medium mt-2.5 pl-[52px]">
                  +{Math.round((surgeInfo.multiplier - 1) * 100)}% extra earnings!
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {loadBalanceInfo && (
          <Card className="border-0 ring-1 ring-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Market Status</p>
                  <p className="text-xs text-muted-foreground">
                    {loadBalanceInfo.pendingJobs} jobs • {loadBalanceInfo.availableDrivers} drivers
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Distance filter */}
      <Card className="border-0 ring-1 ring-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-medium">Pickup distance</Label>
            <Badge variant="secondary" className="rounded-full font-mono">{maxDistance} km</Badge>
          </div>
          <Slider value={[maxDistance]} onValueChange={(v) => setMaxDistance(v[0])} min={1} max={30} step={1} />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5"><span>1 km</span><span>30 km</span></div>
        </CardContent>
      </Card>

      {/* Location warning */}
      {!currentLocation && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">Location Required</p>
                <p className="text-xs text-muted-foreground mt-0.5">Enable location services to find nearby jobs.</p>
                <Button variant="outline" size="sm" className="mt-2 rounded-xl h-8" onClick={getLocation}>
                  <MapPin className="h-3.5 w-3.5 mr-1.5" />Get My Location
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Matches */}
      {matches.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center py-16">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-4">
              <MapPin className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No Nearby Jobs</h3>
            <p className="text-sm text-muted-foreground">No deliveries found within {maxDistance}km of your location.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {matches.map((match, index) => (
            <Card
              key={match.job.id}
              className={`overflow-hidden border-0 ring-1 hover:shadow-lg transition-all duration-200 ${index === 0 ? "ring-2 ring-primary/40 shadow-md" : "ring-border hover:ring-primary/20"}`}
            >
              {index === 0 && (
                <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-xs font-semibold px-4 py-1.5 flex items-center gap-1.5">
                  <Crown className="h-3.5 w-3.5" />Best Match
                </div>
              )}
              <CardContent className="p-4 space-y-3">
                {/* Route */}
                <div className="relative space-y-2">
                  <div className="absolute left-[15px] top-[28px] bottom-[28px] w-px border-l-2 border-dashed border-muted-foreground/20" />

                  <div className="flex items-start gap-3">
                    <div className="relative z-10 p-1.5 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Pickup</p>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 rounded-full">{match.distance_to_pickup.toFixed(1)} km away</Badge>
                      </div>
                      <p className="font-medium text-sm truncate">{formatAddress(match.job.pickup_address)}</p>
                      <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] text-emerald-600" onClick={() => openGoogleMaps(match.job.pickup_address)}>
                        <ExternalLink className="h-3 w-3 mr-1" />Map
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="relative z-10 p-1.5 rounded-lg bg-blue-500/10 ring-1 ring-blue-500/20">
                      <Navigation className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Deliver to</p>
                      <p className="font-medium text-sm truncate">{formatAddress(match.job.delivery_address)}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    {match.job.distance_km && (
                      <Badge variant="secondary" className="rounded-full text-xs"><Route className="h-3 w-3 mr-1" />{match.job.distance_km.toFixed(1)} km</Badge>
                    )}
                    <Badge variant="secondary" className="rounded-full text-xs"><Clock className="h-3 w-3 mr-1" />~{match.estimated_time_mins} min</Badge>
                    {match.job.earnings && (
                      <Badge className="rounded-full bg-emerald-600 text-xs font-semibold">
                        R{match.job.earnings.toFixed(2)}
                        {match.surge_multiplier > 1 && <Zap className="h-3 w-3 ml-1 text-amber-300" />}
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => claimJob(match.job.id)}
                    disabled={claiming === match.job.id || driver.status === "pending" || driver.status === "offline"}
                    className="rounded-xl h-9 px-4 font-semibold shadow-sm"
                  >
                    {claiming === match.job.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Claim"}
                  </Button>
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

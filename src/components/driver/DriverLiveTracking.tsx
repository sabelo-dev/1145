import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  MapPin,
  Navigation,
  Signal,
  SignalHigh,
  SignalLow,
  SignalZero,
  Clock,
  Zap,
  RefreshCw,
} from "lucide-react";
import { trackingService } from "@/services/trackingService";
import { driverService, type GeoLocation } from "@/services/driverService";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface DriverLiveTrackingProps {
  driver: {
    id: string;
    name: string;
    status: string;
  } | null;
}

const DriverLiveTracking: React.FC<DriverLiveTrackingProps> = ({ driver }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<GeoLocation | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      trackingService.stopTracking();
    };
  }, []);

  const handleLocationUpdate = useCallback((location: GeoLocation) => {
    setCurrentLocation(location);
    setLastUpdate(new Date());
    setError(null);
  }, []);

  const handleLocationError = useCallback((err: GeolocationPositionError) => {
    setError(err.message);
    toast({
      variant: "destructive",
      title: "Location Error",
      description: err.message,
    });
  }, [toast]);

  const toggleTracking = async () => {
    if (!driver) return;

    if (isTracking) {
      trackingService.stopTracking();
      setIsTracking(false);
      toast({
        title: "Location Tracking Stopped",
        description: "Your location is no longer being shared.",
      });
    } else {
      const started = trackingService.startTracking(
        driver.id,
        handleLocationUpdate,
        handleLocationError
      );

      if (started) {
        setIsTracking(true);
        toast({
          title: "Location Tracking Started",
          description: "Your location is now being shared with customers.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Geolocation Not Supported",
          description: "Your browser does not support location services.",
        });
      }
    }
  };

  const getLocationOnce = async () => {
    if (!driver) return;

    const location = await trackingService.getCurrentPosition();
    if (location) {
      setCurrentLocation(location);
      setLastUpdate(new Date());
      await driverService.updateLocation(driver.id, location);
      toast({
        title: "Location Updated",
        description: "Your current location has been saved.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Location Error",
        description: "Could not get your current location.",
      });
    }
  };

  const getSignalIcon = () => {
    if (!currentLocation?.accuracy) return <Signal className="h-5 w-5" />;
    if (currentLocation.accuracy < 20) return <SignalHigh className="h-5 w-5 text-green-500" />;
    if (currentLocation.accuracy < 100) return <Signal className="h-5 w-5 text-amber-500" />;
    if (currentLocation.accuracy < 500) return <SignalLow className="h-5 w-5 text-orange-500" />;
    return <SignalZero className="h-5 w-5 text-red-500" />;
  };

  const formatSpeed = (speedMs?: number) => {
    if (!speedMs) return "0 km/h";
    return `${Math.round(speedMs * 3.6)} km/h`;
  };

  const formatHeading = (heading?: number) => {
    if (!heading) return "N/A";
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(heading / 45) % 8;
    return `${directions[index]} (${Math.round(heading)}°)`;
  };

  if (!driver) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Live GPS Tracking</h2>

      {/* Tracking Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Location Sharing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="tracking-toggle">Enable Live Tracking</Label>
              <p className="text-sm text-muted-foreground">
                Share your real-time location with customers
              </p>
            </div>
            <Switch
              id="tracking-toggle"
              checked={isTracking}
              onCheckedChange={toggleTracking}
            />
          </div>

          {isTracking && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-green-700 dark:text-green-300">
                Location tracking is active
              </span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Location */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Current Location
            </CardTitle>
            <Button variant="outline" size="sm" onClick={getLocationOnce}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {currentLocation ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Latitude</p>
                  <p className="font-mono text-lg">{currentLocation.lat.toFixed(6)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Longitude</p>
                  <p className="font-mono text-lg">{currentLocation.lng.toFixed(6)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  {getSignalIcon()}
                  <div>
                    <p className="text-xs text-muted-foreground">Accuracy</p>
                    <p className="font-medium">
                      {currentLocation.accuracy
                        ? `±${Math.round(currentLocation.accuracy)}m`
                        : "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Speed</p>
                    <p className="font-medium">{formatSpeed(currentLocation.speed)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Heading</p>
                    <p className="font-medium">{formatHeading(currentLocation.heading)}</p>
                  </div>
                </div>
              </div>

              {lastUpdate && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                  <Clock className="h-4 w-4" />
                  Last updated: {format(lastUpdate, "HH:mm:ss")}
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const url = `https://www.google.com/maps?q=${currentLocation.lat},${currentLocation.lng}`;
                  window.open(url, "_blank");
                }}
              >
                <MapPin className="h-4 w-4 mr-2" />
                View on Google Maps
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Click "Refresh" to get your current location
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* GPS Status Info */}
      <Card>
        <CardHeader>
          <CardTitle>GPS Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <SignalHigh className="h-4 w-4 text-green-500 mt-0.5" />
              <div>
                <span className="font-medium">High Accuracy (&lt;20m)</span>
                <p className="text-muted-foreground">GPS signal is excellent</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Signal className="h-4 w-4 text-amber-500 mt-0.5" />
              <div>
                <span className="font-medium">Medium Accuracy (20-100m)</span>
                <p className="text-muted-foreground">GPS signal is good</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <SignalLow className="h-4 w-4 text-orange-500 mt-0.5" />
              <div>
                <span className="font-medium">Low Accuracy (100-500m)</span>
                <p className="text-muted-foreground">Using cell towers/WiFi</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverLiveTracking;

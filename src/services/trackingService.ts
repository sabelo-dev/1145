import { supabase } from "@/integrations/supabase/client";
import type { GeoLocation } from "./driverService";

// Types
export interface TrackingUpdate {
  driver_id: string;
  job_id: string;
  location: GeoLocation;
  timestamp: string;
  status: string;
  eta_minutes: number | null;
}

export interface ETAResult {
  eta_minutes: number;
  distance_remaining_km: number;
  arrival_time: Date;
  confidence: 'high' | 'medium' | 'low';
}

// Simple distance calculation
function calculateDistance(loc1: GeoLocation, loc2: { lat: number; lng: number }): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(loc2.lat - loc1.lat);
  const dLng = toRad(loc2.lng - loc1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(loc1.lat)) * Math.cos(toRad(loc2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Tracking Service
export const trackingService = {
  // Current watch ID for geolocation
  watchId: null as number | null,

  // Start GPS tracking for driver
  startTracking(
    driverId: string,
    onLocationUpdate: (location: GeoLocation) => void,
    onError?: (error: GeolocationPositionError) => void
  ): boolean {
    if (!navigator.geolocation) {
      console.error("Geolocation is not supported");
      return false;
    }

    this.watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const location: GeoLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined,
          timestamp: new Date().toISOString(),
        };

        // Update location in database
        const locationData: { [key: string]: string | number | null } = {
          lat: location.lat,
          lng: location.lng,
          accuracy: location.accuracy ?? null,
          heading: location.heading ?? null,
          speed: location.speed ?? null,
          timestamp: location.timestamp ?? null,
        };
        
        await supabase
          .from("drivers")
          .update({
            current_location: locationData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", driverId);

        onLocationUpdate(location);
      },
      onError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    return true;
  },

  // Stop GPS tracking
  stopTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  },

  // Get current position once
  async getCurrentPosition(): Promise<GeoLocation | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
            timestamp: new Date().toISOString(),
          });
        },
        () => resolve(null),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        }
      );
    });
  },

  // Calculate ETA to destination
  calculateETA(
    currentLocation: GeoLocation,
    destinationLat: number,
    destinationLng: number,
    currentSpeed?: number
  ): ETAResult {
    const distance = calculateDistance(currentLocation, {
      lat: destinationLat,
      lng: destinationLng,
    });

    // Average speed assumptions (km/h)
    const avgSpeedKmh = currentSpeed 
      ? (currentSpeed * 3.6) // Convert m/s to km/h
      : 30; // Default urban speed

    // Account for traffic and stops (multiply by 1.3)
    const adjustedSpeed = avgSpeedKmh * 0.77;
    
    const etaMinutes = Math.round((distance / adjustedSpeed) * 60);
    
    const arrivalTime = new Date();
    arrivalTime.setMinutes(arrivalTime.getMinutes() + etaMinutes);

    // Determine confidence based on distance and accuracy
    let confidence: 'high' | 'medium' | 'low' = 'high';
    if (distance > 20 || (currentLocation.accuracy && currentLocation.accuracy > 100)) {
      confidence = 'medium';
    }
    if (distance > 50 || (currentLocation.accuracy && currentLocation.accuracy > 500)) {
      confidence = 'low';
    }

    return {
      eta_minutes: etaMinutes,
      distance_remaining_km: Math.round(distance * 100) / 100,
      arrival_time: arrivalTime,
      confidence,
    };
  },

  // Subscribe to driver location updates (for customer tracking)
  subscribeToDriverLocation(
    driverId: string,
    callback: (location: GeoLocation) => void
  ) {
    return supabase
      .channel(`driver-location-${driverId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "drivers",
          filter: `id=eq.${driverId}`,
        },
        (payload) => {
          const newData = payload.new as { current_location?: GeoLocation };
          if (newData.current_location) {
            callback(newData.current_location);
          }
        }
      )
      .subscribe();
  },

  // Subscribe to job status updates
  subscribeToJobUpdates(
    jobId: string,
    callback: (job: any) => void
  ) {
    return supabase
      .channel(`job-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "delivery_jobs",
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();
  },
};

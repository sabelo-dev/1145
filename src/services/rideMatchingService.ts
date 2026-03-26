import { supabase } from "@/integrations/supabase/client";

interface NearbyDriver {
  driver_id: string;
  user_id: string;
  name: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  vehicle_type: string | null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const rideMatchingService = {
  /**
   * Find online, available drivers near the pickup location
   */
  async findNearbyDrivers(
    pickupLat: number,
    pickupLng: number,
    radiusKm: number = 15,
    excludeDriverIds: string[] = []
  ): Promise<NearbyDriver[]> {
    // Get online available drivers with locations
    const { data: driverLocations, error } = await supabase
      .from("driver_locations")
      .select("driver_id, latitude, longitude")
      .eq("is_online", true)
      .eq("is_available", true);

    if (error || !driverLocations?.length) return [];

    // Get driver details
    const driverIds = driverLocations
      .map((dl) => dl.driver_id)
      .filter((id) => !excludeDriverIds.includes(id));

    if (!driverIds.length) return [];

    const { data: drivers } = await supabase
      .from("drivers")
      .select("id, user_id, name, vehicle_type, status")
      .in("id", driverIds)
      .eq("status", "available");

    if (!drivers?.length) return [];

    const driverMap = new Map(drivers.map((d) => [d.id, d]));

    const nearby: NearbyDriver[] = [];
    for (const loc of driverLocations) {
      const driver = driverMap.get(loc.driver_id);
      if (!driver) continue;

      const dist = haversineKm(pickupLat, pickupLng, loc.latitude, loc.longitude);
      if (dist <= radiusKm) {
        nearby.push({
          driver_id: driver.id,
          user_id: driver.user_id,
          name: driver.name,
          latitude: loc.latitude,
          longitude: loc.longitude,
          distance_km: Math.round(dist * 10) / 10,
          vehicle_type: driver.vehicle_type,
        });
      }
    }

    // Sort by distance (closest first)
    return nearby.sort((a, b) => a.distance_km - b.distance_km);
  },

  /**
   * Notify drivers about a new ride request
   */
  async notifyDrivers(
    rideId: string,
    drivers: NearbyDriver[],
    pickupAddress: string,
    dropoffAddress: string,
    estimatedFare: number | null
  ): Promise<number> {
    if (!drivers.length) return 0;

    const notifications = drivers.map((driver) => ({
      user_id: driver.user_id,
      type: "ride_request",
      title: "🚗 New Ride Request!",
      message: `Pickup: ${pickupAddress.substring(0, 60)}${pickupAddress.length > 60 ? "..." : ""} → ${dropoffAddress.substring(0, 40)}${dropoffAddress.length > 40 ? "..." : ""}${estimatedFare ? ` | R${estimatedFare.toFixed(2)}` : ""}`,
      data: {
        ride_id: rideId,
        pickup_address: pickupAddress,
        dropoff_address: dropoffAddress,
        estimated_fare: estimatedFare,
        distance_to_pickup_km: driver.distance_km,
      },
    }));

    const { error } = await supabase.from("user_notifications").insert(notifications);
    return error ? 0 : notifications.length;
  },

  /**
   * Main matching flow: find drivers, notify them, update ride status
   * Returns: { driversNotified, status }
   */
  async matchRideToDrivers(rideId: string): Promise<{
    driversNotified: number;
    driversFound: number;
    status: "searching" | "no_drivers";
  }> {
    // Fetch the ride
    const { data: ride, error } = await supabase
      .from("rides")
      .select("*")
      .eq("id", rideId)
      .single();

    if (error || !ride) return { driversNotified: 0, driversFound: 0, status: "no_drivers" };

    // Already has a driver
    if (ride.driver_id) return { driversNotified: 0, driversFound: 0, status: "searching" };

    const pickupLat = ride.pickup_lat || ride.pickup_latitude;
    const pickupLng = ride.pickup_lng || ride.pickup_longitude;

    if (!pickupLat || !pickupLng) {
      return { driversNotified: 0, driversFound: 0, status: "no_drivers" };
    }

    // Find nearby drivers
    const nearbyDrivers = await this.findNearbyDrivers(pickupLat, pickupLng);

    if (nearbyDrivers.length === 0) {
      // Update ride status to indicate searching but no drivers yet
      await supabase
        .from("rides")
        .update({ status: "searching", updated_at: new Date().toISOString() })
        .eq("id", rideId);

      return { driversNotified: 0, driversFound: 0, status: "no_drivers" };
    }

    // Update ride status to searching
    await supabase
      .from("rides")
      .update({ status: "searching", updated_at: new Date().toISOString() })
      .eq("id", rideId);

    // Notify drivers (max 10 closest)
    const driversToNotify = nearbyDrivers.slice(0, 10);
    const notified = await this.notifyDrivers(
      rideId,
      driversToNotify,
      ride.pickup_address,
      ride.dropoff_address,
      ride.estimated_fare
    );

    return {
      driversNotified: notified,
      driversFound: nearbyDrivers.length,
      status: "searching",
    };
  },

  /**
   * Retry matching - called when initial search found no drivers or none accepted
   * Expands search radius on each retry
   */
  async retryMatch(
    rideId: string,
    attempt: number = 1
  ): Promise<{
    driversNotified: number;
    driversFound: number;
    shouldRetry: boolean;
  }> {
    const maxAttempts = 5;
    const baseRadius = 10;
    const expandedRadius = baseRadius + attempt * 5; // 15, 20, 25, 30, 35 km

    const { data: ride } = await supabase
      .from("rides")
      .select("*")
      .eq("id", rideId)
      .single();

    if (!ride || ride.driver_id || ["cancelled", "completed"].includes(ride.status)) {
      return { driversNotified: 0, driversFound: 0, shouldRetry: false };
    }

    const pickupLat = ride.pickup_lat || ride.pickup_latitude;
    const pickupLng = ride.pickup_lng || ride.pickup_longitude;
    if (!pickupLat || !pickupLng) {
      return { driversNotified: 0, driversFound: 0, shouldRetry: false };
    }

    const nearbyDrivers = await this.findNearbyDrivers(
      pickupLat,
      pickupLng,
      expandedRadius
    );

    if (nearbyDrivers.length > 0) {
      const driversToNotify = nearbyDrivers.slice(0, 10);
      const notified = await this.notifyDrivers(
        rideId,
        driversToNotify,
        ride.pickup_address,
        ride.dropoff_address,
        ride.estimated_fare
      );

      return {
        driversNotified: notified,
        driversFound: nearbyDrivers.length,
        shouldRetry: attempt < maxAttempts,
      };
    }

    // No drivers found
    if (attempt >= maxAttempts) {
      await supabase
        .from("rides")
        .update({ status: "no_drivers", updated_at: new Date().toISOString() })
        .eq("id", rideId)
        .is("driver_id", null);

      return { driversNotified: 0, driversFound: 0, shouldRetry: false };
    }

    return {
      driversNotified: 0,
      driversFound: 0,
      shouldRetry: true,
    };
  },
};

import { supabase } from "@/integrations/supabase/client";
import type { GeoLocation, DriverProfile } from "./driverService";

// Types
export interface DeliveryJob {
  id: string;
  order_id: string | null;
  pickup_address: AddressData;
  delivery_address: AddressData;
  distance_km: number | null;
  earnings: number | null;
  status: string;
  driver_id: string | null;
  created_at: string;
  notes: string | null;
  estimated_delivery_time: string | null;
  pickup_time: string | null;
}

export interface AddressData {
  street?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

export interface MatchResult {
  job: DeliveryJob;
  distance_to_pickup: number;
  estimated_time_mins: number;
  priority_score: number;
  surge_multiplier: number;
}

// Haversine formula for distance calculation
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

// Matching Engine
export const matchingEngine = {
  // Find available jobs near driver location
  async findNearbyJobs(
    driverLocation: GeoLocation,
    maxDistanceKm: number = 15
  ): Promise<MatchResult[]> {
    const { data: jobs, error } = await supabase
      .from("delivery_jobs")
      .select("*")
      .eq("status", "pending")
      .is("driver_id", null)
      .order("created_at", { ascending: false });

    if (error || !jobs) return [];

    const surgeMultiplier = await this.calculateSurgeMultiplier();
    
    const results: MatchResult[] = jobs
      .map((job) => {
        const pickupLoc = job.pickup_address as AddressData;
        if (!pickupLoc?.lat || !pickupLoc?.lng) {
          // Fallback for addresses without coordinates
          return {
            job: job as unknown as DeliveryJob,
            distance_to_pickup: 5, // Assume 5km if no coords
            estimated_time_mins: 15,
            priority_score: this.calculatePriority(job as unknown as DeliveryJob, 5, surgeMultiplier),
            surge_multiplier: surgeMultiplier,
          };
        }

        const distance = calculateDistance(driverLocation, {
          lat: pickupLoc.lat,
          lng: pickupLoc.lng,
        });

        return {
          job: job as unknown as DeliveryJob,
          distance_to_pickup: distance,
          estimated_time_mins: Math.round(distance * 3), // Approx 3 min per km
          priority_score: this.calculatePriority(job as unknown as DeliveryJob, distance, surgeMultiplier),
          surge_multiplier: surgeMultiplier,
        };
      })
      .filter((result) => result.distance_to_pickup <= maxDistanceKm)
      .sort((a, b) => b.priority_score - a.priority_score);

    return results;
  },

  // Calculate priority score for job matching
  calculatePriority(job: DeliveryJob, distanceToPickup: number, surgeMultiplier: number): number {
    let score = 100;

    // Closer jobs get higher priority
    score -= distanceToPickup * 3;

    // Higher earnings increase priority
    if (job.earnings) {
      score += job.earnings / 10;
    }

    // Older jobs get higher priority (FIFO with weighting)
    const ageMinutes = (Date.now() - new Date(job.created_at).getTime()) / 60000;
    score += Math.min(ageMinutes, 30); // Cap at 30 min bonus

    // Surge multiplier increases priority
    score *= surgeMultiplier;

    return Math.max(0, score);
  },

  // Calculate current surge multiplier based on demand
  async calculateSurgeMultiplier(): Promise<number> {
    // Count pending jobs
    const { count: pendingJobs } = await supabase
      .from("delivery_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .is("driver_id", null);

    // Count available drivers
    const { count: availableDrivers } = await supabase
      .from("drivers")
      .select("*", { count: "exact", head: true })
      .eq("status", "available");

    const jobs = pendingJobs || 0;
    const drivers = availableDrivers || 1; // Avoid division by zero

    const ratio = jobs / drivers;

    // Surge thresholds
    if (ratio >= 5) return 2.0;  // Very high demand
    if (ratio >= 3) return 1.5;  // High demand
    if (ratio >= 2) return 1.25; // Moderate demand
    return 1.0; // Normal
  },

  // Get available driver count for load balancing
  async getLoadBalanceInfo(): Promise<{ availableDrivers: number; pendingJobs: number; avgJobsPerDriver: number }> {
    const { count: pendingJobs } = await supabase
      .from("delivery_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .is("driver_id", null);

    const { count: availableDrivers } = await supabase
      .from("drivers")
      .select("*", { count: "exact", head: true })
      .eq("status", "available");

    const jobs = pendingJobs || 0;
    const drivers = availableDrivers || 0;

    return {
      availableDrivers: drivers,
      pendingJobs: jobs,
      avgJobsPerDriver: drivers > 0 ? jobs / drivers : 0,
    };
  },
};

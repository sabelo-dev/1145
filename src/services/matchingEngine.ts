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
  package_size?: "small" | "medium" | "large" | "extra_large";
  weight_kg?: number;
  requires_vehicle_type?: string[];
  time_window_start?: string;
  time_window_end?: string;
  priority?: "normal" | "urgent" | "scheduled";
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

export interface DriverMatchCriteria {
  proximity_km: number;
  vehicle_types?: string[];
  min_rating?: number;
  status?: string[];
  min_load_capacity_kg?: number;
}

export interface MatchedDriver {
  driver: DriverProfile & {
    id: string;
    name: string;
    phone: string | null;
    rating: number | null;
    vehicle_type: string | null;
    vehicle_registration: string | null;
    current_location: GeoLocation | null;
    total_deliveries: number | null;
  };
  distance_to_pickup: number;
  estimated_arrival_mins: number;
  match_score: number;
}

export interface JobOffer {
  id: string;
  job: DeliveryJob;
  driver_id: string;
  offered_at: string;
  expires_at: string;
  status: "pending" | "accepted" | "declined" | "expired";
  earnings: number;
  surge_multiplier: number;
}

// Vehicle load capacities in kg
const VEHICLE_CAPACITIES: Record<string, number> = {
  motorcycle: 15,
  car: 50,
  van: 200,
  truck: 1000,
  bicycle: 5,
};

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
    maxDistanceKm: number = 15,
    vehicleType?: string
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
          return {
            job: job as unknown as DeliveryJob,
            distance_to_pickup: 5,
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
          estimated_time_mins: Math.round(distance * 3),
          priority_score: this.calculatePriority(job as unknown as DeliveryJob, distance, surgeMultiplier),
          surge_multiplier: surgeMultiplier,
        };
      })
      .filter((result) => {
        // Filter by distance
        if (result.distance_to_pickup > maxDistanceKm) return false;
        
        // Filter by vehicle type if specified
        if (vehicleType && result.job.requires_vehicle_type) {
          if (!result.job.requires_vehicle_type.includes(vehicleType)) return false;
        }
        
        return true;
      })
      .sort((a, b) => b.priority_score - a.priority_score);

    return results;
  },

  // Find suitable drivers for a job
  async findDriversForJob(
    job: DeliveryJob,
    criteria: DriverMatchCriteria
  ): Promise<MatchedDriver[]> {
    let query = supabase
      .from("drivers")
      .select("*");

    // Filter by status
    if (criteria.status && criteria.status.length > 0) {
      query = query.in("status", criteria.status);
    } else {
      query = query.eq("status", "available");
    }

    // Filter by minimum rating
    if (criteria.min_rating) {
      query = query.gte("rating", criteria.min_rating);
    }

    // Filter by vehicle type
    if (criteria.vehicle_types && criteria.vehicle_types.length > 0) {
      query = query.in("vehicle_type", criteria.vehicle_types);
    }

    const { data: drivers, error } = await query;

    if (error || !drivers) return [];

    const pickupLoc = job.pickup_address;
    if (!pickupLoc?.lat || !pickupLoc?.lng) return [];

    const matchedDrivers: MatchedDriver[] = drivers
      .map((driver) => {
        const rawLoc = driver.current_location as { lat?: number; lng?: number } | null;
        
        // Calculate distance if location available
        let distance = 999;
        if (rawLoc?.lat && rawLoc?.lng && pickupLoc.lat && pickupLoc.lng) {
          const dLat = toRad(rawLoc.lat - pickupLoc.lat);
          const dLng = toRad(rawLoc.lng - pickupLoc.lng);
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(pickupLoc.lat)) * Math.cos(toRad(rawLoc.lat)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          distance = 6371 * c;
        }

        // Check load capacity
        const vehicleCapacity = VEHICLE_CAPACITIES[driver.vehicle_type || "car"] || 50;
        if (criteria.min_load_capacity_kg && vehicleCapacity < criteria.min_load_capacity_kg) {
          return null;
        }

        // Calculate match score
        const matchScore = this.calculateDriverMatchScore(driver, distance, job);

        return {
          driver: {
            ...driver,
            current_location: rawLoc?.lat && rawLoc?.lng ? { lat: rawLoc.lat, lng: rawLoc.lng } : null,
          },
          distance_to_pickup: distance,
          estimated_arrival_mins: Math.round(distance * 3),
          match_score: matchScore,
        };
      })
      .filter((result): result is MatchedDriver => {
        if (!result) return false;
        return result.distance_to_pickup <= criteria.proximity_km;
      })
      .sort((a, b) => b.match_score - a.match_score);

    return matchedDrivers;
  },

  // Calculate driver match score
  calculateDriverMatchScore(driver: any, distanceToPickup: number, job: DeliveryJob): number {
    let score = 100;

    // Proximity factor (closer = higher score)
    score -= distanceToPickup * 5;

    // Rating factor
    const rating = driver.rating || 4.5;
    score += (rating - 4) * 20;

    // Experience factor
    const deliveries = driver.total_deliveries || 0;
    score += Math.min(deliveries / 10, 20);

    // Vehicle match bonus
    if (job.requires_vehicle_type?.includes(driver.vehicle_type)) {
      score += 15;
    }

    return Math.max(0, score);
  },

  // Create a job offer for a driver
  async createJobOffer(
    job: DeliveryJob,
    driverId: string,
    expirySeconds: number = 45
  ): Promise<JobOffer> {
    const surgeMultiplier = await this.calculateSurgeMultiplier();
    const baseEarnings = job.earnings || 50;
    const finalEarnings = baseEarnings * surgeMultiplier;

    const offer: JobOffer = {
      id: `offer_${Date.now()}_${driverId}`,
      job,
      driver_id: driverId,
      offered_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + expirySeconds * 1000).toISOString(),
      status: "pending",
      earnings: finalEarnings,
      surge_multiplier: surgeMultiplier,
    };

    return offer;
  },

  // Process declined offer - find next driver
  async rerouteToNextDriver(
    job: DeliveryJob,
    excludeDriverIds: string[],
    criteria: DriverMatchCriteria
  ): Promise<MatchedDriver | null> {
    const drivers = await this.findDriversForJob(job, criteria);
    
    const availableDriver = drivers.find(
      (d) => !excludeDriverIds.includes(d.driver.id)
    );

    return availableDriver || null;
  },

  // Check if surge should activate after multiple declines
  async shouldActivateSurge(declineCount: number): Promise<boolean> {
    // Activate surge after 3 declines
    return declineCount >= 3;
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

    // Urgent jobs get priority
    if (job.priority === "urgent") {
      score += 30;
    }

    // Time window priority
    if (job.time_window_end) {
      const timeLeft = new Date(job.time_window_end).getTime() - Date.now();
      const hoursLeft = timeLeft / (1000 * 60 * 60);
      if (hoursLeft < 1) {
        score += 25;
      } else if (hoursLeft < 2) {
        score += 15;
      }
    }

    // Older jobs get higher priority (FIFO with weighting)
    const ageMinutes = (Date.now() - new Date(job.created_at).getTime()) / 60000;
    score += Math.min(ageMinutes, 30);

    // Surge multiplier increases priority
    score *= surgeMultiplier;

    return Math.max(0, score);
  },

  // Calculate current surge multiplier based on demand
  async calculateSurgeMultiplier(): Promise<number> {
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
    const drivers = availableDrivers || 1;

    const ratio = jobs / drivers;

    if (ratio >= 5) return 2.0;
    if (ratio >= 3) return 1.5;
    if (ratio >= 2) return 1.25;
    return 1.0;
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

  // Get vehicle capacity
  getVehicleCapacity(vehicleType: string): number {
    return VEHICLE_CAPACITIES[vehicleType] || 50;
  },
};

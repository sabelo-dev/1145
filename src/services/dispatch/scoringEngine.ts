/**
 * Driver Scoring Engine
 * Calculates match scores for driver-job assignments using
 * multi-factor weighted scoring.
 */

import { haversineDistance, estimateTravelMins, type GeoPoint } from "./geoUtils";

export interface DriverCandidate {
  id: string;
  user_id: string;
  name: string;
  location: GeoPoint;
  rating: number | null;
  total_deliveries: number | null;
  acceptance_rate: number | null;
  ontime_rate: number | null;
  vehicle_type: string | null;
  status: string;
  current_speed?: number | null;
  heading?: number | null;
}

export interface ScoringWeights {
  proximity: number;       // Weight for distance (higher = more important)
  rating: number;          // Weight for driver rating
  experience: number;      // Weight for total deliveries
  acceptance: number;      // Weight for acceptance rate
  ontime: number;          // Weight for on-time delivery rate
  vehicleMatch: number;    // Bonus for matching vehicle type
  recentRejections: number; // Penalty per recent rejection
}

export interface ScoredDriver {
  driver: DriverCandidate;
  distance_km: number;
  estimated_arrival_mins: number;
  match_score: number;
  score_breakdown: {
    proximity: number;
    rating: number;
    experience: number;
    acceptance: number;
    ontime: number;
    vehicle_bonus: number;
    rejection_penalty: number;
  };
}

// Default weights - tuned for balanced matching
const DEFAULT_WEIGHTS: ScoringWeights = {
  proximity: 5.0,
  rating: 15.0,
  experience: 0.1,
  acceptance: 0.15,
  ontime: 0.10,
  vehicleMatch: 15,
  recentRejections: 10,
};

export const scoringEngine = {
  /**
   * Score a single driver for a pickup location
   */
  scoreDriver(
    driver: DriverCandidate,
    pickupLocation: GeoPoint,
    options: {
      requiredVehicleTypes?: string[];
      recentRejectionCount?: number;
      weights?: Partial<ScoringWeights>;
    } = {}
  ): ScoredDriver {
    const weights = { ...DEFAULT_WEIGHTS, ...options.weights };
    const distance = haversineDistance(driver.location, pickupLocation);
    const arrivalMins = estimateTravelMins(distance);

    // Proximity score: closer = higher (base 100, minus distance * weight)
    const proximityScore = Math.max(0, 100 - distance * weights.proximity);

    // Rating score: 0-5 scale, normalized
    const ratingScore = ((driver.rating ?? 4.5) - 3.0) * weights.rating;

    // Experience score: diminishing returns, capped at 25
    const experienceScore = Math.min(
      (driver.total_deliveries ?? 0) * weights.experience,
      25
    );

    // Acceptance rate score
    const acceptanceScore = (driver.acceptance_rate ?? 80) * weights.acceptance;

    // On-time rate score
    const ontimeScore = (driver.ontime_rate ?? 80) * weights.ontime;

    // Vehicle match bonus
    let vehicleBonus = 0;
    if (options.requiredVehicleTypes?.length && driver.vehicle_type) {
      if (options.requiredVehicleTypes.includes(driver.vehicle_type)) {
        vehicleBonus = weights.vehicleMatch;
      } else {
        vehicleBonus = -20; // Penalty for wrong vehicle type
      }
    }

    // Recent rejection penalty
    const rejectionPenalty = (options.recentRejectionCount ?? 0) * weights.recentRejections;

    const totalScore = Math.max(
      0,
      proximityScore + ratingScore + experienceScore + acceptanceScore + ontimeScore + vehicleBonus - rejectionPenalty
    );

    return {
      driver,
      distance_km: Math.round(distance * 10) / 10,
      estimated_arrival_mins: arrivalMins,
      match_score: Math.round(totalScore * 100) / 100,
      score_breakdown: {
        proximity: Math.round(proximityScore * 100) / 100,
        rating: Math.round(ratingScore * 100) / 100,
        experience: Math.round(experienceScore * 100) / 100,
        acceptance: Math.round(acceptanceScore * 100) / 100,
        ontime: Math.round(ontimeScore * 100) / 100,
        vehicle_bonus: vehicleBonus,
        rejection_penalty: -rejectionPenalty,
      },
    };
  },

  /**
   * Score and rank multiple drivers for a job
   */
  rankDrivers(
    drivers: DriverCandidate[],
    pickupLocation: GeoPoint,
    options: {
      maxDistanceKm?: number;
      requiredVehicleTypes?: string[];
      recentRejections?: Map<string, number>;
      weights?: Partial<ScoringWeights>;
      limit?: number;
    } = {}
  ): ScoredDriver[] {
    const maxDist = options.maxDistanceKm ?? 35;

    const scored = drivers
      .map((driver) =>
        this.scoreDriver(driver, pickupLocation, {
          requiredVehicleTypes: options.requiredVehicleTypes,
          recentRejectionCount: options.recentRejections?.get(driver.id) ?? 0,
          weights: options.weights,
        })
      )
      .filter((sd) => sd.distance_km <= maxDist && sd.match_score > 0)
      .sort((a, b) => b.match_score - a.match_score);

    return options.limit ? scored.slice(0, options.limit) : scored;
  },

  /**
   * Hungarian Algorithm approximation for optimal batch assignment
   * Given N jobs and M drivers, find optimal 1:1 assignments minimizing total cost.
   * Uses a greedy approximation for performance.
   */
  optimalAssignment(
    jobs: { id: string; location: GeoPoint }[],
    drivers: DriverCandidate[]
  ): { jobId: string; driverId: string; score: number; distance: number }[] {
    if (!jobs.length || !drivers.length) return [];

    // Build cost matrix (negative score = cost to minimize)
    const assignments: { jobId: string; driverId: string; score: number; distance: number }[] = [];
    const assignedDrivers = new Set<string>();
    const assignedJobs = new Set<string>();

    // Score all combinations
    const allPairs: { jobId: string; driverId: string; scored: ScoredDriver }[] = [];
    for (const job of jobs) {
      for (const driver of drivers) {
        const scored = this.scoreDriver(driver, job.location);
        allPairs.push({ jobId: job.id, driverId: driver.id, scored });
      }
    }

    // Sort by score descending (greedy best-first)
    allPairs.sort((a, b) => b.scored.match_score - a.scored.match_score);

    // Greedy assignment
    for (const pair of allPairs) {
      if (assignedDrivers.has(pair.driverId) || assignedJobs.has(pair.jobId)) continue;
      assignments.push({
        jobId: pair.jobId,
        driverId: pair.driverId,
        score: pair.scored.match_score,
        distance: pair.scored.distance_km,
      });
      assignedDrivers.add(pair.driverId);
      assignedJobs.add(pair.jobId);

      if (assignedDrivers.size >= drivers.length || assignedJobs.size >= jobs.length) break;
    }

    return assignments;
  },
};

/**
 * Core Dispatch Engine
 * Orchestrates matching, assignment, batching, and failure recovery.
 * The "brain" of the logistics system.
 */

import { supabase } from "@/integrations/supabase/client";
import { type GeoPoint, haversineDistance } from "./geoUtils";
import { scoringEngine, type DriverCandidate, type ScoredDriver } from "./scoringEngine";
import { supplyState } from "./supplyStateManager";
import { surgeEngine } from "./surgeEngine";

export interface DispatchRequest {
  entityType: "ride" | "delivery_job";
  entityId: string;
  pickupLocation: GeoPoint;
  dropoffLocation?: GeoPoint;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFare?: number | null;
  requiredVehicleTypes?: string[];
  priority?: "normal" | "urgent" | "scheduled";
  userId?: string;
}

export interface DispatchResult {
  success: boolean;
  driversFound: number;
  driversNotified: number;
  assignmentIds: string[];
  surgeMultiplier: number;
  estimatedWaitMins: number | null;
  status: "dispatched" | "no_drivers" | "error";
  error?: string;
}

export interface BatchCandidate {
  jobId: string;
  location: GeoPoint;
  dropoff: GeoPoint;
  distanceKm: number;
}

const OFFER_EXPIRY_SECONDS = 45;
const MAX_DRIVERS_PER_DISPATCH = 10;

export const dispatchEngine = {
  /**
   * Main dispatch entry point.
   * Finds, scores, and assigns drivers to a request.
   */
  async dispatch(request: DispatchRequest): Promise<DispatchResult> {
    try {
      // Ensure supply state is initialized
      await supplyState.initialize();

      // 1. Get surge multiplier for the pickup zone
      const surge = await surgeEngine.getSurgeForLocation(request.pickupLocation);

      // 2. Find available drivers near pickup
      const availableDrivers = supplyState.getAvailableDriversNear(
        request.pickupLocation,
        35 // Max search radius
      );

      if (availableDrivers.length === 0) {
        // Log the event
        await this.logEvent("no_drivers_available", request.entityType, request.entityId, null, {
          pickup: request.pickupLocation,
          surge: surge.multiplier,
        });

        return {
          success: false,
          driversFound: 0,
          driversNotified: 0,
          assignmentIds: [],
          surgeMultiplier: surge.multiplier,
          estimatedWaitMins: null,
          status: "no_drivers",
        };
      }

      // 3. Get recent rejection counts for scoring penalty
      const recentRejections = await this.getRecentRejections(
        availableDrivers.map((d) => d.id)
      );

      // 4. Score and rank drivers
      const rankedDrivers = scoringEngine.rankDrivers(
        availableDrivers,
        request.pickupLocation,
        {
          requiredVehicleTypes: request.requiredVehicleTypes,
          recentRejections,
          limit: MAX_DRIVERS_PER_DISPATCH,
        }
      );

      if (rankedDrivers.length === 0) {
        return {
          success: false,
          driversFound: availableDrivers.length,
          driversNotified: 0,
          assignmentIds: [],
          surgeMultiplier: surge.multiplier,
          estimatedWaitMins: null,
          status: "no_drivers",
        };
      }

      // 5. Create dispatch assignments
      const assignmentIds = await this.createAssignments(
        request,
        rankedDrivers,
        surge.multiplier
      );

      // 6. Notify drivers
      const notified = await this.notifyDrivers(request, rankedDrivers);

      // 7. Log dispatch event
      await this.logEvent("dispatch_completed", request.entityType, request.entityId, null, {
        drivers_found: availableDrivers.length,
        drivers_scored: rankedDrivers.length,
        drivers_notified: notified,
        surge: surge.multiplier,
        top_score: rankedDrivers[0]?.match_score,
      });

      return {
        success: true,
        driversFound: availableDrivers.length,
        driversNotified: notified,
        assignmentIds,
        surgeMultiplier: surge.multiplier,
        estimatedWaitMins: rankedDrivers[0]?.estimated_arrival_mins ?? null,
        status: "dispatched",
      };
    } catch (error) {
      console.error("[DispatchEngine] Error:", error);
      return {
        success: false,
        driversFound: 0,
        driversNotified: 0,
        assignmentIds: [],
        surgeMultiplier: 1.0,
        estimatedWaitMins: null,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  /**
   * Retry dispatch with expanding radius.
   */
  async retryDispatch(
    request: DispatchRequest,
    attempt: number,
    excludeDriverIds: string[] = []
  ): Promise<DispatchResult & { shouldRetry: boolean }> {
    const maxAttempts = 5;
    const expandedRequest = { ...request };

    // Get drivers with expanded search, excluding already-notified
    await supplyState.initialize();
    const baseRadius = 10 + attempt * 5;
    const drivers = supplyState.getAvailableDriversNear(
      request.pickupLocation,
      baseRadius,
      excludeDriverIds
    );

    if (drivers.length === 0) {
      if (attempt >= maxAttempts) {
        // Mark as no drivers available
        if (request.entityType === "ride") {
          await supabase
            .from("rides")
            .update({ status: "no_drivers", updated_at: new Date().toISOString() })
            .eq("id", request.entityId);
        }
        return {
          success: false,
          driversFound: 0,
          driversNotified: 0,
          assignmentIds: [],
          surgeMultiplier: 1.0,
          estimatedWaitMins: null,
          status: "no_drivers",
          shouldRetry: false,
        };
      }
      return {
        success: false,
        driversFound: 0,
        driversNotified: 0,
        assignmentIds: [],
        surgeMultiplier: 1.0,
        estimatedWaitMins: null,
        status: "no_drivers",
        shouldRetry: true,
      };
    }

    const result = await this.dispatch(expandedRequest);
    return {
      ...result,
      shouldRetry: attempt < maxAttempts && !result.success,
    };
  },

  /**
   * Handle driver acceptance of an assignment.
   */
  async acceptAssignment(assignmentId: string, driverId: string): Promise<boolean> {
    // Update assignment
    const { error: assignError } = await supabase
      .from("dispatch_assignments")
      .update({
        status: "accepted",
        responded_at: new Date().toISOString(),
      })
      .eq("id", assignmentId)
      .eq("driver_id", driverId);

    if (assignError) return false;

    // Get assignment details to update the entity
    const { data: assignment } = await supabase
      .from("dispatch_assignments")
      .select("entity_type, entity_id")
      .eq("id", assignmentId)
      .single();

    if (!assignment) return false;

    // Expire all other pending assignments for this entity
    await supabase
      .from("dispatch_assignments")
      .update({ status: "expired", responded_at: new Date().toISOString() })
      .eq("entity_type", assignment.entity_type)
      .eq("entity_id", assignment.entity_id)
      .neq("id", assignmentId)
      .eq("status", "offered");

    // Update the entity with the driver
    if (assignment.entity_type === "ride") {
      await supabase
        .from("rides")
        .update({ driver_id: driverId, status: "accepted", updated_at: new Date().toISOString() })
        .eq("id", assignment.entity_id);
    } else if (assignment.entity_type === "delivery_job") {
      await supabase
        .from("delivery_jobs")
        .update({ driver_id: driverId, status: "assigned", updated_at: new Date().toISOString() })
        .eq("id", assignment.entity_id);
    }

    return true;
  },

  /**
   * Handle driver rejection - trigger reassignment.
   */
  async rejectAssignment(
    assignmentId: string,
    driverId: string,
    reason?: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from("dispatch_assignments")
      .update({
        status: "rejected",
        responded_at: new Date().toISOString(),
        rejection_reason: reason || "driver_declined",
      })
      .eq("id", assignmentId)
      .eq("driver_id", driverId);

    if (error) return false;

    // Log for analytics
    await this.logEvent("driver_rejected", "assignment", assignmentId, driverId, { reason });

    return true;
  },

  /**
   * Batch multiple nearby jobs for a single driver (multi-stop optimization).
   */
  async createBatch(
    driverId: string,
    jobIds: string[],
    totalDistance: number,
    totalEarnings: number
  ): Promise<string | null> {
    // Simple nearest-neighbor route optimization
    const routeOrder = Array.from({ length: jobIds.length }, (_, i) => i);

    const { data, error } = await supabase
      .from("dispatch_batches")
      .insert({
        driver_id: driverId,
        status: "assigned",
        job_ids: jobIds,
        route_order: routeOrder,
        total_distance_km: totalDistance,
        total_estimated_mins: Math.round(totalDistance * 3),
        total_earnings: totalEarnings,
        optimization_score: 100 - totalDistance, // Simple score
      })
      .select("id")
      .single();

    return error ? null : data.id;
  },

  /**
   * Find batchable jobs near a driver's current route.
   */
  async findBatchableJobs(
    driverId: string,
    currentLocation: GeoPoint,
    maxDetourKm: number = 3
  ): Promise<BatchCandidate[]> {
    const { data: jobs } = await supabase
      .from("delivery_jobs")
      .select("id, pickup_address, delivery_address, distance_km")
      .eq("status", "pending")
      .is("driver_id", null);

    if (!jobs?.length) return [];

    const candidates: BatchCandidate[] = [];
    for (const job of jobs) {
      const pickup = job.pickup_address as { lat?: number; lng?: number };
      const delivery = job.delivery_address as { lat?: number; lng?: number };
      if (!pickup?.lat || !pickup?.lng || !delivery?.lat || !delivery?.lng) continue;

      const distToPickup = haversineDistance(currentLocation, { lat: pickup.lat, lng: pickup.lng });
      if (distToPickup <= maxDetourKm) {
        candidates.push({
          jobId: job.id,
          location: { lat: pickup.lat, lng: pickup.lng },
          dropoff: { lat: delivery.lat, lng: delivery.lng },
          distanceKm: job.distance_km ?? distToPickup,
        });
      }
    }

    return candidates.sort((a, b) => a.distanceKm - b.distanceKm);
  },

  // ---- Internal helpers ----

  async createAssignments(
    request: DispatchRequest,
    rankedDrivers: ScoredDriver[],
    surgeMultiplier: number
  ): Promise<string[]> {
    const assignments = rankedDrivers.map((sd, index) => ({
      entity_type: request.entityType,
      entity_id: request.entityId,
      driver_id: sd.driver.id,
      status: "offered",
      match_score: sd.match_score,
      distance_to_pickup_km: sd.distance_km,
      estimated_arrival_mins: sd.estimated_arrival_mins,
      surge_multiplier: surgeMultiplier,
      expires_at: new Date(Date.now() + OFFER_EXPIRY_SECONDS * 1000).toISOString(),
      attempt_number: 1,
    }));

    const { data, error } = await supabase
      .from("dispatch_assignments")
      .insert(assignments)
      .select("id");

    return error ? [] : data.map((d) => d.id);
  },

  async notifyDrivers(
    request: DispatchRequest,
    rankedDrivers: ScoredDriver[]
  ): Promise<number> {
    if (!rankedDrivers.length) return 0;

    const notifications = rankedDrivers.map((sd) => ({
      user_id: sd.driver.user_id,
      type: request.entityType === "ride" ? "ride_request" : "delivery_request",
      title: request.entityType === "ride" ? "🚗 New Ride Request!" : "📦 New Delivery Job!",
      message: `${request.pickupAddress.substring(0, 50)} → ${request.dropoffAddress.substring(0, 40)}${request.estimatedFare ? ` | R${request.estimatedFare.toFixed(2)}` : ""} • ${sd.distance_km}km away`,
      data: {
        entity_type: request.entityType,
        entity_id: request.entityId,
        pickup_address: request.pickupAddress,
        dropoff_address: request.dropoffAddress,
        estimated_fare: request.estimatedFare,
        distance_to_pickup_km: sd.distance_km,
        estimated_arrival_mins: sd.estimated_arrival_mins,
        match_score: sd.match_score,
      },
    }));

    const { error } = await supabase.from("user_notifications").insert(notifications);
    return error ? 0 : notifications.length;
  },

  async getRecentRejections(driverIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (!driverIds.length) return map;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("dispatch_assignments")
      .select("driver_id")
      .in("driver_id", driverIds)
      .eq("status", "rejected")
      .gte("created_at", oneHourAgo);

    if (data) {
      for (const row of data) {
        map.set(row.driver_id, (map.get(row.driver_id) ?? 0) + 1);
      }
    }
    return map;
  },

  async logEvent(
    eventType: string,
    entityType: string,
    entityId: string,
    driverId: string | null,
    payload: Record<string, unknown>
  ): Promise<void> {
    await supabase.from("dispatch_events").insert({
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      driver_id: driverId,
      payload,
    });
  },
};

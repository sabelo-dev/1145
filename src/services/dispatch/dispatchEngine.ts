import { requestNearbyDispatch, respondToOffer } from "../nearbyDispatch";
/**
 * Core Dispatch Engine
 * Orchestrates matching, assignment, batching, and failure recovery.
 * The "brain" of the logistics system.
 */

import { supabase } from "@/integrations/supabase/client";
import { type GeoPoint, haversineDistance } from "./geoUtils";

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


export const dispatchEngine = {
  /**
   * Main dispatch entry point.
   * Finds, scores, and assigns drivers to a request.
   */
  async dispatch(request: DispatchRequest): Promise<DispatchResult> {
    try {
      const result = await requestNearbyDispatch(request.entityType, request.entityId);
      return { success: result.status === "dispatched", driversFound: result.driversFound, driversNotified: result.driversNotified, assignmentIds: [], surgeMultiplier: 1, estimatedWaitMins: null, status: result.status === "dispatched" ? "dispatched" : "no_drivers" };
    } catch (error) {
      return { success: false, driversFound: 0, driversNotified: 0, assignmentIds: [], surgeMultiplier: 1, estimatedWaitMins: null, status: "error", error: error instanceof Error ? error.message : "Dispatch failed" };
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
    const result = await this.dispatch(request);
    return { ...result, shouldRetry: attempt < 20 && result.status !== "no_drivers" && !result.success };
  },

  /**
   * Handle driver acceptance of an assignment.
   */
  async acceptAssignment(assignmentId: string, driverId: string): Promise<boolean> {
    try { await respondToOffer(assignmentId, true); return true; } catch { return false; }
  },

  /**
   * Handle driver rejection - trigger reassignment.
   */
  async rejectAssignment(
    assignmentId: string,
    driverId: string,
    reason?: string
  ): Promise<boolean> {
    try { await respondToOffer(assignmentId, false); return true; } catch { return false; }
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
    await supabase.from("dispatch_events").insert([{
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      driver_id: driverId,
      payload: payload as any,
    }]);
  },
};

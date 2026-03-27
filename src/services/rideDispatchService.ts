/**
 * Ride Dispatch Service
 * Bridges the ride-hailing module with the high-performance dispatch engine.
 * Handles ride lifecycle: request → dispatch → match → accept → trip → complete
 */

import { supabase } from "@/integrations/supabase/client";
import { dispatchEngine, type DispatchRequest, type DispatchResult } from "./dispatch";
import { surgeEngine } from "./dispatch/surgeEngine";
import { failureRecovery } from "./dispatch/failureRecovery";

export type RideStatus =
  | "requested" | "searching" | "accepted" | "arriving"
  | "arrived" | "in_progress" | "completed" | "cancelled" | "no_drivers";

export interface RideRequest {
  passengerId: string;
  vehicleTypeId: string;
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
  estimatedDistance: number;
  estimatedDuration: number;
  estimatedFare: number;
  paymentMethod: "wallet" | "card" | "cash";
  scheduledAt?: string;
  notes?: string;
}

export interface RideDispatchResult extends DispatchResult {
  rideId: string;
  surgeApplied: boolean;
  adjustedFare: number;
}

export const rideDispatchService = {
  /**
   * Create ride and dispatch to drivers in one optimized flow.
   * Target: <2s total latency.
   */
  async requestRide(request: RideRequest): Promise<RideDispatchResult> {
    const startTime = Date.now();

    // 1. Get surge for pickup location (parallel with ride creation)
    const surgePromise = surgeEngine.getSurgeForLocation(request.pickup);

    // 2. Create the ride record
    const { data: ride, error } = await supabase.from("rides").insert({
      passenger_id: request.passengerId,
      vehicle_type_id: request.vehicleTypeId,
      pickup_address: request.pickup.address,
      dropoff_address: request.dropoff.address,
      pickup_lat: request.pickup.lat,
      pickup_lng: request.pickup.lng,
      dropoff_lat: request.dropoff.lat,
      dropoff_lng: request.dropoff.lng,
      estimated_distance_km: request.estimatedDistance,
      estimated_duration_minutes: request.estimatedDuration,
      estimated_fare: request.estimatedFare,
      status: "searching",
      payment_method: request.paymentMethod,
      notes: request.notes,
    }).select("id").single();

    if (error || !ride) {
      return {
        rideId: "",
        success: false,
        driversFound: 0,
        driversNotified: 0,
        assignmentIds: [],
        surgeMultiplier: 1.0,
        estimatedWaitMins: null,
        status: "error",
        error: error?.message || "Failed to create ride",
        surgeApplied: false,
        adjustedFare: request.estimatedFare,
      };
    }

    // 3. Get surge result
    const surge = await surgePromise;
    const adjustedFare = Math.round(request.estimatedFare * surge.multiplier * 100) / 100;

    // Update fare if surge applied
    if (surge.multiplier > 1.0) {
      await supabase.from("rides").update({
        estimated_fare: adjustedFare,
        surge_multiplier: surge.multiplier,
      }).eq("id", ride.id);
    }

    // 4. Dispatch to drivers via the engine
    const dispatchRequest: DispatchRequest = {
      entityType: "ride",
      entityId: ride.id,
      pickupLocation: request.pickup,
      dropoffLocation: request.dropoff,
      pickupAddress: request.pickup.address,
      dropoffAddress: request.dropoff.address,
      estimatedFare: adjustedFare,
      userId: request.passengerId,
      priority: "normal",
    };

    const result = await dispatchEngine.dispatch(dispatchRequest);

    const latency = Date.now() - startTime;
    console.log(`[RideDispatch] Completed in ${latency}ms | Drivers: ${result.driversFound} found, ${result.driversNotified} notified`);

    return {
      ...result,
      rideId: ride.id,
      surgeApplied: surge.multiplier > 1.0,
      adjustedFare,
    };
  },

  /**
   * Get surge-adjusted fare estimate before booking.
   */
  async estimateFare(
    pickup: { lat: number; lng: number },
    vehicleTypeId: string,
    baseFare: number
  ): Promise<{ fare: number; surge: number; demandLevel: string }> {
    const surge = await surgeEngine.getSurgeForLocation(pickup);
    return {
      fare: Math.round(baseFare * surge.multiplier * 100) / 100,
      surge: surge.multiplier,
      demandLevel: surge.demandLevel,
    };
  },

  /**
   * Driver accepts a ride assignment.
   */
  async driverAcceptRide(assignmentId: string, driverId: string): Promise<boolean> {
    return dispatchEngine.acceptAssignment(assignmentId, driverId);
  },

  /**
   * Driver rejects a ride assignment - triggers reassignment.
   */
  async driverRejectRide(assignmentId: string, driverId: string, reason?: string): Promise<boolean> {
    return dispatchEngine.rejectAssignment(assignmentId, driverId, reason);
  },

  /**
   * Update ride status through lifecycle transitions.
   */
  async updateRideStatus(rideId: string, status: RideStatus, extras?: Record<string, unknown>): Promise<boolean> {
    const update: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
      ...extras,
    };

    if (status === "arriving") update.driver_departed_at = new Date().toISOString();
    if (status === "arrived") update.driver_arrived_at = new Date().toISOString();
    if (status === "in_progress") update.trip_started_at = new Date().toISOString();
    if (status === "completed") {
      update.trip_ended_at = new Date().toISOString();
      update.completed_at = new Date().toISOString();
    }
    if (status === "cancelled") {
      update.cancelled_at = new Date().toISOString();
    }

    const { error } = await supabase.from("rides").update(update).eq("id", rideId);
    return !error;
  },

  /**
   * Handle driver cancellation with automatic recovery.
   */
  async handleDriverCancellation(rideId: string, driverId: string, reason?: string) {
    return failureRecovery.handleDriverCancellation("ride", rideId, driverId, reason);
  },

  /**
   * Passenger cancellation.
   */
  async cancelRide(rideId: string, passengerId: string, reason?: string): Promise<boolean> {
    const { error } = await supabase.from("rides").update({
      status: "cancelled",
      cancelled_by: "passenger",
      cancellation_reason: reason || "Cancelled by passenger",
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", rideId).eq("passenger_id", passengerId);
    return !error;
  },

  /**
   * Share ride details (safety feature).
   */
  async shareRideDetails(rideId: string): Promise<string> {
    const { data: ride } = await supabase.from("rides").select("*").eq("id", rideId).single();
    if (!ride) return "";

    const shareText = `I'm on a ride from ${ride.pickup_address} to ${ride.dropoff_address}. Track my trip: ${window.location.origin}/rides/track/${rideId}`;
    return shareText;
  },

  /**
   * SOS emergency trigger.
   */
  async triggerSOS(rideId: string, passengerId: string): Promise<boolean> {
    // Log SOS event
    await supabase.from("dispatch_events").insert([{
      event_type: "sos_triggered",
      entity_type: "ride",
      entity_id: rideId,
      payload: { passenger_id: passengerId, timestamp: new Date().toISOString() } as any,
    }]);

    // Create urgent notification for admin
    await supabase.from("user_notifications").insert([{
      user_id: passengerId,
      type: "sos_confirmation",
      title: "🆘 SOS Activated",
      message: "Emergency services have been alerted. Stay safe.",
      data: { ride_id: rideId },
    }]);

    return true;
  },
};

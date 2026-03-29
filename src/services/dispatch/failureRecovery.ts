/**
 * Failure & Recovery System
 * Handles driver cancellations, no-shows, expired offers,
 * and automatic reassignment with escalation logic.
 */

import { supabase } from "@/integrations/supabase/client";
import { dispatchEngine, type DispatchRequest } from "./dispatchEngine";

export interface RecoveryResult {
  recovered: boolean;
  action: "reassigned" | "escalated" | "cancelled" | "waiting";
  newDriverId?: string;
  message: string;
}

export const failureRecovery = {
  /**
   * Handle expired offer - reassign to next best driver.
   */
  async handleExpiredOffer(assignmentId: string): Promise<RecoveryResult> {
    const { data: assignment } = await supabase
      .from("dispatch_assignments")
      .select("*")
      .eq("id", assignmentId)
      .eq("status", "offered")
      .single();

    if (!assignment) {
      return { recovered: false, action: "waiting", message: "Assignment not found or already handled" };
    }

    // Mark as expired
    await supabase
      .from("dispatch_assignments")
      .update({ status: "expired", responded_at: new Date().toISOString() })
      .eq("id", assignmentId);

    // Get all rejected/expired drivers for this entity
    const { data: pastAssignments } = await supabase
      .from("dispatch_assignments")
      .select("driver_id")
      .eq("entity_type", assignment.entity_type)
      .eq("entity_id", assignment.entity_id)
      .in("status", ["rejected", "expired"]);

    const excludeIds = pastAssignments?.map((a) => a.driver_id) ?? [];

    return this.triggerReassignment(
      assignment.entity_type,
      assignment.entity_id,
      excludeIds,
      assignment.attempt_number ?? 1
    );
  },

  /**
   * Handle driver cancellation after acceptance.
   */
  async handleDriverCancellation(
    entityType: string,
    entityId: string,
    driverId: string,
    reason?: string
  ): Promise<RecoveryResult> {
    // Update assignment
    await supabase
      .from("dispatch_assignments")
      .update({
        status: "cancelled",
        responded_at: new Date().toISOString(),
        rejection_reason: reason ?? "driver_cancelled",
      })
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("driver_id", driverId)
      .eq("status", "accepted");

    // Remove driver from entity
    if (entityType === "ride") {
      await supabase
        .from("rides")
        .update({ driver_id: null, status: "searching", updated_at: new Date().toISOString() })
        .eq("id", entityId);
    } else if (entityType === "delivery_job") {
      await supabase
        .from("delivery_jobs")
        .update({ driver_id: null, status: "pending", updated_at: new Date().toISOString() })
        .eq("id", entityId);
    }

    // Log event
    await dispatchEngine.logEvent("driver_cancelled", entityType, entityId, driverId, { reason });

    // Get all past drivers
    const { data: pastAssignments } = await supabase
      .from("dispatch_assignments")
      .select("driver_id")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .in("status", ["rejected", "expired", "cancelled"]);

    const excludeIds = pastAssignments?.map((a) => a.driver_id) ?? [];

    return this.triggerReassignment(entityType, entityId, excludeIds, 1);
  },

  /**
   * Handle no-show (driver didn't arrive within expected time).
   */
  async handleNoShow(entityType: string, entityId: string, driverId: string): Promise<RecoveryResult> {
    return this.handleDriverCancellation(entityType, entityId, driverId, "no_show");
  },

  /**
   * Check and expire stale offers.
   */
  async expireStaleOffers(): Promise<number> {
    const { data: expired } = await supabase
      .from("dispatch_assignments")
      .select("id")
      .eq("status", "offered")
      .lt("expires_at", new Date().toISOString());

    if (!expired?.length) return 0;

    let recovered = 0;
    for (const offer of expired) {
      const result = await this.handleExpiredOffer(offer.id);
      if (result.recovered) recovered++;
    }
    return recovered;
  },

  // ---- Internal ----

  async triggerReassignment(
    entityType: string,
    entityId: string,
    excludeDriverIds: string[],
    attempt: number
  ): Promise<RecoveryResult> {
    // Fetch entity details to build dispatch request
    let pickupLat: number | null = null;
    let pickupLng: number | null = null;
    let pickupAddr = "";
    let dropoffAddr = "";
    let fare: number | null = null;

    if (entityType === "ride") {
      const { data: ride } = await supabase
        .from("rides")
        .select("*")
        .eq("id", entityId)
        .single();

      if (!ride) return { recovered: false, action: "cancelled", message: "Ride not found" };

      pickupLat = ride.pickup_lat ?? ride.pickup_latitude;
      pickupLng = ride.pickup_lng ?? ride.pickup_longitude;
      pickupAddr = ride.pickup_address ?? "";
      dropoffAddr = ride.dropoff_address ?? "";
      fare = ride.estimated_fare;
    } else if (entityType === "delivery_job") {
      const { data: job } = await supabase
        .from("delivery_jobs")
        .select("*")
        .eq("id", entityId)
        .single();

      if (!job) return { recovered: false, action: "cancelled", message: "Job not found" };

      const pickup = job.pickup_address as { lat?: number; lng?: number; street?: string };
      pickupLat = pickup?.lat ?? null;
      pickupLng = pickup?.lng ?? null;
      pickupAddr = pickup?.street ?? "Pickup";
      const delivery = job.delivery_address as { street?: string };
      dropoffAddr = delivery?.street ?? "Delivery";
      fare = job.earnings;
    }

    if (!pickupLat || !pickupLng) {
      return { recovered: false, action: "escalated", message: "Cannot determine pickup location" };
    }

    // Attempt reassignment
    const result = await dispatchEngine.retryDispatch(
      {
        entityType: entityType as "ride" | "delivery_job",
        entityId,
        pickupLocation: { lat: pickupLat, lng: pickupLng },
        pickupAddress: pickupAddr,
        dropoffAddress: dropoffAddr,
        estimatedFare: fare,
      },
      attempt,
      excludeDriverIds
    );

    if (result.success && result.driversNotified > 0) {
      return {
        recovered: true,
        action: "reassigned",
        message: `Reassigned to ${result.driversNotified} new driver(s)`,
      };
    }

    if (result.shouldRetry) {
      return {
        recovered: false,
        action: "waiting",
        message: "No drivers available yet, will retry",
      };
    }

    return {
      recovered: false,
      action: "escalated",
      message: "No drivers available after multiple attempts",
    };
  },
};

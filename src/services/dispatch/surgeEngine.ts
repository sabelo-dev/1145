/**
 * Surge & Dynamic Pricing Engine
 * Zone-based demand/supply analysis with time-of-day multipliers,
 * hotspot detection, and driver incentive calculation.
 */

import { supabase } from "@/integrations/supabase/client";
import { type GeoPoint, haversineDistance } from "./geoUtils";

export interface SurgeResult {
  multiplier: number;
  zone: string | null;
  demandLevel: "low" | "normal" | "busy" | "high" | "extreme";
  color: string;
  pendingOrders: number;
  availableDrivers: number;
  incentiveBonus: number; // Extra bonus to attract drivers
}

export interface ZoneDemand {
  zoneId: string;
  zoneName: string;
  center: GeoPoint;
  radiusKm: number;
  pendingOrders: number;
  availableDrivers: number;
  ratio: number;
  surge: number;
}

export interface PricingFactors {
  baseSurge: number;
  timeFactor: number;
  demandFactor: number;
  zoneFactor: number;
  combined: number;
}

// Time-of-day multipliers
const TIME_MULTIPLIERS: Record<string, number> = {
  rush_morning: 1.3,   // 7-9 AM
  rush_evening: 1.4,   // 5-7 PM
  night: 1.25,         // 8 PM - 6 AM
  weekend: 1.15,       // Sat/Sun
  normal: 1.0,
};

export const surgeEngine = {
  /**
   * Get surge multiplier for a specific location.
   */
  async getSurgeForLocation(location: GeoPoint): Promise<SurgeResult> {
    // 1. Check if location falls in any dispatch zone
    const { data: zones } = await supabase
      .from("dispatch_zones")
      .select("*")
      .eq("is_active", true);

    let matchedZone: typeof zones extends (infer T)[] ? T : never | null = null;
    let zoneSurge = 1.0;

    if (zones) {
      for (const zone of zones) {
        const dist = haversineDistance(location, {
          lat: Number(zone.center_lat),
          lng: Number(zone.center_lng),
        });
        if (dist <= Number(zone.radius_km)) {
          matchedZone = zone;
          // Use DB function for zone surge if available
          const { data: surgeMult } = await supabase.rpc("calculate_zone_surge", {
            p_zone_id: zone.id,
          });
          zoneSurge = surgeMult ?? Number(zone.base_surge_multiplier);
          break;
        }
      }
    }

    // 2. Fallback: global demand/supply ratio
    if (!matchedZone) {
      const globalSurge = await this.calculateGlobalSurge();
      zoneSurge = globalSurge;
    }

    // 3. Apply time-of-day factor
    const timeFactor = this.getTimeMultiplier();

    // 4. Combined surge
    const combined = Math.round(zoneSurge * timeFactor * 100) / 100;
    const finalSurge = Math.min(combined, 3.0); // Cap at 3x

    // 5. Determine demand level
    const { level, color } = this.classifySurge(finalSurge);

    // 6. Calculate driver incentive
    const incentiveBonus = finalSurge > 1.5 ? Math.round((finalSurge - 1) * 20) : 0;

    return {
      multiplier: finalSurge,
      zone: matchedZone?.name ?? null,
      demandLevel: level,
      color,
      pendingOrders: 0, // Populated by zone calc
      availableDrivers: 0,
      incentiveBonus,
    };
  },

  /**
   * Get all zone demands for heatmap display.
   */
  async getZoneDemands(): Promise<ZoneDemand[]> {
    const { data: zones } = await supabase
      .from("dispatch_zones")
      .select("*")
      .eq("is_active", true);

    if (!zones?.length) return [];

    const demands: ZoneDemand[] = [];
    for (const zone of zones) {
      const { data: surgeMult } = await supabase.rpc("calculate_zone_surge", {
        p_zone_id: zone.id,
      });

      demands.push({
        zoneId: zone.id,
        zoneName: zone.name,
        center: { lat: Number(zone.center_lat), lng: Number(zone.center_lng) },
        radiusKm: Number(zone.radius_km),
        pendingOrders: 0,
        availableDrivers: 0,
        ratio: 0,
        surge: surgeMult ?? Number(zone.base_surge_multiplier),
      });
    }

    return demands;
  },

  /**
   * Calculate all pricing factors for transparency.
   */
  getPricingFactors(baseFare: number, location: GeoPoint): PricingFactors {
    const timeFactor = this.getTimeMultiplier();
    return {
      baseSurge: 1.0,
      timeFactor,
      demandFactor: 1.0, // Will be updated async
      zoneFactor: 1.0,
      combined: timeFactor,
    };
  },

  /**
   * Record a demand snapshot for analytics.
   */
  async recordDemandSnapshot(zoneId: string, pending: number, available: number): Promise<void> {
    const ratio = available > 0 ? pending / available : pending;
    const surge = this.calculateRatioSurge(ratio);

    await supabase.from("demand_snapshots").insert({
      zone_id: zoneId,
      pending_orders: pending,
      available_drivers: available,
      demand_ratio: ratio,
      surge_multiplier: surge,
      avg_wait_time_mins: available > 0 ? Math.round((pending / available) * 5) : null,
    });
  },

  // ---- Internal ----

  getTimeMultiplier(): number {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    let multiplier = TIME_MULTIPLIERS.normal;

    if (hour >= 7 && hour < 9) multiplier = TIME_MULTIPLIERS.rush_morning;
    else if (hour >= 17 && hour < 19) multiplier = TIME_MULTIPLIERS.rush_evening;
    else if (hour >= 20 || hour < 6) multiplier = TIME_MULTIPLIERS.night;

    if (day === 0 || day === 6) multiplier *= TIME_MULTIPLIERS.weekend;

    return Math.round(multiplier * 100) / 100;
  },

  async calculateGlobalSurge(): Promise<number> {
    const { count: pending } = await supabase
      .from("delivery_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .is("driver_id", null);

    const { count: available } = await supabase
      .from("driver_locations")
      .select("*", { count: "exact", head: true })
      .eq("is_online", true)
      .eq("is_available", true);

    const ratio = (available ?? 1) > 0
      ? (pending ?? 0) / (available ?? 1)
      : (pending ?? 0);

    return this.calculateRatioSurge(ratio);
  },

  calculateRatioSurge(ratio: number): number {
    if (ratio >= 5) return 2.5;
    if (ratio >= 3) return 2.0;
    if (ratio >= 2) return 1.5;
    if (ratio >= 1.5) return 1.25;
    return 1.0;
  },

  classifySurge(surge: number): { level: SurgeResult["demandLevel"]; color: string } {
    if (surge >= 2.5) return { level: "extreme", color: "#dc2626" };
    if (surge >= 2.0) return { level: "high", color: "#ea580c" };
    if (surge >= 1.5) return { level: "busy", color: "#f59e0b" };
    if (surge >= 1.25) return { level: "normal", color: "#22c55e" };
    return { level: "low", color: "#16a34a" };
  },
};

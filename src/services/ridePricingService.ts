import { supabase } from "@/integrations/supabase/client";

// The functions used here arrive with 20261012170000_ride_fuel_index.sql and
// are not in the generated database types yet.
const db = supabase as any;

/** A fare worked out by the database: the parts add up to `total`. */
export interface RideQuote {
  vehicle_type_id: string;
  base_fare: number;
  distance_fare: number;
  time_fare: number;
  normal_fare: number;
  surge_multiplier: number;
  surge_amount: number;
  /** Positive when fuel costs more than the rates allow for, negative when it costs less. */
  fuel_surcharge: number;
  fuel_capped: boolean;
  total: number;
  province: string | null;
}

/** What a ride should leave the driver after fuel. */
export interface DriverEarningsEstimate {
  ride_id: string;
  fare: number;
  driver_payout: number;
  /** Null when the driver's position was not known. */
  pickup_km: number | null;
  idle_minutes: number;
  fuel_litres: number;
  /** Null when no fuel price has been recorded for the province. */
  fuel_price: number | null;
  fuel_cost: number | null;
  net_earnings: number | null;
  province: string | null;
}

export const ridePricing = {
  /** Quotes for every active vehicle type, keyed by vehicle type id. Empty if pricing is unavailable. */
  async quotes(
    pickup: { lat: number; lng: number },
    distanceKm: number,
    durationMinutes: number,
    surgeMultiplier: number,
  ): Promise<Record<string, RideQuote>> {
    const { data, error } = await db.rpc("ride_quotes", {
      p_pickup_lat: pickup.lat,
      p_pickup_lng: pickup.lng,
      p_distance_km: distanceKm,
      p_duration_minutes: durationMinutes,
      p_surge_multiplier: surgeMultiplier,
    });
    if (error || !Array.isArray(data)) return {};
    return Object.fromEntries((data as RideQuote[]).filter(Boolean).map((q) => [q.vehicle_type_id, q]));
  },

  /** Expected net earnings for rides a driver could accept, keyed by ride id. */
  async driverEstimates(
    rideIds: string[],
    position: { lat: number; lng: number } | null,
  ): Promise<Record<string, DriverEarningsEstimate>> {
    if (rideIds.length === 0) return {};
    const { data, error } = await db.rpc("driver_ride_earnings_estimates", {
      p_ride_ids: rideIds,
      p_driver_lat: position?.lat ?? null,
      p_driver_lng: position?.lng ?? null,
    });
    if (error || !Array.isArray(data)) return {};
    return Object.fromEntries((data as DriverEarningsEstimate[]).map((e) => [e.ride_id, e]));
  },
};

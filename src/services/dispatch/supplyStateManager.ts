/**
 * Supply State Manager
 * Real-time tracking of driver supply using Supabase Realtime.
 * Maintains a live in-memory state of all available drivers.
 */

import { supabase } from "@/integrations/supabase/client";
import { type GeoPoint, boundingBox, haversineDistance } from "./geoUtils";
import type { DriverCandidate } from "./scoringEngine";

interface DriverLocationRecord {
  driver_id: string;
  latitude: number;
  longitude: number;
  is_online: boolean;
  is_available: boolean;
  speed: number | null;
  heading: number | null;
  last_updated: string;
}

export interface SupplySnapshot {
  totalOnline: number;
  totalAvailable: number;
  totalBusy: number;
  drivers: Map<string, DriverCandidate>;
  lastUpdated: Date;
}

class SupplyStateManager {
  private drivers: Map<string, DriverCandidate> = new Map();
  private locations: Map<string, DriverLocationRecord> = new Map();
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private initialized = false;
  private listeners: Set<(snapshot: SupplySnapshot) => void> = new Set();

  /** Initialize the supply state by loading all online drivers */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load all online driver locations
    const { data: locs } = await supabase
      .from("driver_locations")
      .select("driver_id, latitude, longitude, is_online, is_available, speed, heading, last_updated")
      .eq("is_online", true);

    if (!locs?.length) {
      this.initialized = true;
      return;
    }

    // Store locations
    for (const loc of locs) {
      this.locations.set(loc.driver_id, loc);
    }

    // Load driver profiles
    const driverIds = locs.map((l) => l.driver_id);
    const { data: driverProfiles } = await supabase
      .from("drivers")
      .select("id, user_id, name, rating, total_deliveries, acceptance_rate, ontime_rate, vehicle_type, status")
      .in("id", driverIds);

    if (driverProfiles) {
      for (const d of driverProfiles) {
        const loc = this.locations.get(d.id);
        if (!loc) continue;
        this.drivers.set(d.id, {
          id: d.id,
          user_id: d.user_id,
          name: d.name,
          location: { lat: loc.latitude, lng: loc.longitude },
          rating: d.rating,
          total_deliveries: d.total_deliveries,
          acceptance_rate: d.acceptance_rate,
          ontime_rate: d.ontime_rate,
          vehicle_type: d.vehicle_type,
          status: d.status,
          current_speed: loc.speed,
          heading: loc.heading,
        });
      }
    }

    this.initialized = true;
    this.notifyListeners();
  }

  /** Subscribe to real-time location updates */
  startRealtimeSubscription(): void {
    if (this.channel) return;

    this.channel = supabase
      .channel("supply-state-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as DriverLocationRecord;
            this.drivers.delete(old.driver_id);
            this.locations.delete(old.driver_id);
          } else {
            const rec = payload.new as DriverLocationRecord;
            this.locations.set(rec.driver_id, rec);

            if (rec.is_online) {
              const existing = this.drivers.get(rec.driver_id);
              if (existing) {
                existing.location = { lat: rec.latitude, lng: rec.longitude };
                existing.current_speed = rec.speed;
                existing.heading = rec.heading;
              }
              // If driver not in map yet, they'll be picked up on next full refresh
            } else {
              this.drivers.delete(rec.driver_id);
            }
          }
          this.notifyListeners();
        }
      )
      .subscribe();
  }

  /** Stop real-time subscription */
  stopRealtimeSubscription(): void {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  /** Get available drivers within radius of a point */
  getAvailableDriversNear(
    point: GeoPoint,
    radiusKm: number = 15,
    excludeIds: string[] = []
  ): DriverCandidate[] {
    const excludeSet = new Set(excludeIds);
    const bbox = boundingBox(point, radiusKm);
    const result: DriverCandidate[] = [];

    for (const [id, driver] of this.drivers) {
      if (excludeSet.has(id)) continue;
      if (driver.status !== "available") continue;
      const loc = driver.location;
      // Quick bounding box check
      if (loc.lat < bbox.minLat || loc.lat > bbox.maxLat) continue;
      if (loc.lng < bbox.minLng || loc.lng > bbox.maxLng) continue;
      // Precise distance check
      if (haversineDistance(point, loc) <= radiusKm) {
        result.push(driver);
      }
    }

    return result;
  }

  /** Get current supply snapshot */
  getSnapshot(): SupplySnapshot {
    let available = 0;
    let busy = 0;
    for (const d of this.drivers.values()) {
      if (d.status === "available") available++;
      else busy++;
    }
    return {
      totalOnline: this.drivers.size,
      totalAvailable: available,
      totalBusy: busy,
      drivers: new Map(this.drivers),
      lastUpdated: new Date(),
    };
  }

  /** Subscribe to state changes */
  onStateChange(listener: (snapshot: SupplySnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  /** Force refresh from database */
  async refresh(): Promise<void> {
    this.drivers.clear();
    this.locations.clear();
    this.initialized = false;
    await this.initialize();
  }
}

// Singleton instance
export const supplyState = new SupplyStateManager();

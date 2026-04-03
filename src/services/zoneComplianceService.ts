/**
 * Zone Compliance Engine
 * Enforces geographic licensing restrictions per SA e-hailing regulations.
 * Handles: zone detection, violation tracking, fines, zone access passes.
 */

import { supabase } from "@/integrations/supabase/client";

export interface RideZone {
  id: string;
  name: string;
  code: string;
  center_lat: number;
  center_lng: number;
  radius_km: number;
  severity: number;
  is_active: boolean;
  province: string | null;
  municipality: string | null;
}

export interface DriverZoneLicense {
  id: string;
  driver_id: string;
  zone_id: string;
  permit_number: string | null;
  status: string;
  expiry_date: string | null;
  zone?: RideZone;
}

export interface ZoneAccessPass {
  id: string;
  driver_id: string;
  zone_id: string;
  pass_type: 'HOURLY' | 'DAILY' | 'WEEKLY';
  valid_from: string;
  valid_to: string;
  price_zar: number;
  payment_status: string;
  is_active: boolean;
  zone?: RideZone;
}

export interface ZoneViolation {
  id: string;
  driver_id: string;
  zone_id: string | null;
  ride_id: string | null;
  violation_type: string;
  severity: number;
  status: string;
  detected_zone: string | null;
  created_at: string;
}

export interface ZoneFine {
  id: string;
  violation_id: string;
  driver_id: string;
  amount_zar: number;
  base_fine: number;
  severity_multiplier: number;
  repeat_multiplier: number;
  status: string;
  created_at: string;
}

export interface ComplianceCheck {
  zone_id: string | null;
  zone_name: string | null;
  is_licensed: boolean;
  has_pass: boolean;
  is_compliant: boolean;
  checked_at: string;
}

// Zone pass pricing
const ZONE_PASS_PRICING: Record<string, number> = {
  HOURLY: 25,
  DAILY: 100,
  WEEKLY: 500,
};

export const zoneComplianceService = {
  // ========== ZONE MANAGEMENT ==========

  async getActiveZones(): Promise<RideZone[]> {
    const { data } = await supabase
      .from('ride_zones')
      .select('*')
      .eq('is_active', true)
      .order('name');
    return (data || []) as any[];
  },

  async getZoneById(zoneId: string): Promise<RideZone | null> {
    const { data } = await supabase
      .from('ride_zones')
      .select('*')
      .eq('id', zoneId)
      .single();
    return data as any;
  },

  // Detect which zone a location falls in
  detectZone(
    lat: number,
    lng: number,
    zones: RideZone[]
  ): RideZone | null {
    for (const zone of zones) {
      const distance = this.haversineKm(lat, lng, zone.center_lat, zone.center_lng);
      if (distance <= zone.radius_km) {
        return zone;
      }
    }
    return null;
  },

  // ========== COMPLIANCE CHECK ==========

  async checkDriverCompliance(
    driverId: string,
    pickupLat: number,
    pickupLng: number
  ): Promise<ComplianceCheck> {
    const { data, error } = await supabase.rpc('check_driver_zone_compliance', {
      p_driver_id: driverId,
      p_lat: pickupLat,
      p_lng: pickupLng,
    });

    if (error) {
      console.error('[Compliance] Check failed:', error.message);
      return {
        zone_id: null,
        zone_name: null,
        is_licensed: false,
        has_pass: false,
        is_compliant: true, // Fail open if check fails
        checked_at: new Date().toISOString(),
      };
    }

    return data as unknown as ComplianceCheck;
  },

  // Check ride acceptance rules
  async canAcceptRide(
    driverId: string,
    pickupLat: number,
    pickupLng: number
  ): Promise<{ allowed: boolean; reason?: string; zone?: string }> {
    const compliance = await this.checkDriverCompliance(driverId, pickupLat, pickupLng);

    if (compliance.is_compliant) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: `Not licensed for ${compliance.zone_name || 'this zone'}. Purchase a Zone Access Pass to operate here.`,
      zone: compliance.zone_name || undefined,
    };
  },

  // ========== ZONE LICENSES ==========

  async getDriverLicenses(driverId: string): Promise<DriverZoneLicense[]> {
    const { data } = await supabase
      .from('driver_zone_licenses')
      .select('*, zone:ride_zones(*)')
      .eq('driver_id', driverId)
      .eq('status', 'active');
    return (data || []) as any[];
  },

  // ========== ZONE ACCESS PASSES ==========

  async getDriverPasses(driverId: string): Promise<ZoneAccessPass[]> {
    const { data } = await supabase
      .from('zone_access_passes')
      .select('*, zone:ride_zones(*)')
      .eq('driver_id', driverId)
      .eq('is_active', true)
      .gte('valid_to', new Date().toISOString())
      .order('valid_to', { ascending: false });
    return (data || []) as any[];
  },

  async purchaseZonePass(
    driverId: string,
    zoneId: string,
    passType: 'HOURLY' | 'DAILY' | 'WEEKLY'
  ): Promise<{ success: boolean; passId?: string; error?: string }> {
    const price = ZONE_PASS_PRICING[passType] || 100;

    const validFrom = new Date();
    const validTo = new Date();
    switch (passType) {
      case 'HOURLY': validTo.setHours(validTo.getHours() + 1); break;
      case 'DAILY': validTo.setDate(validTo.getDate() + 1); break;
      case 'WEEKLY': validTo.setDate(validTo.getDate() + 7); break;
    }

    const { data, error } = await supabase.from('zone_access_passes').insert([{
      driver_id: driverId,
      zone_id: zoneId,
      pass_type: passType,
      valid_from: validFrom.toISOString(),
      valid_to: validTo.toISOString(),
      price_zar: price,
      payment_status: 'paid', // In production, integrate with wallet deduction
      is_active: true,
    }]).select('id').single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Audit log
    await supabase.from('compliance_audit_log').insert([{
      event_type: 'zone.pass.purchased',
      entity_type: 'zone_access_pass',
      entity_id: data.id,
      driver_id: driverId,
      zone_id: zoneId,
      payload: { pass_type: passType, price_zar: price, valid_to: validTo.toISOString() },
    }]);

    return { success: true, passId: data.id };
  },

  getPassPricing(): Record<string, number> {
    return { ...ZONE_PASS_PRICING };
  },

  // ========== VIOLATION HANDLING ==========

  async recordViolation(
    driverId: string,
    zoneId: string | null,
    rideId: string | null,
    location: { lat: number; lng: number },
    detectedZone: string,
    licensedZones: string[]
  ): Promise<string | null> {
    const zone = zoneId ? await this.getZoneById(zoneId) : null;

    const { data, error } = await supabase.from('zone_violations').insert([{
      driver_id: driverId,
      zone_id: zoneId,
      ride_id: rideId,
      violation_type: 'unlicensed_pickup',
      location_lat: location.lat,
      location_lng: location.lng,
      detected_zone: detectedZone,
      licensed_zones: licensedZones,
      severity: zone?.severity || 1.0,
      status: 'pending',
    }]).select('id').single();

    if (error) {
      console.error('[Compliance] Violation record failed:', error.message);
      return null;
    }

    // Apply progressive enforcement
    await this.applyEnforcement(driverId, data.id);

    // Audit log
    await supabase.from('compliance_audit_log').insert([{
      event_type: 'zone.violation.detected',
      entity_type: 'zone_violation',
      entity_id: data.id,
      driver_id: driverId,
      ride_id: rideId,
      zone_id: zoneId,
      payload: { detected_zone: detectedZone, licensed_zones: licensedZones, location },
    }]);

    return data.id;
  },

  async applyEnforcement(driverId: string, violationId: string): Promise<void> {
    // Count recent violations
    const { count } = await supabase
      .from('zone_violations')
      .select('*', { count: 'exact', head: true })
      .eq('driver_id', driverId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const violationCount = count || 0;

    if (violationCount <= 1) {
      // First offense: warn
      await supabase.from('zone_violations').update({ status: 'warned' }).eq('id', violationId);
      
      // Send warning notification
      const { data: driver } = await supabase.from('drivers').select('user_id').eq('id', driverId).single();
      if (driver) {
        await supabase.from('user_notifications').insert([{
          user_id: driver.user_id,
          type: 'zone_warning',
          title: '⚠️ Zone Compliance Warning',
          message: 'You accepted a ride outside your licensed zone. Repeated violations will result in fines.',
          data: { violation_id: violationId },
        }]);
      }
    } else if (violationCount <= 3) {
      // Apply fine
      await supabase.rpc('apply_zone_fine', { p_violation_id: violationId });
    } else {
      // Suspend + fine
      await supabase.rpc('apply_zone_fine', { p_violation_id: violationId });
      // Driver suspension is handled in the apply_zone_fine function
    }
  },

  async getDriverViolations(driverId: string): Promise<ZoneViolation[]> {
    const { data } = await supabase
      .from('zone_violations')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(50);
    return (data || []) as any[];
  },

  async getDriverFines(driverId: string): Promise<ZoneFine[]> {
    const { data } = await supabase
      .from('zone_fines')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(50);
    return (data || []) as any[];
  },

  // ========== DRIVER ZONE STATUS ==========

  async getDriverZoneStatus(
    driverId: string,
    currentLat: number,
    currentLng: number
  ): Promise<{
    status: 'GREEN' | 'YELLOW' | 'RED';
    zone: string | null;
    message: string;
    canOperate: boolean;
  }> {
    const compliance = await this.checkDriverCompliance(driverId, currentLat, currentLng);

    if (!compliance.zone_id) {
      return {
        status: 'YELLOW',
        zone: null,
        message: 'Outside defined zones — limited service area',
        canOperate: true,
      };
    }

    if (compliance.is_licensed) {
      return {
        status: 'GREEN',
        zone: compliance.zone_name,
        message: `Licensed for ${compliance.zone_name}`,
        canOperate: true,
      };
    }

    if (compliance.has_pass) {
      return {
        status: 'GREEN',
        zone: compliance.zone_name,
        message: `Active pass for ${compliance.zone_name}`,
        canOperate: true,
      };
    }

    return {
      status: 'RED',
      zone: compliance.zone_name,
      message: `Not licensed for ${compliance.zone_name}. Buy a pass or return to your zone.`,
      canOperate: false,
    };
  },

  // ========== ADMIN: AUDIT LOG ==========

  async getAuditLog(filters?: {
    eventType?: string;
    driverId?: string;
    limit?: number;
  }): Promise<Array<{
    id: string;
    event_type: string;
    entity_type: string;
    entity_id: string;
    payload: Record<string, unknown>;
    created_at: string;
  }>> {
    let query = supabase
      .from('compliance_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(filters?.limit || 100);

    if (filters?.eventType) query = query.eq('event_type', filters.eventType);
    if (filters?.driverId) query = query.eq('driver_id', filters.driverId);

    const { data } = await query;
    return (data || []) as any[];
  },

  // ========== HELPERS ==========

  haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },
};

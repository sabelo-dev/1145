/**
 * Passenger Security Service
 * Handles: PIN verification, SOS, trip monitoring, driver risk, emergency contacts
 */

import { supabase } from "@/integrations/supabase/client";

export interface SafetyAlert {
  id: string;
  ride_id: string | null;
  driver_id: string | null;
  passenger_id: string | null;
  alert_type: 'SOS' | 'ROUTE_DEVIATION' | 'PROLONGED_STOP' | 'UNEXPECTED_END' | 'SPEED_ALERT' | 'AI_ANOMALY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  trigger_source: 'passenger' | 'driver' | 'system' | 'ai';
  location_lat: number | null;
  location_lng: number | null;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
}

export interface EmergencyContact {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  relationship: string | null;
  is_primary: boolean;
}

export interface TripMonitorConfig {
  routeDeviationThresholdMeters: number;
  prolongedStopMinutes: number;
  maxSpeedKmh: number;
  locationUpdateIntervalMs: number;
}

const DEFAULT_MONITOR_CONFIG: TripMonitorConfig = {
  routeDeviationThresholdMeters: 500,
  prolongedStopMinutes: 5,
  maxSpeedKmh: 160,
  locationUpdateIntervalMs: 5000,
};

export const passengerSecurityService = {
  // ========== PIN VERIFICATION ==========

  async generateTripPin(rideId: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('generate_trip_pin', { p_ride_id: rideId });
    if (error) {
      console.error('[Security] PIN generation failed:', error.message);
      return null;
    }
    return data as string;
  },

  async verifyTripPin(rideId: string, pin: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('verify_trip_pin', { p_ride_id: rideId, p_pin: pin });
    if (error) {
      console.error('[Security] PIN verification failed:', error.message);
      return false;
    }
    return data as boolean;
  },

  async getTripPin(rideId: string): Promise<{ pin_code: string; verified: boolean; attempts: number } | null> {
    const { data } = await supabase
      .from('trip_pins')
      .select('pin_code, verified, attempts')
      .eq('ride_id', rideId)
      .single();
    return data as any;
  },

  // ========== SOS SYSTEM ==========

  async triggerSOS(
    rideId: string,
    passengerId: string,
    location?: { lat: number; lng: number },
    driverId?: string
  ): Promise<string | null> {
    const alert = {
      ride_id: rideId,
      passenger_id: passengerId,
      driver_id: driverId || null,
      alert_type: 'SOS',
      severity: 'CRITICAL',
      trigger_source: 'passenger',
      location_lat: location?.lat || null,
      location_lng: location?.lng || null,
      payload: {
        timestamp: new Date().toISOString(),
        triggered_by: 'passenger',
      },
      status: 'active',
    };

    const { data, error } = await supabase.from('safety_alerts').insert([alert]).select('id').single();
    if (error) {
      console.error('[Security] SOS trigger failed:', error.message);
      return null;
    }

    // Notify emergency contacts
    await this.notifyEmergencyContacts(passengerId, rideId, location);

    // Create user notification
    await supabase.from('user_notifications').insert([{
      user_id: passengerId,
      type: 'sos_confirmation',
      title: '🆘 SOS Activated',
      message: 'Emergency alert has been sent. Help is on the way. Stay safe.',
      data: { ride_id: rideId, alert_id: data.id },
    }]);

    // Audit log
    await this.logAudit('safety.alert.triggered', 'ride', rideId, {
      alert_type: 'SOS',
      driver_id: driverId,
      passenger_id: passengerId,
      location,
    });

    console.log(`[Security] SOS triggered for ride ${rideId}`);
    return data.id;
  },

  async triggerDriverSOS(
    rideId: string,
    driverId: string,
    location?: { lat: number; lng: number }
  ): Promise<string | null> {
    const { data, error } = await supabase.from('safety_alerts').insert([{
      ride_id: rideId,
      driver_id: driverId,
      alert_type: 'SOS',
      severity: 'CRITICAL',
      trigger_source: 'driver',
      location_lat: location?.lat || null,
      location_lng: location?.lng || null,
      payload: { timestamp: new Date().toISOString(), triggered_by: 'driver' },
      status: 'active',
    }]).select('id').single();

    if (error) return null;
    return data.id;
  },

  // ========== AI TRIP MONITORING ==========

  detectRouteDeviation(
    currentLat: number,
    currentLng: number,
    expectedRoute: Array<{ lat: number; lng: number }>,
    thresholdMeters: number = DEFAULT_MONITOR_CONFIG.routeDeviationThresholdMeters
  ): { deviated: boolean; distanceMeters: number } {
    if (!expectedRoute.length) return { deviated: false, distanceMeters: 0 };

    // Find minimum distance to any point on the expected route
    let minDistance = Infinity;
    for (const point of expectedRoute) {
      const d = this.haversineMeters(currentLat, currentLng, point.lat, point.lng);
      if (d < minDistance) minDistance = d;
    }

    return {
      deviated: minDistance > thresholdMeters,
      distanceMeters: Math.round(minDistance),
    };
  },

  async reportRouteDeviation(
    rideId: string,
    driverId: string,
    location: { lat: number; lng: number },
    deviationMeters: number
  ): Promise<void> {
    await supabase.from('safety_alerts').insert([{
      ride_id: rideId,
      driver_id: driverId,
      alert_type: 'ROUTE_DEVIATION',
      severity: deviationMeters > 2000 ? 'HIGH' : 'MEDIUM',
      trigger_source: 'ai',
      location_lat: location.lat,
      location_lng: location.lng,
      payload: { deviation_meters: deviationMeters, timestamp: new Date().toISOString() },
      status: 'active',
    }]);

    await this.logAudit('trip.route.deviation', 'ride', rideId, {
      driver_id: driverId,
      deviation_meters: deviationMeters,
      location,
    });
  },

  detectProlongedStop(
    locationHistory: Array<{ lat: number; lng: number; timestamp: string }>,
    thresholdMinutes: number = DEFAULT_MONITOR_CONFIG.prolongedStopMinutes
  ): { stopped: boolean; durationMinutes: number } {
    if (locationHistory.length < 2) return { stopped: false, durationMinutes: 0 };

    const recent = locationHistory.slice(-10);
    const first = recent[0];
    const last = recent[recent.length - 1];

    // Check if all recent points are within 50m of each other
    const allNear = recent.every(
      (p) => this.haversineMeters(p.lat, p.lng, first.lat, first.lng) < 50
    );

    if (!allNear) return { stopped: false, durationMinutes: 0 };

    const durationMs = new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime();
    const durationMinutes = durationMs / 60000;

    return {
      stopped: durationMinutes >= thresholdMinutes,
      durationMinutes: Math.round(durationMinutes * 10) / 10,
    };
  },

  detectSpeedAlert(
    speedMps: number | undefined,
    maxKmh: number = DEFAULT_MONITOR_CONFIG.maxSpeedKmh
  ): boolean {
    if (!speedMps) return false;
    return (speedMps * 3.6) > maxKmh;
  },

  // ========== EMERGENCY CONTACTS ==========

  async getEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
    const { data } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false });
    return (data || []) as any[];
  },

  async addEmergencyContact(contact: Omit<EmergencyContact, 'id'>): Promise<boolean> {
    const { error } = await supabase.from('emergency_contacts').insert([contact]);
    return !error;
  },

  async removeEmergencyContact(contactId: string): Promise<boolean> {
    const { error } = await supabase.from('emergency_contacts').delete().eq('id', contactId);
    return !error;
  },

  async notifyEmergencyContacts(
    userId: string,
    rideId: string,
    location?: { lat: number; lng: number }
  ): Promise<void> {
    const contacts = await this.getEmergencyContacts(userId);
    // In production, this would trigger SMS via an edge function
    // For now, we log and create notifications
    for (const contact of contacts) {
      console.log(`[Security] SOS notification to ${contact.name} (${contact.phone})`);
    }
    
    await this.logAudit('safety.emergency_contacts.notified', 'ride', rideId, {
      contact_count: contacts.length,
      location,
    });
  },

  // ========== DRIVER RISK ==========

  async evaluateDriverRisk(driverId: string): Promise<{
    score: number;
    level: string;
    factors: Record<string, number>;
  } | null> {
    const { data, error } = await supabase.rpc('evaluate_driver_risk', { p_driver_id: driverId });
    if (error) {
      console.error('[Security] Risk evaluation failed:', error.message);
      return null;
    }
    return data as any;
  },

  async getDriverRiskScore(driverId: string): Promise<{
    overall_score: number;
    risk_level: string;
    is_blocked: boolean;
  } | null> {
    const { data } = await supabase
      .from('driver_risk_scores')
      .select('overall_score, risk_level, is_blocked')
      .eq('driver_id', driverId)
      .single();
    return data as any;
  },

  // ========== SAFETY ALERTS ==========

  async getActiveAlerts(limit: number = 50): Promise<SafetyAlert[]> {
    const { data } = await supabase
      .from('safety_alerts')
      .select('*')
      .in('status', ['active', 'acknowledged', 'investigating'])
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data || []) as any[];
  },

  async acknowledgeAlert(alertId: string, adminId: string): Promise<boolean> {
    const { error } = await supabase.from('safety_alerts').update({
      status: 'acknowledged',
      acknowledged_by: adminId,
      acknowledged_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', alertId);
    return !error;
  },

  async resolveAlert(alertId: string, adminId: string, notes: string): Promise<boolean> {
    const { error } = await supabase.from('safety_alerts').update({
      status: 'resolved',
      resolved_by: adminId,
      resolved_at: new Date().toISOString(),
      resolution_notes: notes,
      updated_at: new Date().toISOString(),
    }).eq('id', alertId);
    return !error;
  },

  async escalateAlert(alertId: string, adminId: string): Promise<boolean> {
    const { error } = await supabase.from('safety_alerts').update({
      status: 'escalated',
      severity: 'CRITICAL',
      updated_at: new Date().toISOString(),
    }).eq('id', alertId);
    return !error;
  },

  // Subscribe to live safety alerts
  subscribeToAlerts(callback: (alert: SafetyAlert) => void) {
    return supabase
      .channel('safety-alerts-live')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'safety_alerts',
      }, (payload) => {
        callback(payload.new as SafetyAlert);
      })
      .subscribe();
  },

  // ========== TRIP SHARING ==========

  async generateShareLink(rideId: string): Promise<string> {
    return `${window.location.origin}/rides/track/${rideId}`;
  },

  // ========== AUDIT LOGGING ==========

  async logAudit(
    eventType: string,
    entityType: string,
    entityId: string,
    payload: Record<string, unknown> = {}
  ): Promise<void> {
    await supabase.from('compliance_audit_log').insert([{
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      driver_id: payload.driver_id as string || null,
      ride_id: entityType === 'ride' ? entityId : null,
      payload,
    }]);
  },

  // ========== HELPERS ==========

  haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },
};

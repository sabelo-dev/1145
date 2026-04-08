/**
 * Emergency Response Service
 * Handles panic events, real-time tracking, dispatch, and notifications
 */
import { supabase } from "@/integrations/supabase/client";
import { trackingService } from "./trackingService";
import { passengerSecurityService } from "./passengerSecurityService";

export interface EmergencyEvent {
  id: string;
  user_id: string;
  role: string;
  trip_id: string | null;
  status: string;
  lat: number | null;
  lng: number | null;
  silent_mode: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  responder_notes: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEmergencyPayload {
  user_id: string;
  role: 'driver' | 'rider';
  trip_id?: string;
  lat?: number;
  lng?: number;
  silent_mode?: boolean;
}

export const emergencyService = {
  /**
   * Create a panic event with GPS, notify contacts, create safety alert
   */
  async createEmergencyEvent(payload: CreateEmergencyPayload): Promise<EmergencyEvent | null> {
    // Try to get current location if not provided
    let lat = payload.lat;
    let lng = payload.lng;

    if (lat == null || lng == null) {
      const pos = await trackingService.getCurrentPosition();
      if (pos) {
        lat = pos.lat;
        lng = pos.lng;
      }
    }

    const { data, error } = await supabase
      .from('emergency_events')
      .insert([{
        user_id: payload.user_id,
        role: payload.role,
        trip_id: payload.trip_id || null,
        lat: lat || null,
        lng: lng || null,
        silent_mode: payload.silent_mode ?? false,
        status: 'active',
      }])
      .select()
      .single();

    if (error) {
      console.error('[Emergency] Failed to create event:', error.message);
      return null;
    }

    const event = data as unknown as EmergencyEvent;

    // Fire-and-forget: create safety alert, notify contacts, audit log
    this._postCreationActions(event, payload);

    return event;
  },

  /** Fire-and-forget post-creation side effects */
  async _postCreationActions(event: EmergencyEvent, payload: CreateEmergencyPayload) {
    try {
      // Create a corresponding safety_alert for the admin dashboard
      await supabase.from('safety_alerts').insert([{
        ride_id: event.trip_id,
        passenger_id: payload.role === 'rider' ? event.user_id : null,
        driver_id: payload.role === 'driver' ? event.user_id : null,
        alert_type: 'SOS',
        severity: 'CRITICAL',
        trigger_source: payload.role === 'driver' ? 'driver' : 'passenger',
        location_lat: event.lat,
        location_lng: event.lng,
        payload: {
          emergency_event_id: event.id,
          silent_mode: event.silent_mode,
          timestamp: event.created_at,
        },
        status: 'active',
      }]);

      // Notify emergency contacts
      await passengerSecurityService.notifyEmergencyContacts(
        event.user_id,
        event.trip_id || event.id,
        event.lat && event.lng ? { lat: Number(event.lat), lng: Number(event.lng) } : undefined,
      );

      // Create in-app notification
      await supabase.from('user_notifications').insert([{
        user_id: event.user_id,
        type: 'emergency_active',
        title: '🆘 Emergency Alert Active',
        message: 'Your panic alert is active. Help is being coordinated. Stay safe.',
        data: { emergency_event_id: event.id, trip_id: event.trip_id },
      }]);

      // Audit log
      await passengerSecurityService.logAudit('emergency.panic.triggered', 'emergency_event', event.id, {
        user_id: event.user_id,
        role: payload.role,
        trip_id: event.trip_id,
        silent_mode: event.silent_mode,
        location: event.lat && event.lng ? { lat: event.lat, lng: event.lng } : null,
      });
    } catch (err) {
      console.error('[Emergency] Post-creation actions error:', err);
    }
  },

  /**
   * Cancel an emergency event (within grace period)
   */
  async cancelEmergencyEvent(eventId: string, reason?: string): Promise<boolean> {
    const { error } = await supabase
      .from('emergency_events')
      .update({
        status: 'cancelled',
        cancel_reason: reason || 'User cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', eventId)
      .eq('status', 'active');

    if (error) {
      console.error('[Emergency] Cancel failed:', error.message);
      return false;
    }

    // Also resolve the safety alert
    await supabase
      .from('safety_alerts')
      .update({ status: 'resolved', resolution_notes: 'Cancelled by user' })
      .filter('payload->>emergency_event_id', 'eq', eventId);

    return true;
  },

  /**
   * Resolve an emergency event (admin action)
   */
  async resolveEmergencyEvent(eventId: string, adminId: string, notes: string): Promise<boolean> {
    const { error } = await supabase
      .from('emergency_events')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: adminId,
        responder_notes: notes,
      })
      .eq('id', eventId);

    return !error;
  },

  /**
   * Mark as dispatched (responder assigned)
   */
  async dispatchToEvent(eventId: string): Promise<boolean> {
    const { error } = await supabase
      .from('emergency_events')
      .update({ status: 'dispatched' })
      .eq('id', eventId)
      .eq('status', 'active');

    return !error;
  },

  /**
   * Get all active emergency events (admin)
   */
  async getActiveEmergencies(): Promise<EmergencyEvent[]> {
    const { data } = await supabase
      .from('emergency_events')
      .select('*')
      .in('status', ['active', 'dispatched'])
      .order('created_at', { ascending: false });

    return (data || []) as unknown as EmergencyEvent[];
  },

  /**
   * Get user's own emergency events
   */
  async getUserEmergencies(userId: string, limit = 20): Promise<EmergencyEvent[]> {
    const { data } = await supabase
      .from('emergency_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data || []) as unknown as EmergencyEvent[];
  },

  /**
   * Subscribe to real-time emergency events (admin)
   */
  subscribeToEmergencies(callback: (event: EmergencyEvent) => void) {
    return supabase
      .channel('emergency-events-live')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'emergency_events',
      }, (payload) => {
        callback(payload.new as unknown as EmergencyEvent);
      })
      .subscribe();
  },
};

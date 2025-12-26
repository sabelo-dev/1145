import { supabase } from "@/integrations/supabase/client";

// Types
export interface DriverProfile {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  vehicle_type: string | null;
  license_number: string | null;
  vehicle_registration: string | null;
  status: 'pending' | 'available' | 'busy' | 'offline' | 'suspended';
  rating: number;
  total_deliveries: number;
  current_location: GeoLocation | null;
  created_at: string;
  updated_at: string;
}

export interface GeoLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp?: string;
}

export interface VehicleData {
  type: string;
  license_number: string;
  registration: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  capacity_kg?: number;
}

export interface VerificationStatus {
  identity_verified: boolean;
  license_verified: boolean;
  vehicle_verified: boolean;
  background_check: boolean;
  overall_status: 'pending' | 'verified' | 'rejected' | 'expired';
}

export interface AvailabilitySchedule {
  day: number; // 0-6 (Sunday-Saturday)
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  is_available: boolean;
}

// Driver Service
export const driverService = {
  // Fetch driver profile with extended data
  async getProfile(userId: string): Promise<DriverProfile | null> {
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !data) return null;
    return data as unknown as DriverProfile;
  },

  // Update driver location
  async updateLocation(driverId: string, location: GeoLocation): Promise<boolean> {
    const { error } = await supabase
      .from("drivers")
      .update({
        current_location: {
          lat: location.lat,
          lng: location.lng,
          accuracy: location.accuracy,
          heading: location.heading,
          speed: location.speed,
          timestamp: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", driverId);

    return !error;
  },

  // Update availability status
  async updateStatus(driverId: string, status: DriverProfile['status']): Promise<boolean> {
    const { error } = await supabase
      .from("drivers")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", driverId);

    return !error;
  },

  // Subscribe to driver updates
  subscribeToDriverUpdates(driverId: string, callback: (driver: DriverProfile) => void) {
    return supabase
      .channel(`driver-${driverId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "drivers",
          filter: `id=eq.${driverId}`,
        },
        (payload) => {
          callback(payload.new as unknown as DriverProfile);
        }
      )
      .subscribe();
  },
};

// Verification Service (KYC)
export const verificationService = {
  // Check verification status (simulated - would connect to real KYC provider)
  getVerificationStatus(driver: DriverProfile): VerificationStatus {
    const hasLicense = !!driver.license_number;
    const hasVehicle = !!driver.vehicle_registration;
    const hasPhone = !!driver.phone;
    
    const allVerified = hasLicense && hasVehicle && hasPhone;
    
    return {
      identity_verified: hasPhone,
      license_verified: hasLicense,
      vehicle_verified: hasVehicle,
      background_check: driver.status !== 'pending',
      overall_status: allVerified && driver.status !== 'pending' 
        ? 'verified' 
        : driver.status === 'suspended' 
          ? 'rejected' 
          : 'pending',
    };
  },

  // Get verification progress percentage
  getVerificationProgress(status: VerificationStatus): number {
    const checks = [
      status.identity_verified,
      status.license_verified,
      status.vehicle_verified,
      status.background_check,
    ];
    return (checks.filter(Boolean).length / checks.length) * 100;
  },
};

// Availability Service
export const availabilityService = {
  // Check if driver is available now based on schedule
  isAvailableNow(schedule: AvailabilitySchedule[]): boolean {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const todaySchedule = schedule.find(s => s.day === currentDay);
    if (!todaySchedule || !todaySchedule.is_available) return false;
    
    return currentTime >= todaySchedule.start_time && currentTime <= todaySchedule.end_time;
  },

  // Get default schedule (9am-5pm weekdays)
  getDefaultSchedule(): AvailabilitySchedule[] {
    return Array.from({ length: 7 }, (_, day) => ({
      day,
      start_time: '09:00',
      end_time: '17:00',
      is_available: day >= 1 && day <= 5, // Mon-Fri
    }));
  },
};

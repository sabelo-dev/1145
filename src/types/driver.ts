export interface Driver {
  id: string;
  user_id: string;
  name: string;
  phone?: string;
  vehicle_type?: string;
  vehicle_registration?: string;
  license_number?: string;
  status: 'available' | 'busy' | 'offline';
  current_location?: {
    lat: number;
    lng: number;
  };
  rating: number;
  total_deliveries: number;
  created_at: string;
  updated_at: string;
}

export interface DeliveryJob {
  id: string;
  order_id?: string;
  driver_id?: string;
  status: 'pending' | 'accepted' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  pickup_address: {
    street: string;
    city: string;
    province: string;
    postal_code: string;
    lat?: number;
    lng?: number;
  };
  delivery_address: {
    street: string;
    city: string;
    province: string;
    postal_code: string;
    lat?: number;
    lng?: number;
  };
  pickup_time?: string;
  estimated_delivery_time?: string;
  actual_delivery_time?: string;
  distance_km?: number;
  earnings?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DriverAnalytics {
  id: string;
  driver_id: string;
  date: string;
  deliveries_completed: number;
  total_distance_km: number;
  total_earnings: number;
  average_delivery_time_mins: number;
  created_at: string;
}

export interface DriverTier {
  id: string;
  name: string;
  display_name: string;
  level: number;
  badge_color: string;
  min_deliveries: number;
  min_ontime_rate: number;
  min_acceptance_rate: number;
  min_rating: number;
  base_pay_multiplier: number;
  priority_job_access: boolean;
  cashout_fee_percent: number;
  insurance_coverage_percent: number;
  features: string[];
  created_at: string;
}

export interface DriverTierHistory {
  id: string;
  driver_id: string;
  tier_id: string;
  previous_tier_id: string | null;
  reason: string | null;
  effective_date: string;
  created_at: string;
  tier?: DriverTier;
  previous_tier?: DriverTier;
}

export interface DeliveryEarnings {
  id: string;
  delivery_job_id: string;
  driver_id: string;
  base_pay: number;
  distance_pay: number;
  urgency_pay: number;
  surge_pay: number;
  tip_amount: number;
  tier_bonus: number;
  total_earnings: number;
  surge_multiplier: number | null;
  distance_km: number | null;
  is_priority: boolean;
  created_at: string;
}

export interface DeliveryTip {
  id: string;
  order_id: string;
  delivery_job_id: string | null;
  driver_id: string | null;
  customer_id: string;
  amount: number;
  is_prepaid: boolean;
  status: 'pending' | 'paid' | 'cancelled';
  paid_at: string | null;
  created_at: string;
}

export interface DriverCashout {
  id: string;
  driver_id: string;
  amount: number;
  fee_amount: number;
  fee_percent: number;
  net_amount: number;
  payment_method: string;
  payment_reference: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processed_at: string | null;
  created_at: string;
}

export interface DriverInvestment {
  id: string;
  driver_id: string;
  investment_type: 'brand_stake' | 'vehicle_savings' | 'storefront_fund';
  target_vendor_id: string | null;
  amount: number;
  ucoin_spent: number;
  returns_earned: number;
  status: 'active' | 'matured' | 'withdrawn';
  maturity_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface DriverVehicleFund {
  id: string;
  driver_id: string;
  total_saved: number;
  ucoin_contributed: number;
  target_amount: number | null;
  purpose: string | null;
  status: 'saving' | 'goal_reached' | 'redeemed';
  created_at: string;
  updated_at: string;
}

export interface DriverPerformanceStats {
  id: string;
  driver_id: string;
  period_start: string;
  period_end: string;
  total_deliveries: number;
  ontime_deliveries: number;
  accepted_jobs: number;
  offered_jobs: number;
  average_rating: number | null;
  total_tips: number;
  total_earnings: number;
  created_at: string;
}

export interface SurgeZone {
  id: string;
  name: string;
  polygon: any;
  surge_multiplier: number;
  is_active: boolean;
  start_time: string | null;
  end_time: string | null;
  days_active: number[];
  created_at: string;
  updated_at: string;
}

export interface DriverRetentionData {
  tier: DriverTier | null;
  allTiers: DriverTier[];
  tierHistory: DriverTierHistory[];
  earnings: DeliveryEarnings[];
  cashouts: DriverCashout[];
  investments: DriverInvestment[];
  vehicleFund: DriverVehicleFund | null;
  performanceStats: DriverPerformanceStats[];
  pendingTips: number;
  availableBalance: number;
  totalEarnings: number;
}

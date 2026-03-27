export interface AssetProvider {
  id: string;
  user_id: string;
  company_name: string;
  contact_email?: string;
  contact_phone?: string;
  business_registration?: string;
  status: 'pending' | 'approved' | 'suspended' | 'rejected';
  commission_rate: number;
  total_assets: number;
  total_revenue: number;
  created_at: string;
  updated_at: string;
}

export interface LeaseableAsset {
  id: string;
  product_id?: string;
  provider_id?: string;
  title: string;
  description?: string;
  category: string;
  subcategory?: string;
  images: string[];
  lease_price_monthly: number;
  lease_price_weekly?: number;
  lease_price_daily?: number;
  security_deposit: number;
  min_lease_duration_months: number;
  max_lease_duration_months: number;
  terms_and_conditions?: string;
  maintenance_requirements?: string;
  maintenance_responsibility?: string;
  is_available: boolean;
  is_purchasable: boolean;
  purchase_price: number;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'refurbished';
  status: 'active' | 'leased' | 'maintenance' | 'retired' | 'pending_approval';
  total_leases: number;
  brand?: string;
  model?: string;
  serial_number?: string;
  asset_year?: number;
  location_lat?: number;
  location_lng?: number;
  location_address?: string;
  views_count?: number;
  rating?: number;
  review_count?: number;
  featured?: boolean;
  lease_to_own?: boolean;
  lease_to_own_price?: number;
  lease_to_own_months?: number;
  insurance_required?: boolean;
  insurance_monthly_cost?: number;
  insurance_provider?: string;
  lease_category_id?: string;
  created_at: string;
  updated_at: string;
  provider?: AssetProvider;
}

export interface LeaseApplication {
  id: string;
  user_id: string;
  asset_id: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'cancelled';
  lease_duration_months: number;
  monthly_payment: number;
  security_deposit: number;
  applicant_name?: string;
  applicant_email?: string;
  applicant_phone?: string;
  id_document_url?: string;
  proof_of_income_url?: string;
  credit_score?: number;
  employment_status?: string;
  monthly_income?: number;
  notes?: string;
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
  asset?: LeaseableAsset;
  applicant_profile?: { name?: string; email?: string };
}

export interface LeaseContract {
  id: string;
  application_id?: string;
  user_id: string;
  asset_id: string;
  contract_number: string;
  status: 'active' | 'completed' | 'terminated' | 'defaulted' | 'renewed';
  start_date: string;
  end_date: string;
  monthly_payment: number;
  security_deposit: number;
  deposit_returned: boolean;
  total_paid: number;
  total_due: number;
  next_payment_date?: string;
  payments_made: number;
  payments_remaining: number;
  late_payments: number;
  contract_document_url?: string;
  e_signature_url?: string;
  signed_at?: string;
  terminated_at?: string;
  termination_reason?: string;
  renewal_count: number;
  is_lease_to_own?: boolean;
  ownership_transferred?: boolean;
  ownership_transfer_amount?: number;
  insurance_active?: boolean;
  insurance_monthly_cost?: number;
  insurance_provider?: string;
  auto_pay_enabled?: boolean;
  payment_method_id?: string;
  created_at: string;
  updated_at: string;
  asset?: LeaseableAsset;
  user_profile?: { name?: string; email?: string };
}

export interface LeasePayment {
  id: string;
  contract_id: string;
  user_id: string;
  amount: number;
  payment_type: 'monthly' | 'weekly' | 'security_deposit' | 'late_fee' | 'early_termination';
  status: 'pending' | 'paid' | 'overdue' | 'failed' | 'refunded';
  due_date: string;
  paid_at?: string;
  payment_method?: string;
  transaction_reference?: string;
  late_fee: number;
  notes?: string;
  created_at: string;
}

export interface AssetMaintenance {
  id: string;
  asset_id: string;
  contract_id?: string;
  maintenance_type: 'routine' | 'repair' | 'inspection' | 'replacement';
  description?: string;
  scheduled_date?: string;
  completed_date?: string;
  cost: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  performed_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  asset?: LeaseableAsset;
}

export interface LeaseCreditScore {
  id: string;
  user_id: string;
  overall_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'very_high' | 'unknown';
  max_lease_value: number;
  order_history_score: number;
  wallet_activity_score: number;
  delivery_reliability_score: number;
  ride_performance_score: number;
  payment_history_score: number;
  platform_tenure_score: number;
  factors: Record<string, any>;
  last_calculated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AssetTracking {
  id: string;
  asset_id: string;
  contract_id?: string;
  latitude?: number;
  longitude?: number;
  usage_hours: number;
  mileage_km: number;
  battery_level?: number;
  is_disabled: boolean;
  last_ping_at?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface LeaseAssetCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  image_url?: string;
  parent_id?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

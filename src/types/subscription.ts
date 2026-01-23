export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  billing_period: 'monthly' | 'yearly';
  features: string[];
  max_products?: number;
  max_orders?: number;
  support_level: 'basic' | 'standard' | 'premium';
  created_at: string;
  updated_at: string;
}

export interface VendorSubscription {
  subscription_tier: 'starter' | 'bronze' | 'silver' | 'gold';
  trial_start_date?: string;
  trial_end_date?: string;
  subscription_status: 'trial' | 'active' | 'expired' | 'cancelled';
  subscription_expires_at?: string;
}

export type SubscriptionFeature = 
  | 'basic_dashboard'
  | 'advanced_analytics' 
  | 'priority_support'
  | 'custom_branding'
  | 'api_access'
  | 'unlimited_products'
  | 'email_support';